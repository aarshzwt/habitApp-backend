require('dotenv').config();

const { col } = require('sequelize');
const db = require("../models");
const challengeParticipants = db.challengeParticipants;
const { calculateStreak, calculateMaxStreak } = require('../utils/utilityFunctions');


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
        // const participantsWithLogs = await Promise.all(
        //     participants.map(async (participant) => {
        //         const logs = await db.challengeLogs.findAll({
        //             where: {
        //                 user_id: participant.user_id,
        //                 challenge_id: challenge_id
        //             },
        //             raw: true
        //         });

        //         return {
        //             ...participant,
        //             logs
        //         };
        //     })
        // );

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

                return {
                    ...p,
                    logs,
                    streak,
                    maxStreak
                };
            })
        );

        return res.status(200).json({ participants: enrichedParticipants });

        // const data = { participants, info }
        // return res.status(200).json({ participants: participantsWithLogs })

    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: "server error" })
    }
}

async function deleteParticipant(req, res) {
    try {
        const id = req.params.id;
        const deletedParticipant = await challengeParticipants.update(
            { status: "retracted" },
            {
                where: { id },
            });
        return res.status(200).json({ message: "deleted successfulyy" });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: "server error" })
    }
}

async function addParticipant(req, res) {
    try {
        const id = req.params.challenege_id;
        const user_id = req.user;
        // const { startDate, endDate } = req.body;
        const start_date = new Date()
        const challengeData = {
            challenge_id: id,
            start_date: startDate,
            end_date: endDate,
            user_id
        }

        const joinChallenge = await challengeParticipants.create(challengeData);
        return res.status(200).json({ message: "Challenge joined succesfully" })
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: "server error" })
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

module.exports = { getChallengeParticipants, deleteParticipant, addParticipant, updateChallengeParticipant }
