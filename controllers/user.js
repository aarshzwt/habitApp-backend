require('dotenv').config();

const db = require("../models");
const { calculateStreak } = require('../utils/utilityFunctions');
const Habits = db.habits;
const HabitLogs = db.habitLogs;
const Users = db.users;

async function getUserStats(req, res) {
    try {
        const id = req.id;
        const user = await Users.findByPk(id);
        if (!user) return res.status(404).json({ message: "User not found" });

        const habits = await Habits.findAll({ where: { user_id: id } });

        const streaks = await Promise.all(
            habits.map(async (habit) => {
                const logs = await HabitLogs.findAll({
                    where: { user_id: id, habit_id: habit.id },
                    order: [['date', 'DESC']],
                });
                const streak = await calculateStreak(logs);

                return {
                    habitId: habit.id,
                    title: habit.title,
                    streak,
                };
            })
        );

        const data = {
            username: user.username,
            email: user.email,
            currentXP: user.currentXP,
            totalXP: user.totalXP,
            level: user.level,
            streaks,
        }

        return res.status(200).json({ data });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Error fetching user stats" });
    }
};

async function editOrDeleteUser(req, res) {
    const mode = req.body.mode;
    const formData = req.body.formData;

    // const user_id = req.id;
    const id = req.params.id;
    if (!id) {
        return res.status(400).json({ message: "id not provided" });
    }
    try {
        if (mode === "edit") {
            const updated = await Users.update(
                { ...formData },
                {
                    where: {
                        id
                    }
                }
            );
            console.log(updated);
            return res.status(500).json({ message: "updation successfull" })
        }
        else if (mode === "delete") {
            const deleted = await Users.Delete({
                where: {
                    id
                }
            });
            console.log(deleted);
            return res.status(500).json({ message: "deletion successfull" })
        }
    } catch (err) {
        console.log(err);
        return res.status(500).json({ message: "server error" })
    }
}

async function getLeaderboard(req, res) {
    try {
        const users = await Users.findAll({
            order: [['level', 'DESC'], ['totalXP', 'DESC']],
            take: 10
        })
        return res.status(200).json({ users })
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Error fetching user leaderboard" });
    }

}

module.exports = { getUserStats, getLeaderboard }