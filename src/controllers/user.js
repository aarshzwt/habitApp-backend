require('dotenv').config();

const db = require("../models");


async function getUserStats(req, res) {
    try {
        const id = req.id;
        const user = await db.users.findByPk(id);
        if (!user) return res.status(404).json({ message: "User not found" });

        const data = {
            username: user.username,
            email: user.email,
            currentXP: user.currentXP,
            totalXP: user.totalXP,
            level: user.level,
            timezone: user.timezone
        }

        return res.status(200).json({ data });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Error fetching user stats" });
    }
};
async function editOrDeleteUser(req, res) {
    const id = req.params.id;

    if (!id) {
        return res.status(400).json({ error: "id not provided" })
    }
    const user = await db.users.findOne({ where: { id } })
    if (!user) {
        return res.status(404).json({ error: "User not found" })
    }
    if (!req.body) {
        return res.status(400).json({ error: "Mode is required" })
    }
    let { mode, ...body } = req.body;

    if (mode === "edit") {
        try {
            await db.users.update(
                { ...body },
                { where: { id } }
            );
            return res.status(200).json({ message: "User Updated" })

        } catch (err) {
            console.log(err);
            return res.status(500).json({ error: err })
        }
    } else if (mode === "delete") {
        try {
            await db.users.Delete(
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


async function getLeaderboard(req, res) {
    try {
        const users = await db.users.findAll({
            order: [['level', 'DESC'], ['totalXP', 'DESC'], ['currentXP', 'DESC']],
            take: 10
        })
        return res.status(200).json({ users })
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Error fetching user leaderboard" });
    }

}

module.exports = { getUserStats, getLeaderboard, editOrDeleteUser }