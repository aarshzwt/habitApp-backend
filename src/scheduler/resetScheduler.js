const cron = require("node-cron");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const tz = require("dayjs/plugin/timezone");
const { Op } = require("sequelize");
const { users } = require("../models");
const { createLogsUpToToday, markMissed } = require("../controllers/habitLog");
const { createDailyChallengeLogs, markMissedChallenges, updateEndedChallenges } = require("../controllers/challengeLogs");

dayjs.extend(utc);
dayjs.extend(tz);

function getNextResetDate(timezone) {
  // Next day at 00:00 in user's timezone
  return dayjs().tz(timezone).endOf("day").add(1, "second").toDate();
}

function initResetScheduler() {
  // Runs every minute
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();
      console.log(now)

      // Find users whose reset time has passed
      const dueUsers = await users.findAll({
        where: {
          next_reset_at: { [Op.lte]: now }
        }
      });

      if (dueUsers.length === 0) return;

      for (const user of dueUsers) {
        // Perform the Habit reset
        await createLogsUpToToday(user.id);
        await markMissed(user.id)

        // Perform the Challenge reset
        await createDailyChallengeLogs(user.id);
        await markMissedChallenges(user.id);

        // Schedule next reset
        const nextResetAt = getNextResetDate(user.timezone || "UTC");
        await user.update({ next_reset_at: nextResetAt });
      }
      await updateEndedChallenges();
    } catch (err) {
      console.error("Reset Scheduler Error:", err);
    }
  });

  console.log("✅ Reset Scheduler Initialized (cron running every minute)");
}

module.exports = initResetScheduler;
