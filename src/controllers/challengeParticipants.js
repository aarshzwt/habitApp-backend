require('dotenv').config();

const { col, Op } = require('sequelize');
const db = require("../models");
const challengeParticipants = db.challengeParticipants;
const { calculateStreak, calculateMaxStreak, addXP, newChallengeXP } = require('../utils/utilityFunctions');
const dayjs = require("dayjs");

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
        await addXP(user_id, newChallengeXP) // + Joining Challenge XP

        const participantUserIds = await db.challengeParticipants.findAll({
            where: {
                challenge_id,
                user_id: { [Op.ne]: user_id },   // exclude the new joiner
                status: "active",
            },
            attributes: ["user_id"],
            raw: true,
        });

        const ids = participantUserIds.map(p => p.user_id);

        if (ids.length > 0) {
            const webpush = req.app.get("webpush");

            // Fetch subscriptions of those users
            const subscriptions = await db.subscriptions.findAll({
                where: { user_id: ids }
            });

            const payload = JSON.stringify({
                title: "New Participant Joined!",
                body: "Someone just joined your challenge 🎉",
            });

            for (const sub of subscriptions) {
                webpush.sendNotification(
                    {
                        endpoint: sub.endpoint,
                        keys: { auth: sub.auth, p256dh: sub.p256dh }
                    },
                    payload
                ).catch(err => console.log("Push error:", err));
            }
        }

        if (start_date === today) {
            // Log today's participation
            await db.challengeLogs.create({
                challenge_id,
                user_id,
                date: today,
            });
        }

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

module.exports = { getChallengeParticipants, deleteParticipant, addParticipant, updateChallengeParticipant }
