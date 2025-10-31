require('dotenv').config();

const { col } = require('sequelize');
const db = require("../models");
const challenge = db.challenges;
const challengeParticipants = db.challengeParticipants;
const { getPagination, getPagingData } = require('../utils/utilityFunctions');

async function getChallenges(req, res) {
    try {
        const user_id = req.id;
        const { page, limit } = req.query;
        const { _page, _limit, offset } = getPagination(page, limit);

        const { rows, count } = await challenge.findAndCountAll({
            offset,
            limit: _limit,
            include: [
                {
                    model: challengeParticipants,
                    as: "participants",
                    required: false,
                    where: { user_id },
                    attributes: ["status", "start_date", "end_date"],
                },
            ],
        });

        const formatted = rows.map((ch) => {
            const plain = ch.get({ plain: true });
            const participant = plain.participants?.[0] || null;

            return {
                id: plain.id,
                title: plain.title,
                description: plain.description,
                duration_days: plain.duration_days,
                category_id: plain.category_id,
                created_by: plain.created_by,
                joined: !!participant,
                ...(participant && {
                    status: participant.status,
                    startDate: participant.start_date,
                    endDate: participant.end_date,
                }),
            };
        });

        return res.status(200).json({
            challenges: formatted,
            ...getPagingData(count, _page, _limit),
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "server error" });
    }
}


async function getChallengeById(req, res) {
    try {
        const id = req.params.id;
        const challengeResponse = await challenge.findOne({
            where: { id },
            include: [{
                model: challengeParticipants,
                as: 'participants',
                attributes: ['id', 'start_date', 'end_date', 'status'],
                required: false,
                include: [{
                    model: db.users,
                    as: 'user',
                    required: true,
                    attributes: ['id', 'username', 'email', 'role']
                }],
            }]
        });
        return res.status(200).json({ challenge: challengeResponse })
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: "server error" });
    }
}

async function getChallengesByUser(req, res) {
    try {
        const user_id = req.id;
        const { page, limit } = req.query;
        const { _page, _limit, offset } = getPagination(page, limit);

        const status = req.query.status;
        const where = { user_id };
        if (status) where.status = status;

        const { rows, count } = await challengeParticipants.findAndCountAll({
            where,
            offset,
            limit: _limit,
            include: [
                {
                    model: challenge,
                    as: "challenge",
                    attributes: ["id", "title", "description", "duration_days", "habit_id"],
                    include: [
                        {
                            model: db.categories,
                            as: "category",
                            attributes: ["id", "name", "image"],
                        },
                        {
                            model: db.users,
                            as: "creator",
                            attributes: ["id", "username", "email", "role"],
                        },
                    ],
                },
            ],
            attributes: ["start_date", "end_date", "status"],
        });

        const formatted = rows.map((item) => ({
            ...item.challenge.get({ plain: true }),
            start_date: item.start_date,
            end_date: item.end_date,
            status: item.status,
        }));

        return res.status(200).json({
            challenges: formatted,
            ...getPagingData(count, _page, _limit),
        });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: "server error" });
    }
}

async function createChallenge(req, res) {
    try {
        const { title, description, duration_days, habit_id, category_id } = req.body;

        const challengeData = {
            title,
            description,
            duration_days,
            ...habit_id && { habit_id },
            ...category_id && { category_id },
            created_by: req.user.id
        }

        const newChallenge = await challenge.create(challengeData);
        return res.status(200).json({ challenge: newChallenge, message: "Challenge added successfully" })
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: "server error" })
    }
}

async function editOrDeleteChallenge(req, res) {
    try {
        const mode = req.params.mode
        const user_id = req.id;
        const id = req.params.challenge_id;

        const existingChallenge = await challenge.findOne({
            where: { id }
        })
        if (!existingChallenge) {
            return res.status(404).json({ message: "No challenge found" });
        } else if (existingChallenge.created_by !== user_id) {
            return res.status(403).json({ message: "Not Authorized" })
        }
        if (mode === "edit") {
            const { title, description, duration_days, habit_id, category_id } = req.body;

            const updatedChallengeData = {
                title,
                description,
                duration_days,
                ...habit_id && { habit_id },
                ...category_id && { category_id },
            }

            const updatedChallenge = await challenge.update(updatedChallengeData, {
                where: { id }
            });
            return res.status(200).json({ challenge: updatedChallenge, message: "Challenge updated successfully" })
        } else if (mode === "delete") {
            const deletedChallenge = await challenge.Delete({
                where: {
                    id
                }
            });
            return res.staus(200).json({ message: "Challenge Deleted Successfully" })
        }
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: "server error" })
    }
}
module.exports = { getChallenges, getChallengesByUser, getChallengeById, createChallenge, editOrDeleteChallenge }