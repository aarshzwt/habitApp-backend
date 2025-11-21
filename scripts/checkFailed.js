// scripts/checkFailed.js

const { participantQueue } = require("../src/services/queue");

(async () => {
    const jobs = await participantQueue.getFailed();

    for (const job of jobs) {
        console.log("Failed Job:");
        console.log({
            id: job.id,
            name: job.name,
            data: job.data,
            failedReason: job.failedReason,
            attemptsMade: job.attemptsMade,
            finishedOn: job.finishedOn,
            stacktrace: job.stacktrace,
        });
    }

    process.exit(0);
})();
