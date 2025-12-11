require('dotenv').config();
const { Queue } = require("bullmq");
const { Redis } = require("ioredis");

const connection = new Redis({
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: process.env.REDIS_PORT || 6379,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
});

// XP Queue
const xpQueue = new Queue("xpHabitQueue", { connection });

// Participant Queue (for participants joining)
const participantQueue = new Queue("participantQueue", { connection });
const failedParticipantQueue = new Queue("failedParticipantQueue", { connection });

module.exports = { connection, xpQueue, participantQueue, failedParticipantQueue };
