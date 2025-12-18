require('dotenv').config();

const { Op, col } = require('sequelize');
const db = require("../models");
const { getPendingChallenges } = require('./challengeLogs');
const { getPendingHabits } = require('./habitLog');
const { sendCategoryNotification } = require('../utils/utilityFunctions');
const dayjs = require('dayjs');


async function createRemindersForToday(userId, resetTime) {
  const todayHabits = await getPendingHabits(userId);
  const todayChallenges = await getPendingChallenges(userId);

  const sixHoursBefore = new Date(resetTime.getTime() - 6 * 60 * 60 * 1000);
  const twoHoursBefore = new Date(resetTime.getTime() - 2 * 60 * 60 * 1000);

  for (const habit of todayHabits) {
    await db.habitReminder.bulkCreate([
      { user_id: userId, habit_id: habit.habit_id, send_at: sixHoursBefore, sent: false },
      { user_id: userId, habit_id: habit.habit_id, send_at: twoHoursBefore, sent: false }
    ]);
  }

  for (const challenge of todayChallenges) {
    await db.challengeReminder.bulkCreate([
      { user_id: userId, challenge_id: challenge.challenge_id, send_at: sixHoursBefore, sent: false },
      { user_id: userId, challenge_id: challenge.challenge_id, send_at: twoHoursBefore, sent: false }
    ]);
  }
}

async function sendReminders() {
  const now = new Date();
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  // Habit reminders
  const habitReminders = await db.habitReminder.findAll({
    where: {
      sent: false,
      send_at: { [Op.lte]: now }
    },
    include: [
      {
        model: db.habits,
        as: "habit",
        attributes: ["title"]
      }
    ]
  });

  // Challenge reminders
  const challengeReminders = await db.challengeReminder.findAll({
    where: {
      sent: false,
      send_at: { [Op.lte]: now }
    },
    include: [
      {
        model: db.challenges,
        as: "challenge",
        attributes: ["title"]
      }
    ]
  });

  if (!habitReminders.length && !challengeReminders.length) return;

  for (const reminder of habitReminders) {

    if (dayjs(reminder.send_at).format("YYYY-MM-DD") === dayjs().format("YYYY-MM-DD")) { // only work with today's habits
      const remianingHabits = await db.habitLogs.findAll({
        where: {
          habit_id: reminder.habit_id,
          user_id: reminder.user_id,
          status: "remaining",                    // checking if the status is still remaining
          date: dayjs().format("YYYY-MM-DD"),
        }
      })
      if (!remianingHabits.length) return; // if not, don't send reminder

      const payload = JSON.stringify({
        title: "⏰Reminder: Pending Habit",
        body: `Your habit "${reminder.habit.title}" is still pending today!`,
        url: `http://localhost:3000/`,
      });
      await sendCategoryNotification(reminder.user_id, payload);
      await reminder.update({ sent: true });
    }

  }

  for (const reminder of challengeReminders) {
    if (dayjs(reminder.send_at).format("YYYY-MM-DD") === dayjs().format("YYYY-MM-DD")) {
      const remianingChallenges = await db.challengeLogs.findAll({
        where: {
          challenge_id: reminder.challenge_id,
          user_id: reminder.user_id,
          status: "remaining",
          date: dayjs().format("YYYY-MM-DD"),
        }
      })
      if (!remianingChallenges.length) return;

      const payload = JSON.stringify({
        title: "⏰Reminder: Pending Challenge",
        body: `Your challenge "${reminder.challenge.title}" still needs to be updated today!`,
        url: `http://localhost:3000/`,
      });
      await sendCategoryNotification(reminder.user_id, payload);
      await reminder.update({ sent: true });
    }
  }
}

module.exports = { createRemindersForToday, sendReminders }