const cron = require("node-cron");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const tz = require("dayjs/plugin/timezone");
const { Op } = require("sequelize");
const { users } = require("../models");
const db = require("../models");

const { createLogsUpToToday, markMissed } = require("../controllers/habitLog");
const { createDailyChallengeLogs, markMissedChallenges, updateEndedChallenges, activateScheduledChallenges } = require("../controllers/challengeLogs");
const { createRemindersForToday, sendReminders } = require("../controllers/reminder");
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

      sendReminders(); // check every seconds if there's any pending reminder to send

      // Find users whose reset time has passed
      const dueUsers = await users.findAll({
        where: {
          next_reset_at: { [Op.lte]: now }
        }
      });

      if (dueUsers.length === 0) return;

      await activateScheduledChallenges() // activate the challenge on the day of the scheduled date

      for (const user of dueUsers) {
        // Perform the Habit reset
        await createLogsUpToToday(user.id);
        await markMissed(user.id)

        // Perform the Challenge reset
        await createDailyChallengeLogs(user.id);
        await markMissedChallenges(user.id);

        // Schedule next reset
        const nextResetAt = getNextResetDate(user.timezone || "UTC");
        await createRemindersForToday(user.id, nextResetAt);
        await user.update({ next_reset_at: nextResetAt });
      }
      await updateEndedChallenges(); // Update the correct challenge status when ended
    } catch (err) {
      console.error("Reset Scheduler Error:", err);
    }
  });

  console.log("✅ Reset Scheduler Initialized (cron running every minute)");
}
function clearReminderScheduler() {
  // Runs every first day of the week
  cron.schedule("0 0 * * 0", async () => {
    try {
      const dayBefore = new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000)

      await db.habitReminder.destroy({ where: { send_at: { [Op.lte]: dayBefore } } })
    } catch (error) {
      console.log("error deleting the Reminders", error)
    }
  });
}

module.exports = { initResetScheduler, clearReminderScheduler };
