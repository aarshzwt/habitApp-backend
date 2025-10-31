require('dotenv').config();

const db = require("../models");
const Habits = db.habits;
const HabitLogs = db.habitLogs;
const Users = db.users;
// XP thresholds per level (simple linear)
function xpForLevel(level) {
    return 100 * level;
}

// Calculate streak for a habit (consecutive completed days)
async function calculateStreak(user_id, habit_id) {
    const logs = await HabitLogs.findAll({
        where: { user_id, habit_id },
        order: [['date', 'DESC']],
    });

    let streak = 0;
    let today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const log of logs) {
        const logDate = new Date(log.date);
        logDate.setHours(0, 0, 0, 0);

        if (log.status !== 'completed') break;

        const expectedDate = new Date(today);
        expectedDate.setDate(today.getDate() - streak);
        if (logDate.getTime() !== expectedDate.getTime()) break;

        streak++;
    }

    return streak;
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

// Triggered when user completes a habit log
async function completeHabitLog(req, res) {
    try {
        const { userId, habitId, date } = req.body;

        const [log, created] = await HabitLogs.findOrCreate({
            where: { userId, habitId, date },
            defaults: { status: "completed" },
        });

        if (!created) {
            await log.update({ status: "completed" });
        }

        // XP for habit completion
        await addXP(userId, 10, "Habit completed");

        // Check streak
        const streak = await calculateStreak(userId, habitId);

        if (streak > 0 && streak % 7 === 0) {
            await addXP(userId, 20, `7-day streak!`);
        }

        return res.status(200).json({ message: "Habit log completed", streak });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Error completing habit log" });
    }
};

// Triggered when a user creates a habit
async function createHabit(req, res) {
    try {
        const { userId, title, startDate, endDate } = req.body;

        const habit = await Habits.create({ userId, title, startDate, endDate });

        await addXP(userId, 5);

        return res.status(201).json({ message: "Habit created", habit });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Error creating habit" });
    }
};

// Get user XP, level, and streaks
async function getUserStats(req, res) {
    try {
        const userId = req.params.userId;
        const user = await Users.findByPk(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        const habits = await Habits.findAll({ where: { userId } });

        const streaks = await Promise.all(
            habits.map(async (habit) => {
                const streak = await calculateStreak(userId, habit.id);
                return {
                    habitId: habit.id,
                    title: habit.title,
                    streak,
                };
            })
        );

        return res.status(200).json({
            xp: user.currentXP,
            totalXP: user.totalXP,
            level: user.level,
            streaks,
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Error fetching user stats" });
    }
};

module.exports = { addXP, calculateStreak, completeHabitLog, createHabit, getUserStats }