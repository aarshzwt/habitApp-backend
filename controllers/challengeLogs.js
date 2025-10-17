require('dotenv').config();
const dayjs = require("dayjs");
const { Op } = require("sequelize");
const fs = require("fs");
const cron = require("node-cron");

const db = require("../models");
const path = require('path');

const LAST_RUN_FILE = path.join(__dirname, "lastChallengeLogRun.json");

const challenge = db.challenges;
const challengeParticipants = db.challengeParticipants;
const challengeLogs = db.challengeLogs;

async function getLogs(req, res) {
    try {
        const user_id = req.id;
        const challenge_id = req.params.challenge_id;

        const logs = await challengeLogs.findAll({
            where: { user_id, challenge_id },
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

        const logs = await challengeLogs.findAll({
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

        const log = await challengeLogs.findAll({
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

        const logs = await challengeLogs.findAll({
            where: { challenge_id },
        });

        return res.status(200).json({ challengeLogs: logs })

    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: "server error" });
    }
}

async function createChallengeLog(req, res) {
    try {
        const todayStr = new Date().toISOString().split('T')[0];
        const todayDate = new Date(todayStr);

        const user_id = req.id;

        const existingChallenges = await challengeParticipants.findAll({
            where: {
                user_id,
                start_date: { [Op.lte]: todayStr },
                [Op.or]: [
                    { end_date: null },
                    { end_date: { [Op.gte]: todayStr } }
                ]
            },
            attributes: ['id', 'challenge_id']
        })
        console.log(existingChallenges)
        if (existingChallenges) {
            for (const existingChallenge of existingChallenges) {
                const logsUptoToday = await challengeLogs.findOne({
                    where: {
                        user_id,
                        id: existingChallenge.id,
                        challenge_id: existingChallenge.challenge_id
                    },
                    order: [['date', 'DESC']]
                });

                let currentDate = lastLog
                    ? new Date(lastLog.date)
                    : new Date(habit.start_date);

            }
        }
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: "server error" });
    }
}
async function updateChallengeLog(req, res) {
    try {

    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: "server error" });
    }
}

if (process.env.APP_ENV === "development") {
    (setTimeout(async () => {
        const today = dayjs().format("YYYY-MM-DD");
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
        fs.writeFileSync(LAST_RUN_FILE, JSON.stringify({ lastRun: today }));
        console.log("completed")
    }, 3000));
} else if (process.env.APP_ENV === "production") {
    // Every day at midnight
    cron.schedule('* * * * *', async () => {
        console.log("running")
        await createDailyChallengeLogs();
        console.log("completed")
    });
}

// This function will create challenge logs for all active participants for today
async function createDailyChallengeLogs() {
    try {
        const today = dayjs().format("YYYY-MM-DD");

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
        const participantIds = participants.map(p => p.id);

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
    } catch (err) {
        console.error("Error creating challenge logs:", err);
    }
}



async function createMissingChallengeLogs(startDate = null, endDate = null) {
    try {
        const today = dayjs().format("YYYY-MM-DD");
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
            const logEnd = endDate ? dayjs(endDate) : dayjs(today);

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

module.exports = createDailyChallengeLogs;


module.exports = { getLogs, getAllLogsOfChallenge, getLogById, getLogsOfUser, updateChallengeLog }