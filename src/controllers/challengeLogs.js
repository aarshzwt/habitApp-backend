require('dotenv').config();
const dayjs = require("dayjs");
const { Op, col } = require("sequelize");
const db = require("../models");
const { addXP, calculateStreak, calculateAllLogCompletionStatus, missedXP, WeeklyStreakXP, allLogsInDayXP, challengeLogXP, } = require('../utils/utilityFunctions');

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
    const id = req.params.id;
    const user_id = req.id;
    const { status } = req.body
    console.log(id, user_id)
    try {
        const log = await db.challengeLogs.findOne({
            where: {
                id, user_id
            },
            include: [{
                model: db.challengeParticipants,
                as: 'participant',
                where: {
                    user_id,
                    // status: 'active',
                    challenge_id: col('challenge_logs.challenge_id')
                },
                attributes: ['status'],
            }]
        });
        if (!log) return res.status(404).json({ message: "Log not found" });

        if (log.participant.status !== 'active')
            return res.status(400).json({ details: [{ message: "Challenge Patricipation is not active!" }] })

        if (!["completed", "remaining", "missed"].includes(status)) {
            return res.status(400).json({ message: "Invalid Status" });
        }
        const previousStatus = log.status;

        // Get all logs for this user's challenge
        const logs = await db.challengeLogs.findAll({
            where: { user_id, challenge_id: log.challenge_id },
            order: [['date', 'DESC']],
        });

        // Calculate Old Streaks
        const oldStreak = await calculateStreak(logs);

        // Update the current log status
        await log.update({ status })

        //avoiding the db call for single status change output
        const newLogs = logs.map(l => {
            if (l.id === log.id) {
                return { ...l.toJSON(), status };
            }
            return l.toJSON();
        });

        // Calculate New Streaks
        const newStreak = await calculateStreak(newLogs);

        // XP for challenge completion
        if (status === "completed" && previousStatus !== "completed") {
            await addXP(user_id, challengeLogXP); // + Log Completion XP

            // + 1-week streak bonus XP
            if (newStreak > 0 && newStreak % 7 === 0) {
                await addXP(user_id, WeeklyStreakXP);
            }

            // Addition of bonus XP if all challenge due today are marked completed
            const res = await calculateAllLogCompletionStatus(user_id);
            if (res.logsInaDay && res.completedlogsInaDay && res.logsInaDay > 1 && res.completedlogsInaDay === res.logsInaDay) {
                await addXP(user_id, allLogsInDayXP)
            }
        }
        //XP for when state changes from completed to missed
        else if (status === "missed" && previousStatus === "completed") {
            await addXP(user_id, -challengeLogXP + missedXP);// deduct bonus XP plus add missed log XP penalty

            const brokeStreak = oldStreak > newStreak && oldStreak % 7 === 0 && newStreak % 7 !== 0;
            if (brokeStreak) {
                await addXP(user_id, -WeeklyStreakXP); // Deduct bonus streak XP when marking the status missed causes it to break
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

// This function will create challenge logs for all active participants for today
async function createDailyChallengeLogs(userId) {
    try {
        // Get participant's all active challenges
        const participants = await db.challengeParticipants.findAll({
            where: {
                user_id: userId,
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
            console.log(`No active challenges for user ${userId} today.`);
            return;
        }
        // for each participant create missing logs upto today
        for (const participant of participants) {

            // finding the last log of that challenge if exists
            const lastLog = await db.challengeLogs.findOne({
                where: {
                    challenge_id: participant.challenge_id,
                    user_id: userId,
                },
                order: [['date', 'DESC']],
                raw: true
            });

            // setting date
            let currentDate = lastLog
                ? new Date(lastLog.date)
                : new Date(participant.start_date);

            lastLog ? currentDate.setDate(currentDate.getDate() + 1) : currentDate.setDate(currentDate.getDate());
            let count = 0;

            while (currentDate <= new Date(today)) {
                const currentStr = dayjs(currentDate).format("YYYY-MM-DD");

                let logCreated = await db.challengeLogs.findOrCreate({
                    where: { challenge_id: participant.challenge_id, user_id: userId, date: currentStr },
                    defaults: { status: 'remaining', user_id: userId }
                });
                // marking the count of challenge logs created for each user
                if (logCreated.length > 0) {
                    count++;
                }
                currentDate.setDate(currentDate.getDate() + 1);
            }
            console.log(`✅ Created ${count} challenge logs for user ${userId}`);
        }
        // Filter out participant's challenges which already have a log for today

        // const logsToSkip = new Set(existingLogs.map(log => log.challenge_id));

        // Create logs for participant's challenge who don't have one yet
        // const logsToCreate = participants
        //     .filter(p => !logsToSkip.has(p.challenge_id))
        //     .map(p => ({
        //         challenge_id: p.challenge_id,
        //         user_id: userId,
        //         date: today,
        //         status: "remaining", // default
        //         createdAt: new Date(),
        //         updatedAt: new Date()
        //     }));

        // if (logsToCreate.length > 0) {
        //     await db.challengeLogs.bulkCreate(logsToCreate);
        //     console.log(`✅ Created ${logsToCreate.length} challenge logs for user ${userId}`);
        // }
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

async function updateEndedChallenges() {

    // Find all challenges that have ended today or before and are still active
    const endedChallenges = await db.challengeParticipants.findAll({
        where: {
            end_date: { [Op.lt]: today },
            status: "active"
        }
    });

    for (const challenge of endedChallenges) {
        const challengeId = challenge.challenge_id;
        const userId = challenge.user_id;

        // Fetch all logs for this challenge
        const logs = await db.challengeLogs.findAll({
            where: {
                challenge_id: challengeId,
                user_id: userId
            }
        });

        if (!logs.length) {
            // no logs — mark failed
            await challenge.update({ status: "failed" });
            continue;
        }

        // Check if all logs are completed
        const allCompleted = logs.every(l => l.status === "completed");

        await challenge.update({
            status: allCompleted ? "completed" : "failed"
        });
        console.log(`challenge ${challengeId} for user ${userId} marked ${allCompleted ? "completed" : "failed"}`)
    }
}


async function todaysChallenges(req, res) {
    const user_id = req.id;
    try {
        const challenges = await db.challengeLogs.findAll({
            where: { user_id, date: today },
            attributes: [
                ['challenge_id', 'id'],
                ['id', 'log_id'],
                'date',
                'status',
                [col('challenge.title'), 'title'],
                [col('challenge.description'), 'description']
            ],
            include: [
                {
                    model: db.challengeParticipants,
                    as: 'participant',
                    required: true,
                    where: {
                        user_id,
                        status: 'active',
                        challenge_id: col('challenge_logs.challenge_id')
                    },
                    attributes: []
                },
                {
                    model: db.challenges,
                    as: 'challenge',
                    attributes: []
                }
            ],
            raw: true
        });

        res.status(200).json({ challenge: challenges });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Something went wrong" });
    }
}

async function markMissedChallenges(userId) {
    try {
        const logs = await db.challengeLogs.findAll(
            {
                where: {
                    user_id: userId,
                    status: 'remaining',
                    date: { [Op.lt]: today },
                },
                attributes: ['id', 'user_id'],
            }
        );
        if (logs.length === 0) {
            console.log(`No logs to mark as missed today for user ${userId}`);
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

        const missCount = logs.length;
        await addXP(userId, missCount * missedXP);

        console.log(`Marked ${missCount} challenge logs as missed for user ${userId} and deducted XP`);
    } catch (err) {
        console.log(err)
    }
}

async function activateScheduledChallenges() {
    try {
        const today = dayjs().format("YYYY-MM-DD");

        // Find challenges that start today and are still scheduled
        const scheduled = await db.challengeParticipants.findAll({
            where: {
                start_date: today,
                status: "scheduled",
            }
        });

        if (scheduled.length === 0) return;

        for (const ch of scheduled) {
            // Update status → active
            await ch.update({ status: "active" });

            // // 2️⃣ Create today's challenge log
            // await db.challengeLogs.findOrCreate({
            //     where: {
            //         user_id: ch.user_id,
            //         challenge_id: ch.challenge_id,
            //         date: today
            //     },
            //     defaults: {
            //         status: "remaining"
            //     }
            // });

            console.log(
                `Challenge ${ch.challenge_id} activated for user ${ch.user_id} `
            );
        }
    } catch (err) {
        console.error("Error activating scheduled challenges:", err);
    }
}

async function getPendingChallenges(userId = undefined) {
    return db.challengeLogs.findAll({
        where: {
            ...(userId && { user_id: userId }),
            status: "remaining",
            date: dayjs().format("YYYY-MM-DD")
        },
        include: [
            {
                model: db.challenges,
                as: "challenge",
                attributes: ["title"]
            }
        ]
    });
}



module.exports = { getLogs, getAllLogsOfChallenge, getLogById, getLogsOfUser, updateChallengeLog, todaysChallenges, markMissedChallenges, createDailyChallengeLogs, createMissingChallengeLogs, updateEndedChallenges, activateScheduledChallenges, getPendingChallenges }