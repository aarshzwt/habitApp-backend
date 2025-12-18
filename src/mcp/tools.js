// mcp/tools.js
const { z } = require("zod");
const { getHabitStats, getChallengeStats } = require("../analytics/habitAnalytics");

const habitTools = {
  get_habit_stats: {
    schema: z.object({
      from: z.string(),
      to: z.string()
    }),
    handler: async ({ from, to }, { user_id, habit_id }) => {
      console.log("habit function called")
      console.log(from, to)
      console.log(user_id, habit_id)
      return getHabitStats(habit_id, user_id, from, to);
    }
  },
  get_challenge_stats: {
    schema: z.object({
      from: z.string(),
      to: z.string()
    }),
    handler: async ({ from, to }, { user_id, challenge_id }) => {
      console.log("challenge function called")
      console.log(from, to)
      console.log(user_id, challenge_id)
      return getChallengeStats(challenge_id, user_id, from, to);
    }
  },
};

module.exports = { habitTools };
