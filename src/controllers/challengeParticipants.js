require('dotenv').config();

const { col, Op } = require('sequelize');
const db = require("../models");
const challengeParticipants = db.challengeParticipants;
const { calculateStreak, calculateMaxStreak, addXP, newChallengeXP } = require('../utils/utilityFunctions');
const dayjs = require("dayjs");
const { participantQueue } = require('../services/queue');

const today = dayjs().format("YYYY-MM-DD");

async function getChallengeParticipants(req, res) {
    try {
        const challenge_id = req.params.challenge_id;
        const participants = await challengeParticipants.findAll({
            where: {
                challenge_id
            },
            include: [{
                model: db.users,
                as: 'user',
                attributes: []
            }],
            attributes: ['id', 'start_date', 'end_date', 'status', [col('user.id'), 'user_id'], [col('user.username'), 'username']],
            raw: true
        })

        const allLogs = await db.challengeLogs.findAll({
            where: { challenge_id },
            raw: true
        });

        const logsByUser = allLogs.reduce((acc, log) => {
            if (!acc[log.user_id]) acc[log.user_id] = [];
            acc[log.user_id].push(log);
            return acc;
        }, {});

        const enrichedParticipants = await Promise.all(
            participants.map(async (p) => {
                const logs = (logsByUser[p.user_id] || [])
                    .sort((a, b) => new Date(b.date) - new Date(a.date)); // latest first

                const streak = await calculateStreak(logs);
                const maxStreak = await calculateMaxStreak([...logs]);
                const completedDays = logs.filter(l => l.status === "completed").length;
                const totalDays = logs.length || p.duration_days || 0;

                const completionRate = totalDays === 0
                    ? 0
                    : Math.round((completedDays / totalDays) * 100);

                return {
                    ...p,
                    logs,
                    streak,
                    maxStreak,
                    completedDays,
                    totalDays,
                    completionRate
                };
            })
        );

        return res.status(200).json({ participants: enrichedParticipants });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: "server error" })
    }
}

async function addParticipant(req, res) {
    try {
        const challenge_id = req.params.challenge_id;
        const user_id = req.id;
        const { duration, start_date } = req.body;
        let status = "active";
        if (!start_date) {
            return res.status(400).json({ error: "Start date is required" });
        }

        const startDateObj = new Date(start_date);
        const endDateObj = new Date(startDateObj);
        endDateObj.setDate(startDateObj.getDate() + ((duration - 1) || 0));

        if (start_date > today) {
            status = "scheduled"
        }

        const joinChallenge = await db.challengeParticipants.create({
            challenge_id,
            user_id,
            start_date: startDateObj,
            end_date: endDateObj,
            status,
        });

        // Push job to Redis queue
        participantQueue.add("newParticipant", {
            challenge_id,
            user_id,
            today,
            start_date
        });

        return res.status(200).json({
            message: "Challenge joined successfully",
            participant: joinChallenge,
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Server error" });
    }
}

async function deleteParticipant(req, res) {
    try {
        const challenge_id = req.params.challenge_id
        const user_id = req.id;

        const retracted_date = today;

        const participant = await challengeParticipants.findOne({
            where: { challenge_id, user_id, status: { [Op.ne]: 'retracted' } },
        })

        if (!participant) {
            return res.status(404).json({ error: 'Participant not found or already left' })
        }

        await participant.update({
            status: 'retracted',
            retracted_date,
        })

        return res.status(200).json({ message: 'Left challenge successfully' })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ error: 'Server error' })
    }
}

async function updateChallengeParticipant(req, res) {
    try {
        const challenge_id = req.params.challenge_id;
        const user_id = req.user;
        const { status } = req.body;

        const challengeStatus = await challengeParticipants.update({ status }, {
            where: {
                challenge_id, user_id
            }
        })
        return res.status(200).json({ message: "updation succesfull" })
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: "server error" });
    }
}

async function getChallengeStats(req, res) {
    try {
        const challenge_id = req.params.id;

        // Fetch all participants
        const participants = await db.challengeParticipants.findAll({
            where: { challenge_id },
            include: [
                { model: db.users, as: "user", attributes: ["id", "username"] }
            ],
            raw: true
        });

        if (!participants.length)
            return res.json({ message: "No participants yet." });

        // Fetch all logs
        const logs = await db.challengeLogs.findAll({
            where: { challenge_id },
            raw: true
        });

        // Group logs by user
        const logsByUser = logs.reduce((acc, log) => {
            if (!acc[log.user_id]) acc[log.user_id] = [];
            acc[log.user_id].push(log);
            return acc;
        }, {});

        // Helper: compute streak
        const calculateStreak = (logs) => {
            let streak = 0;
            for (let log of logs) {
                if (log.status === "completed") streak++;
                else break;
            }
            return streak;
        };

        // Helper: longest streak
        const calculateMaxStreak = (logs) => {
            let max = 0, temp = 0;
            for (let log of logs) {
                if (log.status === "completed") {
                    temp++;
                    max = Math.max(max, temp);
                } else temp = 0;
            }
            return max;
        };

        // Stats calculation per participant
        const stats = participants.map((p) => {
            const userLogs = (logsByUser[p.user_id] || [])
                .sort((a, b) => new Date(b.date) - new Date(a.date));

            const completedDays = userLogs.filter(l => l.status === "completed").length;
            const totalDays = userLogs.length || p.duration_days || 0;

            const completionRate = totalDays === 0
                ? 0
                : Math.round((completedDays / totalDays) * 100);

            return {
                user_id: p.user_id,
                username: p["user.username"],
                streak: calculateStreak([...userLogs]),
                maxStreak: calculateMaxStreak([...userLogs]),
                completedDays,
                totalDays,
                completionRate
            };
        });

        // Leaderboard: Top 10 by streak -> completion -> max streak
        const leaderboard = [...stats]
            .sort((a, b) => (
                b.streak - a.streak ||
                b.completionRate - a.completionRate ||
                b.maxStreak - a.maxStreak
            ))
            .slice(0, 10);

        // Overall stats
        const totalParticipants = participants.length;
        const avgCompletion = Math.round(
            stats.reduce((sum, s) => sum + s.completionRate, 0) / totalParticipants
        );

        const avgStreak = Math.round(
            stats.reduce((sum, s) => sum + s.streak, 0) / totalParticipants
        );

        // Daily completion stats (ex: { "2025-01-01": 12 })
        const dailyStats = logs.reduce((acc, log) => {
            if (!acc[log.date]) acc[log.date] = 0;
            if (log.status === "completed") acc[log.date]++;
            return acc;
        }, {});

        // Weekly stats (Sun-Sat)
        const weeklyStats = {};
        logs.forEach(log => {
            const week = getWeekNumber(new Date(log.date));
            if (!weeklyStats[week]) weeklyStats[week] = { completed: 0, total: 0 };
            weeklyStats[week].total++;
            if (log.status === "completed") weeklyStats[week].completed++;
        });

        return res.status(200).json({
            leaderboard,
            overall: {
                totalParticipants,
                avgCompletion,
                avgStreak,
            },
            dailyStats: dailyStats,
            weeklyStats,
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "server error" });
    }
}

// Helper: ISO week number
function getWeekNumber(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = date.getUTCDay() - 1;
    date.setUTCDate(date.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((date - yearStart) / 86400000 / 7);
}

module.exports = { getChallengeParticipants, deleteParticipant, addParticipant, updateChallengeParticipant, getChallengeStats }
