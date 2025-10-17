require('dotenv').config();

const { col } = require('sequelize');
const db = require("../models");
const challenge = db.challenges;
const challengeParticipants = db.challengeParticipants;

async function getChallenges(req, res) {
    try {
        const user_id = req.id;
        const challenges = await challenge.findAll({
            include: [
                {
                    model: challengeParticipants,
                    as: "participants",
                    required: false,
                    where: { user_id },
                    attributes: ["status", "start_date", "end_date"]
                }
            ]
        });

        // simplify the response
        const formatted = challenges.map(ch => {
            const plain = ch.get({ plain: true });
            const participant = plain.participants?.[0] || null;

            return {
                id: plain.id,
                title: plain.title,
                description: plain.description,
                duration_days: plain.duration_days,
                category_id: plain.category_id,
                created_by: plain.created_by,
                // new flattened field
                joined: !!participant,
                ...(participant && { joinStatus: participant.status }),
                ...(participant && { joinStartDate: participant.start_date }),
                ...(participant && { joinEndDate: participant.end_date }),
            }
        });

        return res.status(200).json({ challenges: formatted });
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
        const userChallenges = await challengeParticipants.findAll({
            where: {
                user_id,
            },
            attributes: ['challenge_id']
        })
        let challenges = [];
        for (const chlng of userChallenges) {
            const currentChallenge = await challenge.findOne({
                where: { id: chlng.challenge_id },
                attributes: [
                    'id',
                    'title',
                    'description',
                    'duration_days',
                    'habit_id',
                    [col('participants.start_date'), 'start_date'],
                    [col('participants.end_date'), 'end_date'],
                    [col('participants.status'), 'status'],
                ],
                include: [{
                    model: db.categories,
                    as: 'category',
                    attributes: ['id', 'name', 'image'],
                    required: false
                },
                {
                    model: db.challengeParticipants,
                    as: 'participants',
                    where: {
                        user_id,
                    },
                    attributes: [],
                    required: false
                },
                {
                    model: db.users,
                    as: 'creator',
                    attributes: ['id', 'username', 'email', 'role'],
                    required: false

                }],
            });
            challenges = [...challenges, currentChallenge]
        }
        return res.status(200).json({ challenges })
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: "server error" })
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