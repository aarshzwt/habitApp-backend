require('dotenv').config();

const { where } = require('sequelize');
const db = require("../models");
const { newHabitXP, calculateStreak, calculateMaxStreak, weeklyCalculateStreak, getPagination, getPagingData } = require('../utils/utilityFunctions');
const { addXP } = require('./stats');
const habits = db.habits
const habitLogs = db.habitLogs
const habitTemplates = db.habitTemplates;
const dayjs = require('dayjs')

async function createHabit(req, res) {
    try {
        const user_id = req.id
        let { title, description, frequency_type, category_id, is_archived = false, frequency_value, frequency_days, start_date, end_date = null, template } = req.body;
        console.log(is_archived)

        const habit = await habits.create({ user_id, title, description, frequency_type, category_id, is_archived, frequency_value, frequency_days, start_date, end_date })
        await addXP(user_id, newHabitXP);
        if (start_date === new Date().toISOString().split("T")[0]) {
            await habitLogs.create({ user_id, habit_id: habit.id, date: start_date, status: "remaining" })
        }

        if (template) {
            const habitTemplate = await habitTemplates.create({ title, description, frequency_type, frequency_value, frequency_days, category_id, createdBy: user_id });
        }
        return res.json({ status: 200, message: "Habit added successfully" });
    } catch (error) {
        console.log(error)
        return res.status(500).json({ error: error });
    }
}

async function editOrDeleteHabit(req, res) {
    const user_id = req.id;
    const id = req.params.id;

    if (!id) {
        return res.status(400).json({ error: "id not provided" })
    }
    const habit = await habits.findOne({ where: { id } })
    if (!habit) {
        return res.status(404).json({ error: "Habit not found" })
    }
    if (!req.body) {
        return res.status(400).json({ error: "Mode is required" })
    }
    let { mode, ...body } = req.body;

    if (mode === "edit") {
        try {
            await habits.update(
                { ...body },
                {
                    where: {
                        id, user_id
                    }
                }
            );
            return res.status(200).json({ message: "Habit Updated" })

        } catch (err) {
            console.log(err);
            return res.status(500).json({ error: err })
        }
    } else if (mode === "delete") {
        try {
            await habits.update({ is_archived: true },
                {
                    where: {
                        id, user_id
                    }
                }
            );
            return res.status(200).json({ message: "Habit Deleted successfully" })
        } catch (err) {
            console.log(err);
            return res.status(500).json({ message: "Server Error" })
        }
    }
}

async function getHabits(req, res) {
    try {
        const habitsRes = await habits.findAll()
        return res.status(200).json({ habits: habitsRes });
    } catch (error) {
        console.log(error)
        return res.status(500).json({ error: error });
    }
}
async function getHabitById(req, res) {
    const id = req.params.id;
    const user_id = req.id;

    const today = new Date();
    const dayOfWeek = today.getDay();

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    try {
        if (!id) {
            return res.status(400).json({ error: "Id not provided" });
        }
        const habit = await habits.findOne({
            where: { id, user_id },
            attributes: ['id', 'title', 'description', 'frequency_type', 'frequency_value', 'frequency_days', 'category_id', 'start_date', 'end_date'],
        });
        if (!habit) {
            return res.status(404).json({ error: "Habit not found" });
        }

        const logs = await habitLogs.findAll({
            where: {
                habit_id: id,
                user_id,
            },
            attributes: ['id', 'date', 'status'],
            order: [['date', 'DESC']],
        });

        let weeklyStats = {}
        if (!habit.end_date || habit.end_date > dayjs().format('YYYY-MM-DD')) {
            // Get number of due days for "every_x_days" in this week
            function countDueDaysEveryXDays(habit, startOfWeek, endOfWeek) {
                const dueDates = [];
                const habitStart = new Date(habit.start_date);
                let current = new Date(habitStart);

                while (current <= endOfWeek) {
                    if (current >= startOfWeek && current <= endOfWeek) {
                        dueDates.push(new Date(current));
                    }
                    current.setDate(current.getDate() + habit.frequency_value);
                }
                return dueDates;
            }

            const weeklyLogs = logs.filter(log => {
                const logDate = new Date(log.date);
                return logDate >= startOfWeek && logDate <= endOfWeek;
            });
            const weeklyMissed = weeklyLogs.filter(log => log.status === "missed").length;
            const weeklyCompleted = weeklyLogs.filter(log => log.status === "completed").length;
            const weeklyRemaining = weeklyLogs.filter(log => log.status === "remaining").length;
            let daysToGo = null;
            if (habit.frequency_type === "x_times_per_week") {
                daysToGo = habit.frequency_value - weeklyCompleted;
            } else if (habit.frequency_type === "every_x_days") {
                const dueDays = countDueDaysEveryXDays(habit, startOfWeek, endOfWeek);
                daysToGo = dueDays.length - weeklyCompleted;
            } else if (habit.frequency_type === "daily") {
                daysToGo = 7 - weeklyCompleted
            }
            weeklyStats = {
                missed: weeklyMissed,
                completed: weeklyCompleted,
                remaining: weeklyRemaining,
                daysToGo
            }
            console.log(weeklyStats)
        }

        const streak = await calculateStreak(logs);
        const maxStreak = await calculateMaxStreak(logs);
        const total_logs = logs.length;
        const completed = logs.filter(log => log.status === 'completed').length;
        const missed = logs.filter(log => log.status === 'missed').length;
        const remaining = logs.filter(log => log.status === 'remaining').length;
        const completion_rate = total_logs > 0 ? Math.round((completed / total_logs) * 100) : 0;

        return res.json({
            habit: habit,
            logs: logs,
            ...(weeklyStats && weeklyStats),
            stats: {
                total_logs,
                completed,
                missed,
                remaining,
                completion_rate,
                streak,
                maxStreak
            },
        });

    } catch (error) {
        console.error("Error in getHabitById:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}
// async function getHabitById(req, res) {

//     const id = req.params.id;
//     const user_id = req.id;
//     try {
//         if (!id) {
//             return res.status(400).json({ message: "Id not provided" });
//         }
//         const habit = await habits.findAll({
//             where: { id },
//         })
//         console.log(habit)
//         // const logs = await db.habitLogs.findAll({
//         //     where:{
//         //         habit_id: id,
//         //         user_id
//         //     }
//         // })
//         // console.log(logs);
//         return res.status(200).json({ habit });
//     } catch (error) {
//         console.log(error)
//         return res.status(500).json({ error: error });
//     }
// }

async function getHabitsByUser(req, res) {
    const user_id = req.id;
    const { page, limit } = req.query;
    const { _page, _limit, offset } = getPagination(page, limit);
    
    try {
        const { rows, count } = await habits.findAndCountAll({
            offset,
            limit: _limit,
            where: { user_id, is_archived: false }
        })
        return res.status(200).json({
            habits: rows,
            ...getPagingData(count, _page, _limit),
        });
    } catch (error) {
        console.log(error)
        return res.status(500).json({ error: error });
    }
}

module.exports = { createHabit, getHabits, getHabitById, getHabitsByUser, editOrDeleteHabit }