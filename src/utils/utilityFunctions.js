const dayjs = require("dayjs");
const db = require("../models");
const getWebPush = require("../config/vapid");
const Users = db.users;

const newHabitXP = 5;
const newChallengeXP = 5;

const habitLogXP = 10;
const challengeLogXP = 10;

const WeeklyStreakXP = 20;

const allLogsInDayXP = 30;

const missedXP = -5;

const webpush = getWebPush();

const jobOptions = {
    attempts: 5, // retry 5 times
    backoff: {
        type: "exponential",
        delay: 5000 // 5 seconds, then 10s, 20s, 40s...
    },
    removeOnComplete: true,
    removeOnFail: false, // keep failed jobs to inspect later
}

// XP thresholds per level (simple linear)
function xpForLevel(level) {
    return 100 * level;
}

async function calculateAllLogCompletionStatus(user_id) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const habitLogsInaDay = await db.habitLogs.findAll({
        where: {
            date: today,
            user_id,
        }
    });
    const challengeLogsInaDay = await db.challengeLogs.findAll({
        where: {
            date: today,
            user_id,
        }
    });
    const logsInaDay = habitLogsInaDay.length + challengeLogsInaDay.length;
    const completedlogsInaDay = habitLogsInaDay.filter(l => l.status === "completed").length + challengeLogsInaDay.filter(l => l.status === "completed").length

    return {
        logsInaDay,
        completedlogsInaDay
    }
}
// Calculate streak for a habit (consecutive completed days)
async function calculateStreak(logs) {
    let streak = 0;

    // Assuming logs are sorted with most recent first
    for (const log of logs) {
        if (log.status === 'completed') {
            streak++;
        } else {
            break; // stop at first non-completed log
        }
    }
    return streak;
}

async function weeklyCalculateStreak(logs, frequency_type, frequency_value, frequency_days) {
    // Get the start and end of the current week (Sunday → Saturday)
    const startOfWeek = dayjs().startOf('week').toDate();
    const endOfWeek = dayjs().endOf('week').toDate();

    // Filter logs for this week
    const thisWeekLogs = logs.filter(log => {
        const logDate = new Date(log.date);
        return logDate >= startOfWeek && logDate <= endOfWeek;
    });

    // Count how many are completed
    const completedCount = thisWeekLogs.filter(l => l.status === 'completed').length;

    let totalExpected = 0;

    // --- Determine how many logs were *expected* this week ---
    if (frequency_type === 'daily') {
        totalExpected = 7;
    }
    else if (frequency_type === 'every_x_days') {
        // Example: every 2 days → roughly 4 per week
        totalExpected = Math.ceil(7 / frequency_value);
    }
    else if (frequency_type === 'x_times_per_week' && Array.isArray(frequency_days)) {
        totalExpected = frequency_days.length;
    }

    // Whether user has completed all this week's expected logs
    const weekFullyCompleted = totalExpected > 0 && completedCount >= totalExpected;

    return {
        completedCount,
        totalExpected,
        weekFullyCompleted
    };
}


async function calculateMaxStreak(logs) {
    logs.sort((a, b) => new Date(a.date) - new Date(b.date));

    let maxStreak = 0;
    let currentStreak = 0;

    for (const log of logs) {
        if (log.status === "completed") {
            currentStreak++;
            maxStreak = Math.max(maxStreak, currentStreak);
        } else {
            currentStreak = 0; // reset when streak breaks
        }
    }

    return maxStreak;
}



// Add XP and handle level up
async function addXP(id, amount) {
    try {
        const user = await Users.findByPk(id);
        if (!user) throw new Error("User not found");

        let currentXP = user.currentXP + amount;
        let totalXP = user.totalXP + amount;
        let level = user.level;

        while (currentXP >= xpForLevel(level)) {
            currentXP -= xpForLevel(level);
            level++;
        }

        await user.update({ currentXP, totalXP, level });
    } catch (err) {
        console.log(err);
    }
}

const getPagination = (page, limit) => {
    const _page = Math.max(parseInt(page) || 1, 1);
    const _limit = Math.max(parseInt(limit) || 10, 1);
    const offset = (_page - 1) * _limit;

    return { _page, _limit, offset };
};

const getPagingData = (count, page, itemsPerPage) => ({
    pagination: {
        total: count,
        page,
        itemsPerPage,
        totalPages: Math.ceil(count / itemsPerPage),
    }
});

function buildHabitReminderMessage(habits) {
    const names = habits.map(h => h.habit.title);

    return {
        title: "⏰ Habit Reminder",
        body: `You still have pending habits: ${names.join(", ")}.`
    };
}

function buildChallengeReminderMessage(challenges) {
    const names = challenges.map(c => c.challenge.title);

    return {
        title: "🔥 Challenge Reminder",
        body: `You still have pending challenge tasks: ${names.join(", ")}.`
    };
}

async function sendCategoryNotification(userId, payload) {
    const subscriptions = await db.subscriptions.findAll({
        where: { user_id: userId }
    });

    if (!subscriptions.length) {
        return false;
    }

    for (const sub of subscriptions) {
        webpush.sendNotification(
            {
                endpoint: sub.endpoint,
                keys: { auth: sub.auth, p256dh: sub.p256dh }
            },
            payload
        ).catch(async err => {
            if (err.statusCode === 410 || err.statusCode === 404) {
                await db.subscriptions.destroy({ where: { id: sub.id } });
            }
            return false;
        });
    }
    return true;
}


module.exports = {
    addXP,
    calculateStreak,
    weeklyCalculateStreak,
    calculateMaxStreak,
    calculateAllLogCompletionStatus,
    getPagination,
    getPagingData,
    buildHabitReminderMessage,
    buildChallengeReminderMessage,
    sendCategoryNotification,
    newHabitXP, habitLogXP, newChallengeXP, challengeLogXP, WeeklyStreakXP, missedXP, allLogsInDayXP, jobOptions
}