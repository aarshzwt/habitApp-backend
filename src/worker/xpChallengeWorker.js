const { Worker } = require("bullmq");
const db = require("../models");
const {
    calculateStreak,
    calculateAllLogCompletionStatus,
    addXP,
    missedXP,
    WeeklyStreakXP,
    allLogsInDayXP,
    challengeLogXP
} = require("../utils/utilityFunctions");
const { connection } = require("../services/queue");
// const dayjs = require("dayjs");

const xpChallengeWorker = new Worker(
    "challengeXPQueue",
    async job => {
        const {
            user_id,
            challenge_id,
            log_id,
            previousStatus,
            currentStatus
        } = job.data;

        // Get all logs for this user's challenge
        const logs = await db.challengeLogs.findAll({
            where: { user_id, challenge_id },
            order: [['date', 'DESC']],
        });

        // Calculate Old Streaks
        const oldStreak = await calculateStreak(logs);

        // Update new logs replacing current one
        const updatedLogs = logs.map(l =>
            l.id === log_id ? { ...l.toJSON(), status: currentStatus } : l.toJSON()
        );

        const newStreak = await calculateStreak(updatedLogs);

        // === XP Logic Moves Here ===

        // XP for challenge completion
        if (currentStatus === "completed" && previousStatus !== "completed") {
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
        else if (currentStatus === "missed" && previousStatus === "completed") {
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
        else if (currentStatus === "remaining" && previousStatus === "missed") {
            await addXP(user_id, -missedXP);
        }

        return { oldStreak, newStreak };
    },
    { connection: connection }
);

xpChallengeWorker.on("completed", job => {
    console.log(`[xpChallenge Worker] Job: ${job.id} done`);
});

xpChallengeWorker.on("failed", (job, err) => {
    console.error(`[xpChallenge Worker] Job: ${job?.id} failed:`, err);
});

module.exports = xpChallengeWorker;
