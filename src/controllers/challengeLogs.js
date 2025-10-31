require('dotenv').config();
const dayjs = require("dayjs");
const { Op } = require("sequelize");
const fs = require("fs");
const cron = require("node-cron");

const db = require("../models");
const path = require('path');
const { addXP, calculateStreak, calculateAllLogCompletionStatus, habitLogXP, missedXP, streakXP, allLogsInDayXP, } = require('../utils/utilityFunctions');

const LAST_RUN_FILE = path.join(__dirname, "lastChallengeLogRun.json");

const today = dayjs().format("YYYY-MM-DD");

async function getLogs(req, res) {
    try {
        const user_id = req.id;
        const challenge_id = req.params.challenge_id;

        const logs = await db.challengeLogs.findAll({
            where: { user_id, challenge_id },
            order: [['date', 'DESC']]
        });

        return res.status(200).json({ logs })
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: "server error" });
    }
}

async function getLogsOfUser(req, res) {
    try {
        const user_id = req.id;
        // const challenge_id = req.params.id;

        const logs = await db.challengeLogs.findAll({
            where: { user_id },
        });

        return res.status(200).json({ logs })
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: "server error" });
    }
}

async function getLogById(req, res) {
    try {
        const id = req.params.id;

        const log = await db.challengeLogs.findAll({
            where: { id },
        });

        return res.status(200).json({ log })
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: "server error" });
    }
}

async function getAllLogsOfChallenge(req, res) {
    try {
        const challenge_id = req.params.challenge_id;

        const logs = await db.challengeLogs.findAll({
            where: { challenge_id },
        });

        return res.status(200).json({ challengeLogs: logs })

    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: "server error" });
    }
}

async function updateChallengeLog(req, res) {
    const id = req.params.challenge_id;
    const user_id = req.id;
    const { status } = req.body

    try {
        const log = await db.challengeLogs.findOne({
            where: {
                id, user_id
            }
        });
        if (!log) return res.status(404).json({ message: "Log not found" });

        if (!["completed", "remaining", "missed"].includes(status)) {
            return res.status(400).json({ message: "Invalid Status" });
        }
        const previousStatus = log.status;
        const logs = await db.challengeLogs.findAll({
            where: { user_id, challenge_id: log.challenge_id },
            order: [['date', 'DESC']],
        });
        const oldStreak = await calculateStreak(logs);

        await log.update({ status })

        //avoiding the db call for single status change output
        const newLogs = logs.map(l => {
            if (l.id === log.id) {
                return { ...l.toJSON(), status };
            }
            return l.toJSON();
        });
        const newStreak = await calculateStreak(newLogs);

        // XP for habit completion
        if (status === "completed" && previousStatus !== "completed") {
            await addXP(user_id, habitLogXP);
            if (newStreak > 0 && newStreak % 7 === 0) {
                await addXP(user_id, streakXP); // credit the 1-week streak bonus XP
            }

            // Addition of bonus XP if all habit due today are marked completed
            const res = await calculateAllLogCompletionStatus(user_id);
            if (res.logsInaDay && res.completedlogsInaDay && res.logsInaDay > 1 && res.completedlogsInaDay === res.logsInaDay) {
                await addXP(user_id, allLogsInDayXP)
            }
        }
        //XP for when state changes from completed to missed
        else if (status === "missed" && previousStatus === "completed") {
            await addXP(user_id, -habitLogXP + missedXP);// deduct bonus XP plus add missed log XP penalty

            const brokeStreak = oldStreak > newStreak && oldStreak % 7 === 0 && newStreak % 7 !== 0;
            if (brokeStreak) {
                await addXP(user_id, -streakXP); // Deduct bonus streak XP when marking the status missed causes it to break
            }

            // Deduction of bonus XP of allLogsCompletedToday if credited earlier
            const res = await calculateAllLogCompletionStatus(user_id);
            if (res.logsInaDay && res.completedlogsInaDay && res.logsInaDay > 1 && res.completedlogsInaDay === (res.logsInaDay - 1)) {
                await addXP(user_id, -allLogsInDayXP) //deducting bonus xp
            }
        }
        //XP for when state changes from missed to remaining 
        else if (status === "remaining" && previousStatus === "missed") {
            await addXP(user_id, -missedXP) //credit the missed XP deduction
        }

        return res.json({ message: "Challenge Log status updated", status: log.status });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: err });
    }
}

if (process.env.APP_ENV === "development") {
    (setTimeout(async () => {
        // --- Check if already ran today ---
        let lastRun = null;
        if (fs.existsSync(LAST_RUN_FILE)) {
            lastRun = JSON.parse(fs.readFileSync(LAST_RUN_FILE, "utf-8")).lastRun;
            if (lastRun === today) {
                // console.log("Challenge logs already created today. Skipping...");
                return;
            }
        }
        console.log("running")
        await createMissingChallengeLogs();
        await markMissed();
        fs.writeFileSync(LAST_RUN_FILE, JSON.stringify({ lastRun: today }));
        console.log("completed")
    }, 3000));
} else if (process.env.APP_ENV === "production") {
    // Every day at midnight
    cron.schedule('* * * * *', async () => {
        console.log("running")
        await createDailyChallengeLogs();
        await markMissed();
        console.log("completed")
    });
}

