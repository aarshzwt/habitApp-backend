const { Worker } = require("bullmq");
const { connection, failedParticipantQueue } = require("../services/queue");
const db = require("../models");
const { Op } = require("sequelize");
const { addXP, newChallengeXP } = require("../utils/utilityFunctions");
const getWebPush = require("../config/vapid");

const webpush = getWebPush();

const participantWorker = new Worker(
    "participantQueue",
    async job => {
        const { user_id, challenge_id, start_date, today } = job.data;

        // 1. Add XP
        await addXP(user_id, newChallengeXP);

        // Fetch Challenge Details
        const challenge = await db.challenges.findOne({
            where: { id: challenge_id },
            attributes: ["title"],
            raw: true,
        });

        // 2. Fetch existing participants
        const participants = await db.challengeParticipants.findAll({
            where: {
                challenge_id,
                user_id: { [Op.ne]: user_id },
                status: "active",
            },
            raw: true,
            attributes: ["user_id"],
        });

        const ids = participants.map(p => p.user_id);

        // 3. Send web push notifications
        if (ids.length > 0) {
            const subscriptions = await db.subscriptions.findAll({
                where: { user_id: ids }
            });

            const payload = JSON.stringify({
                title: "New Participant Joined!",
                body: `Someone just joined the challenge '${challenge.title}' that you've been part of. 🎉`,
                url: `http://localhost:3000/challenge/${challenge_id}`,
            });

            for (const sub of subscriptions) {
                webpush.sendNotification(
                    {
                        endpoint: sub.endpoint,
                        keys: { auth: sub.auth, p256dh: sub.p256dh }
                    },
                    payload
                )
                    .catch(async err => {
                        console.log("Push error:", err);

                        if (err.statusCode === 410 || err.statusCode === 404) {
                            // Subscription is dead, remove it!
                            await db.subscriptions.destroy({ where: { id: sub.id } });
                            console.log("Removed dead subscription:", sub.id);
                        }
                    });
            }
        }

        // 4. Add log if challenge starts today
        if (start_date === today) {
            await db.challengeLogs.create({
                challenge_id,
                user_id,
                date: today,
            });
        }
    },
    {
        connection,
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 10000
        }
    }
);

participantWorker.on("completed", job => {
    console.log(`[Participant Worker] Job: ${job.id} done`);
});

participantWorker.on("failed", async (job, err) => {
    console.error(`Participant job ${job.id} failed:`, err);

    // await failedParticipantQueue.add("failedParticipantQueue", {
    //     originalJob: job.data,
    //     failedAt: new Date(),
    //     error: err.message,
    // });
});

console.log("Challenge Worker Running...");

module.exports = participantWorker;
