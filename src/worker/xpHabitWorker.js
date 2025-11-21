const { Worker } = require("bullmq");
const db = require("../models");
const {
    calculateStreak,
    calculateAllLogCompletionStatus,
    addXP,
    habitLogXP,
    missedXP,
    WeeklyStreakXP,
    allLogsInDayXP
} = require("../utils/utilityFunctions");
const { connection } = require("../services/queue");

const xpHabitWorker = new Worker(
    "xpHabitQueue",
    async job => {
        const {
            user_id,
            habit_id,
            log_id,
            previousStatus,
            currentStatus
        } = job.data;

        const logs = await db.habitLogs.findAll({
            where: { user_id, habit_id },
            order: [["date", "DESC"]],
        });

        const oldStreak = await calculateStreak(logs);

        // Update new logs replacing current one
        const updatedLogs = logs.map(l =>
            l.id === log_id ? { ...l.toJSON(), status: currentStatus } : l.toJSON()
        );

        const newStreak = await calculateStreak(updatedLogs);

        // === XP Logic Moves Here ===

        if (currentStatus === "completed" && previousStatus !== "completed") {
            await addXP(user_id, habitLogXP);

            if (newStreak > 0 && newStreak % 7 === 0) {
                await addXP(user_id, WeeklyStreakXP);
            }

            const res = await calculateAllLogCompletionStatus(user_id);
            if (res.logsInaDay > 1 && res.completedlogsInaDay === res.logsInaDay) {
                await addXP(user_id, allLogsInDayXP);
            }
        }

        else if (currentStatus === "missed" && previousStatus === "completed") {
            await addXP(user_id, -habitLogXP + missedXP);

            const broke = oldStreak > newStreak && oldStreak % 7 === 0;
            if (broke) await addXP(user_id, -WeeklyStreakXP);

            const res = await calculateAllLogCompletionStatus(user_id);
            if (res.completedlogsInaDay === res.logsInaDay - 1) {
                await addXP(user_id, -allLogsInDayXP);
            }
        }

        else if (currentStatus === "remaining" && previousStatus === "missed") {
            await addXP(user_id, -missedXP);
        }

        return { oldStreak, newStreak };
    },
    { connection: connection }
);

xpHabitWorker.on("completed", job => {
    console.log(`[xpHabit Worker] Job: ${job.id} done`);
});

xpHabitWorker.on("failed", (job, err) => {
    console.error(`[xpHabit Worker] Job: ${job?.id} failed:`, err);
});

module.exports = xpHabitWorker;
