const fs = require("fs");
const path = require("path");
const dayjs = require("dayjs");
const db = require("../models");
const { createLogsUpToToday, markMissed } = require("../controllers/habitLog");
const { createDailyChallengeLogs, markMissedChallenges } = require("../controllers/challengeLogs");


const LAST_RUN_FILE = path.join(__dirname, "../../lastHabitLogRun.json");

async function runDevReset() {
    const today = dayjs().format("YYYY-MM-DD");

    let lastRun = null;
    if (fs.existsSync(LAST_RUN_FILE)) {
        lastRun = JSON.parse(fs.readFileSync(LAST_RUN_FILE, "utf-8")).lastRun;
        if (lastRun === today) return;
    }

    console.log("DEV RESET: Running daily reset for ALL users…");

    const users = await db.users.findAll({ attributes: ["id"] });

    for (const user of users) {
        await createLogsUpToToday(user.id);
        await markMissed(user.id);
        await createDailyChallengeLogs(user.id);
        await markMissedChallenges(user.id);
    }

    fs.writeFileSync(LAST_RUN_FILE, JSON.stringify({ lastRun: today }));
    console.log("✅ Completed dev reset.");
}

module.exports = runDevReset;
