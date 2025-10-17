const db = require("../models");
const HabitLogs = db.habitLogs;
const Users = db.users;

const newHabitXP = 5;
const habitLogXP = 10;
const streakXP = 20;
const allLogsInDayXP = 30;
const missedXP = -5;
// XP thresholds per level (simple linear)
function xpForLevel(level) {
    return 100 * level;
}

async function calculateAllLogCompletionStatus(user_id) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const logsInaDay = await db.habitLogs.findAll({
        where: {
            date: today,
            user_id,
        }
    });
    const completedlogsInaDay = logsInaDay.filter(l => l.status === "completed");
    return {
        logsInaDay: logsInaDay.length,
        completedlogsInaDay: completedlogsInaDay.length
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

async function weeklyCalculateStreak(logs, frequency_days) {
    let streak = 0;
    let today = new Date();
    today.setHours(0, 0, 0, 0);
    let currentDate = new Date(today);
    currentDate.setDate(currentDate.getDate() - frequency_days);
    let logIndex = 0;
    while (logIndex < logs.length) {
        const log = logs[logIndex];
        const logDate = new Date(log.date);
        logDate.setHours(0, 0, 0, 0);
        if (log.status === 'completed' && logDate.getTime() === currentDate.getTime()) {
            streak++;
            currentDate.setDate(currentDate.getDate() - frequency_days);
        } else if (logDate < currentDate) {
            logIndex++;
        } else {
            break;
        }
    }
    return streak;
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

module.exports = { addXP, calculateStreak, weeklyCalculateStreak, calculateMaxStreak, calculateAllLogCompletionStatus, newHabitXP, habitLogXP, streakXP, missedXP, allLogsInDayXP }