const { calculateMaxStreak, calculateStreak } = require("../utils/utilityFunctions.js");

const db = require("../models");
const { Op } = require("sequelize");

async function getHabitStats(habitId, userId, from, to) {
    const logs = await db.habitLogs.findAll({
        where: {
            habit_id: habitId,
            user_id: userId,
            date: { [Op.between]: [from, to] }
        },
        order: [["date", "ASC"]]
    });

    const habit = await db.habits.findOne({
        where: {
            id: habitId
        }
    })

    const total = logs.length;
    const completedLogs = logs.filter(l => l.status === "completed");
    const completed = completedLogs.length;
    const missed = total - completed;

    // ---------- Weekday analysis ----------
    const weekdayStats = {
        Mon: { total: 0, missed: 0 },
        Tue: { total: 0, missed: 0 },
        Wed: { total: 0, missed: 0 },
        Thu: { total: 0, missed: 0 },
        Fri: { total: 0, missed: 0 },
        Sat: { total: 0, missed: 0 },
        Sun: { total: 0, missed: 0 }
    };

    for (const log of logs) {
        const day = new Date(log.date).toLocaleDateString("en-US", {
            weekday: "short"
        });
        weekdayStats[day].total++;
        if (log.status !== "completed") {
            weekdayStats[day].missed++;
        }
    }

    // ---------- Miss clusters ----------
    let longestMissStreak = 0;
    let currentMissStreak = 0;

    for (const log of logs) {
        if (log.status !== "completed") {
            currentMissStreak++;
            longestMissStreak = Math.max(longestMissStreak, currentMissStreak);
        } else {
            currentMissStreak = 0;
        }
    }

    const streak = await calculateStreak(logs);
    const maxStreak = await calculateMaxStreak(logs);

    return {
        habitInfo: habit,
        period: { from, to },
        totals: {
            total,
            completed,
            missed,
            successRate: total ? Math.round((completed / total) * 100) : 0
        },
        streaks: {
            current: streak,
            longest: maxStreak,
            longestMissStreak
        },
        weekdayStats
    };
}

async function getChallengeStats(challengeId, userId, from, to) {
    const logs = await db.challengeLogs.findAll({
        where: {
            user_id: userId,
            challenge_id: challengeId,
            date: { [Op.between]: [from, to] }
        },
        order: [['date', 'ASC']]
    });

    const challenge = await db.challengeParticipants.findOne({
        where: {
            challenge_id: challengeId,
            user_id: userId
        },
        include: [{
            model: db.challenges,
            as: "challenge",
            require: true,
        }]
    })

    const total = logs.length;
    const completedLogs = logs.filter(l => l.status === "completed");
    const completed = completedLogs.length;
    const missed = total - completed;

    // ---------- Weekday analysis ----------
    const weekdayStats = {
        Mon: { total: 0, missed: 0 },
        Tue: { total: 0, missed: 0 },
        Wed: { total: 0, missed: 0 },
        Thu: { total: 0, missed: 0 },
        Fri: { total: 0, missed: 0 },
        Sat: { total: 0, missed: 0 },
        Sun: { total: 0, missed: 0 }
    };

    for (const log of logs) {
        const day = new Date(log.date).toLocaleDateString("en-US", {
            weekday: "short"
        });
        weekdayStats[day].total++;
        if (log.status !== "completed") {
            weekdayStats[day].missed++;
        }
    }

    const streak = await calculateStreak(logs);
    const maxStreak = await calculateMaxStreak(logs);

    // ---------- Miss clusters ----------
    let longestMissStreak = 0;
    let currentMissStreak = 0;

    for (const log of logs) {
        if (log.status !== "completed") {
            currentMissStreak++;
            longestMissStreak = Math.max(longestMissStreak, currentMissStreak);
        } else {
            currentMissStreak = 0;
        }
    }

    return {
        challengeInfo: challenge,
        period: { from, to },
        logs: {
            total,
            completed,
            missed,
            successRate: total ? Math.round((completed / total) * 100) : 0
        },
        streak: {
            current: streak,
            longest: maxStreak,
            longestMissStreak
        },
        weekdayStats
    }
}


module.exports = { getHabitStats, getChallengeStats }
