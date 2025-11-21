const { Worker } = require("bullmq");
const { connection, participantQueue } = require("../services/queue");

const failedWorker = new Worker(
    "failedParticipantQueue",
    async (job) => {
        console.log("Retrying failed job...");

        if (job.attemptsMade >= 3) {
            console.log("Job exceeded max retry attempts. NOT retrying.");
            return;
        }

        await participantQueue.add(
            "participantTask",
            job.data.originalJob,
            {
                attempts: 3,
                backoff: { type: "exponential", delay: 10000 },
            }
        );
    },
    { connection }
);

module.exports = failedWorker;
