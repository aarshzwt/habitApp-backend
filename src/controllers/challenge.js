require('dotenv').config();

const { Op } = require('sequelize');
const db = require("../models");
const challenge = db.challenges;
const challengeParticipants = db.challengeParticipants;
const { getPagination, getPagingData } = require('../utils/utilityFunctions');

async function getChallenges(req, res) {
    try {
        const user_id = req.id;
        const { page, limit, category_id, min_duration_value, max_duration_value, search, recommended } = req.query;

        const { _page, _limit, offset } = getPagination(page, limit);
        const where = {};

        if (category_id) where.category_id = Number(category_id);
        if (min_duration_value) where.duration_days = { ...where.duration_days, [Op.gte]: Number(min_duration_value) };
        if (max_duration_value) where.duration_days = { ...where.duration_days, [Op.lte]: Number(max_duration_value) };

        if (search) {
            where[Op.or] = [
                { title: { [Op.like]: `%${search}%` } },
                { description: { [Op.like]: `%${search}%` } }
            ];
        }

        if (recommended === "true") {
            where[Op.and] = [
                db.sequelize.literal(`
                    NOT EXISTS (
                        SELECT 1 
                        FROM challenge_participants cp
                        WHERE cp.challenge_id = challenges.id
                        AND cp.user_id = ${user_id}
                    )`
                )
            ];
        }

        const { rows, count } = await challenge.findAndCountAll({
            where,
            offset,
            limit: _limit,
            distinct: true,
            include: [
                {
                    model: challengeParticipants,
                    as: "participants",
                    required: false,
                    attributes: ["id", "user_id", "status", "start_date", "end_date"],
                },
                {
                    model: db.categories,
                    as: 'category',
                    required: false,
                    attributes: ['name'],
                }
            ]
        });

        const formatted = rows.map((ch) => {
            const plain = ch.get({ plain: true });
            const participant = plain.participants?.filter(p => p.user_id === user_id) || null;

            return {
                id: plain.id,
                title: plain.title,
                description: plain.description,
                duration_days: plain.duration_days,
                category: plain.category?.name,
                created_by: plain.created_by,
                joined: participant.length,
                ...(participant.length && {
                    status: participant[0].status,
                    startDate: participant[0].start_date,
                    endDate: participant[0].end_date,
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
            include: [
                {
                    model: challengeParticipants,
                    as: "participants",
                    required: false,
                    attributes: [
                        "id",
                        "start_date",
                        "end_date",
                        "status",
                        [db.sequelize.literal('`participants->user`.`id`'), 'user_id'],
                        [db.sequelize.literal('`participants->user`.`username`'), 'username'],
                        [db.sequelize.literal('`participants->user`.`email`'), 'email'],
                        [db.sequelize.literal('`participants->user`.`role`'), 'role'],
                    ],
                    include: [
                        {
                            model: db.users,
                            as: "user",
                            attributes: [],
                        },
                    ],
                },
                {
                    model: db.categories,
                    as: 'category',
                    required: false,
                    attributes: ['name'],
                }
            ],
        });

        if (!challengeResponse) {
            return res.status(404).json({ error: "Challenge not found" });
        }

        // Convert to plain object
        const plain = challengeResponse.get({ plain: true });

        // Replace category object -> category string
        plain.category_id = plain.category?.name || null;

        return res.status(200).json({ challenge: plain });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: "server error" });
    }
}


async function getChallengesByUser(req, res) {
    try {
        const user_id = req.id;
        const { page, limit, status } = req.query;
        const { _page, _limit, offset } = getPagination(page, limit);

        const where = { user_id };
        if (status === "active") {
            where.status = { [Op.in]: ["active", "scheduled"] };
        } else if (status === "past") {
            where.status = { [Op.notIn]: ["active", "scheduled"] }; // everything except active and scheduled
        }
        const { rows, count } = await challengeParticipants.findAndCountAll({
            where,
            offset,
            limit: _limit,
            include: [
                {
                    model: challenge,
                    as: "challenge",
                    attributes: ["id", "title", "description", "duration_days", [db.sequelize.literal('`challenge->creator`.`id`'), 'created_by'],
                        [db.sequelize.literal('`challenge->category`.`name`'), 'categoryName'],
                    ],
                    include: [
                        { model: db.categories, as: "category", attributes: [] },
                        { model: db.users, as: "creator", attributes: [] },
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
        console.log(err)
        return res.status(500).json({ error: "server error" });
    }
}

async function createChallenge(req, res) {
    try {
        const user_id = req.id
        const { title, description, duration_days, habit_id, category_id } = req.body;

        const challengeData = {
            title,
            description,
            duration_days,
            ...habit_id && { habit_id },
            ...category_id && { category_id },
            created_by: user_id
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