// This function will create challenge logs for all active participants for today
async function createDailyChallengeLogs() {
    try {
        // Get all active challenge participants
        const participants = await db.challengeParticipants.findAll({
            where: {
                status: "active",
                start_date: { [Op.lte]: today },
                [Op.or]: [
                    { end_date: { [Op.gte]: today } },
                    { end_date: null }
                ]
            },
            raw: true
        });

        if (participants.length === 0) {
            console.log("No active challenge participants today.");
            return;
        }

        // 2️⃣ Filter out participants who already have a log for today
        const existingLogs = await db.challengeLogs.findAll({
            where: {
                challenge_id: { [Op.in]: participants.map(p => p.challenge_id) },
                user_id: { [Op.in]: participants.map(p => p.user_id) },
                date: today
            },
            raw: true
        });

        const logsToSkip = new Set(existingLogs.map(log => `${log.challenge_id}-${log.user_id}`));

        // 3️⃣ Create logs for participants who don't have one yet
        const logsToCreate = participants
            .filter(p => !logsToSkip.has(`${p.challenge_id}-${p.user_id}`))
            .map(p => ({
                challenge_id: p.challenge_id,
                user_id: p.user_id,
                date: today,
                status: "remaining", // default
                createdAt: new Date(),
                updatedAt: new Date()
            }));

        if (logsToCreate.length === 0) {
            console.log("All participants already have logs for today.");
            return;
        }

        await db.challengeLogs.bulkCreate(logsToCreate);
        console.log(`Created ${logsToCreate.length} challenge logs for ${today}.`);
        return;
    } catch (err) {
        console.error("Error creating challenge logs:", err);
    }
}



async function createMissingChallengeLogs(startDate = null, endDate = null) {
    try {
        // Fetch all active participants
        const participants = await db.challengeParticipants.findAll({
            where: {
                status: "active",
                start_date: { [Op.lte]: today },
                [Op.or]: [
                    { end_date: { [Op.gte]: today } },
                    { end_date: null }
                ]
            },
            raw: true
        });

        if (participants.length === 0) {
            console.log("No active challenge participants.");
            return;
        }

        for (const p of participants) {
            // Determine start for creating logs
            const participantStart = dayjs(p.start_date);
            const logStart = startDate ? dayjs(startDate) : participantStart;
            const logEnd = endDate ? dayjs(endDate) : p.end_date > today ? dayjs(today) : dayjs(p.end_date);

            // Find existing logs for this participant
            const existingLogs = await db.challengeLogs.findAll({
                where: {
                    challenge_id: p.challenge_id,
                    user_id: p.user_id,
                    date: { [Op.between]: [logStart.format("YYYY-MM-DD"), logEnd.format("YYYY-MM-DD")] }
                },
                raw: true
            });

            const existingDates = new Set(existingLogs.map(log => log.date));

            // Create logs for missing dates
            let logsToCreate = [];
            let current = logStart;

            while (current.isBefore(logEnd) || current.isSame(logEnd, "day")) {
                const dateStr = current.format("YYYY-MM-DD");
                if (!existingDates.has(dateStr)) {
                    logsToCreate.push({
                        challenge_id: p.challenge_id,
                        user_id: p.user_id,
                        date: dateStr,
                        status: "remaining",
                        createdAt: new Date(),
                        updatedAt: new Date()
                    });
                }
                current = current.add(1, "day");
            }

            if (logsToCreate.length > 0) {
                await db.challengeLogs.bulkCreate(logsToCreate);
                console.log(`Created ${logsToCreate.length} logs for ${p.user_id}`);
            }
        }
        console.log("Completed creating missing challenge logs.");
    } catch (err) {
        console.error("Error creating challenge logs:", err);
    }
}

async function todaysChallenges(req, res) {
    const user_id = req.id;
    try {
        const challenges = await db.challengeLogs.findAll({
            where: { user_id, date: today },
            include: [{
                model: db.challenges,
                as: 'challenge',
                attributes: ['title', 'description'],
                required: true
            }]
        });
        const result = challenges.map(ch => {
            return {
                id: ch.challenge_id,
                log_id: ch.id,
                date: ch.date,
                status: ch.status,
                title: ch.challenge.title,
                description: ch.challenge.description
            }
        });

        res.status(200).json({ challenge: result });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Something went wrong" });
    }
}

async function markMissed() {
    try {
        const logs = await db.challengeLogs.findAll(
            {
                where: {
                    status: 'remaining',
                    date: { [Op.lt]: today },
                },
                attributes: ['id', 'user_id'],
            }
        );
        if (logs.length === 0) {
            console.log("No logs to mark as missed today");
            return;
        }

        await db.challengeLogs.update(
            { status: 'missed' },
            {
                where: {
                    id: logs.map(l => l.id)
                }
            }
        );

        const userMissCount = {};
        logs.forEach(log => {
            userMissCount[log.user_id] = (userMissCount[log.user_id] || 0) + 1;
        });

        for (const [userId, missCount] of Object.entries(userMissCount)) {
            await addXP(userId, missCount * missedXP)
        }

        console.log(`Marked ${logs.length} challenge logs as missed and deducted XP`);
    } catch (err) {
        console.log(err)
    }
}

module.exports = { getLogs, getAllLogsOfChallenge, getLogById, getLogsOfUser, updateChallengeLog, todaysChallenges }