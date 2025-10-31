require('dotenv').config();

const { Op } = require('sequelize');
const db = require("../models");
const cron = require("node-cron");
const { addXP, calculateStreak, habitLogXP, missedXP, streakXP, allLogsInDayXP, calculateAllLogCompletionStatus, calculateMaxStreak } = require('../utils/utilityFunctions');
const { date } = require('yup');
const habitLog = db.habitLogs;
const path = require('path');
const fs = require("fs");
const dayjs = require("dayjs");

const LAST_RUN_FILE = path.join(__dirname, "lastHabitLogRun.json");
// GET today's habits for user
async function todaysHabits(req, res) {
    const user_id = req.id;
    const today = new Date().toISOString().split("T")[0];
    try {

        const habits = await habitLog.findAll({
            where: { user_id, date: today },
            include: [{
                model: db.habits,
                as: 'habit',
                attributes: ['title', 'description'],
                required: true
            }]
        });
        const result = habits.map(habit => {
            return {
                id: habit.habit_id,
                log_id: habit.id,
                date: habit.date,
                status: habit.status,
                title: habit.habit.title,
                description: habit.habit.description
            }
        });

        res.status(200).json({ habit: result });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Something went wrong" });
    }
}

async function todaysHabitss(req, res) {
    const user_id = req.id;
    const today = new Date().toISOString().split("T")[0];
    const todayDate = new Date(today);
    const dayOfWeek = todayDate.getDay(); // 0 (Sun) - 6 (Sat)

    const startOfWeek = new Date(todayDate);
    startOfWeek.setDate(todayDate.getDate() - dayOfWeek); // Sunday
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Saturday


    const habits = await db.habits.findAll({
        where: {
            user_id,
            is_archived: false,
            start_date: { [Op.lte]: today },
            [Op.or]: [
                { end_date: null },
                { end_date: { [Op.gte]: today } }
            ]
        }
    });

    const filteredHabits = await Promise.all(habits.map(async (habit) => {
        const startDate = new Date(habit.start_date);
        const diffDays = Math.floor((todayDate - startDate) / (1000 * 60 * 60 * 24));

        switch (habit.frequency_type) {
            case 'daily':
                return habit;

            case 'every_x_days':
                if (diffDays % habit.frequency_value === 0) {
                    return habit;
                }
                break;

            case 'x_times_per_week':
                if (Array.isArray(habit.frequency_days) && habit.frequency_days.length > 0) {
                    if (habit.frequency_days.includes(dayOfWeek)) {
                        return habit;
                    }
                } else {
                    // Check total completed count for this week
                    const completedCount = await db.habitLogs.count({
                        where: {
                            user_id,
                            habit_id: habit.id,
                            status: 'completed',
                            date: {
                                [Op.between]: [
                                    startOfWeek.toISOString().split('T')[0],
                                    endOfWeek.toISOString().split('T')[0]
                                ]
                            }
                        }
                    });

                    if (completedCount < habit.frequency_value) {
                        return habit;
                    }
                }
                break;
        }
        return null;
    }));

    const habitLogs = await Promise.all(
        filteredHabits.filter(h => h).map(async (habit) => {
            const [log] = await db.habitLogs.findOrCreate({
                where: {
                    user_id,
                    habit_id: habit.id,
                    date: today
                },
                defaults: {
                    status: 'remaining'
                }
            });

            return {
                ...habit.toJSON(),
                log_id: log.id,
                status: log.status
            };
        })
    );
    return res.json(habitLogs);
}

//Query returining only completed count of that week
// select count(*), l.habit_id
// from habit_logs l 
// JOIN habits h ON h.id = l.habit_id and h.user_id = l.user_id
// where l.habit_id=1 and l.user_id=1 and l.status="completed" and h.frequency_type = 'x_times_per_week' and h.frequency_value=3 and h.frequency_days is null and l.date between '2025-08-03' and '2025-08-09'

// Query returning all types of status with its count in a week
// select count(*), l.habit_id, l.status
// from habit_logs l 
// JOIN habits h ON h.id = l.habit_id and h.user_id = l.user_id
// where l.habit_id=1 and l.user_id=1 and h.frequency_type = 'x_times_per_week' and h.frequency_value=3 and h.frequency_days is null and l.date between '2025-08-03' and '2025-08-09'
// group by l.status

//REMAINING  => COMPLETED => MISSED: THE CYCLE
async function updatelogStatus(req, res) {
    const id = req.params.id;
    const user_id = req.id;
    const { status } = req.body

    try {
        const log = await habitLog.findOne({
            where: {
                id, user_id
            }
        });
        if (!log) return res.status(404).json({ message: "Log not found" });

        if (!["completed", "remaining", "missed"].includes(status)) {
            return res.status(400).json({ message: "Invalid Status" });
        }
        const previousStatus = log.status;
        const logs = await habitLog.findAll({
            where: { user_id, habit_id: log.habit_id },
            order: [['date', 'DESC']],
        });
        const oldStreak = await calculateStreak(logs);

        await log.update({ status })

        //avoiding the db call for single status change output
        const newLogs = logs.map(l => {
            if (l.id === log.id) {
                return { ...l.toJSON(), status };
            }
            return l.toJSON();
        });
        const newStreak = await calculateStreak(newLogs);

        // XP for habit completion
        if (status === "completed" && previousStatus !== "completed") {
            await addXP(user_id, habitLogXP);
            if (newStreak > 0 && newStreak % 7 === 0) {
                await addXP(user_id, streakXP); // credit the 1-week streak bonus XP
            }

            // Addition of bonus XP if all habit due today are marked completed
            const res = await calculateAllLogCompletionStatus(user_id);
            if (res.logsInaDay && res.completedlogsInaDay && res.logsInaDay > 1 && res.completedlogsInaDay === res.logsInaDay) {
                await addXP(user_id, allLogsInDayXP)
            }
        }
        //XP for when state changes from completed to missed
        else if (status === "missed" && previousStatus === "completed") {
            await addXP(user_id, -habitLogXP + missedXP);// deduct bonus XP plus add missed log XP penalty

            const brokeStreak = oldStreak > newStreak && oldStreak % 7 === 0 && newStreak % 7 !== 0;
            if (brokeStreak) {
                await addXP(user_id, -streakXP); // Deduct bonus streak XP when marking the status missed causes it to break
            }

            // Deduction of bonus XP of allLogsCompletedToday if credited earlier
            const res = await calculateAllLogCompletionStatus(user_id);
            if (res.logsInaDay && res.completedlogsInaDay && res.logsInaDay > 1 && res.completedlogsInaDay === (res.logsInaDay - 1)) {
                await addXP(user_id, -allLogsInDayXP) //deducting bonus xp
            }
        }
        //XP for when state changes from missed to remaining 
        else if (status === "remaining" && previousStatus === "missed") {
            await addXP(user_id, -missedXP) //credit the missed XP deduction
        }

        return res.json({ message: "Habit status updated", status: log.status });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: err });
    }
}

//When in development, run the job when server starts. When in production, run the job everyday at midnight.

if (process.env.APP_ENV === "development") {
    (setTimeout(async () => {
        const today = dayjs().format("YYYY-MM-DD");
        // --- Check if already ran today ---
        let lastRun = null;
        if (fs.existsSync(LAST_RUN_FILE)) {
            lastRun = JSON.parse(fs.readFileSync(LAST_RUN_FILE, "utf-8")).lastRun;
            if (lastRun === today) {
                // console.log("Habit logs already created today. Skipping...");
                return;
            }
        }
        console.log("running")
        await createLogsUpToToday();
        await markMissed();
        fs.writeFileSync(LAST_RUN_FILE, JSON.stringify({ lastRun: today }));
        console.log("Completed creating missing habit logs.");
    }, 3000));
} else if (process.env.APP_ENV === "production") {
    // Every day at midnight
    cron.schedule('* * * * *', async () => {
        console.log("running")
        await createLogsUpToToday();
        await markMissed();
        console.log("completed")
    });
}

async function createLogsUpToToday() {

    const todayStr = new Date().toISOString().split('T')[0];
    const todayDate = new Date(todayStr);

    try {
        //finding all habits
        const habits = await db.habits.findAll({
            where: {
                is_archived: false,
                start_date: { [Op.lte]: todayStr },
                [Op.or]: [
                    { end_date: null },
                    { end_date: { [Op.gte]: todayStr } }
                ]
            }
        });

        for (const habit of habits) {
            //getting the last log of each habit
            const lastLog = await db.habitLogs.findOne({
                where: { habit_id: habit.id },
                order: [['date', 'DESC']]
            });

            let currentDate = lastLog
                ? new Date(lastLog.date)
                : new Date(habit.start_date);

            currentDate.setDate(currentDate.getDate() + 1);
            //adding entry for all habits after the last log
            while (currentDate <= todayDate) {
                const currentStr = currentDate.toISOString().split('T')[0];
                const dayOfWeek = currentDate.getDay();
                const diffDays = Math.floor((currentDate - new Date(habit.start_date)) / (1000 * 60 * 60 * 24));

                let isDue = false;

                switch (habit.frequency_type) {
                    case 'daily':
                        isDue = true;
                        break;
                    case 'every_x_days':
                        if (diffDays % habit.frequency_value === 0) isDue = true;
                        break;
                    case 'x_times_per_week':
                        if (Array.isArray(habit.frequency_days) && habit.frequency_days.length > 0) {
                            if (habit.frequency_days.includes(dayOfWeek)) isDue = true;
                        } else {
                            const startOfWeek = new Date(currentDate);
                            startOfWeek.setDate(currentDate.getDate() - dayOfWeek);
                            const endOfWeek = new Date(startOfWeek);
                            endOfWeek.setDate(startOfWeek.getDate() + 6);

                            const completedCount = await db.habitLogs.count({
                                where: {
                                    habit_id: habit.id,
                                    status: 'completed',
                                    date: {
                                        [Op.between]: [
                                            startOfWeek.toISOString().split('T')[0],
                                            endOfWeek.toISOString().split('T')[0]
                                        ]
                                    }
                                }
                            });

                            if (completedCount < habit.frequency_value) isDue = true;
                        }
                        break;
                }
                if (isDue) {
                    await db.habitLogs.findOrCreate({
                        where: { habit_id: habit.id, date: currentStr },
                        defaults: { status: 'remaining', user_id: habit.user_id }
                    });
                }
                currentDate.setDate(currentDate.getDate() + 1);
            }
        }

    } catch (err) {
        console.error("Error creating logs:", err);
    }
}

async function createLogsForToday() {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayDate = new Date(todayStr);
    const dayOfWeek = todayDate.getDay();

    try {
        const habits = await db.habits.findAll({
            where: {
                is_archived: false,
                start_date: { [Op.lte]: todayStr },
                [Op.or]: [
                    { end_date: null },
                    { end_date: { [Op.gte]: todayStr } }
                ]
            }
        });

        for (const habit of habits) {
            const startDate = new Date(habit.start_date);
            const diffDays = Math.floor((todayDate - startDate) / (1000 * 60 * 60 * 24));
            let isDue = false;

            switch (habit.frequency_type) {
                case 'daily':
                    isDue = true;
                    break;
                case 'every_x_days':
                    if (diffDays % habit.frequency_value === 0) isDue = true;
                    break;
                case 'x_times_per_week':
                    if (Array.isArray(habit.frequency_days) && habit.frequency_days.length > 0) {
                        if (habit.frequency_days.includes(dayOfWeek)) isDue = true;
                    } else {
                        const startOfWeek = new Date(todayDate);
                        startOfWeek.setDate(todayDate.getDate() - dayOfWeek);
                        const endOfWeek = new Date(startOfWeek);
                        endOfWeek.setDate(startOfWeek.getDate() + 6);

                        const completedCount = await db.habitLogs.count({
                            where: {
                                habit_id: habit.id,
                                status: 'completed',
                                date: {
                                    [Op.between]: [
                                        startOfWeek.toISOString().split('T')[0],
                                        endOfWeek.toISOString().split('T')[0]
                                    ]
                                }
                            }
                        });

                        if (completedCount < habit.frequency_value) isDue = true;
                    }
                    break;
            }

            if (isDue) {
                await db.habitLogs.findOrCreate({
                    where: { habit_id: habit.id, date: todayStr },
                    defaults: { status: 'remaining', user_id: habit.user_id }
                });
            }
        }

    } catch (err) {
        console.error("Error creating logs for today:", err);
    }
}

async function markMissed() {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Midnight
    try {
        const logs = await db.habitLogs.findAll(
            {
                where: {
                    status: 'remaining',
                    date: { [Op.lt]: today },
                },
                attributes: ['id', 'user_id'],
            }
        );
        if (logs.length === 0) {
            console.log("No logs to mark as missed today");
            return;
        }

        await db.habitLogs.update(
            { status: 'missed' },
            {
                where: {
                    id: logs.map(l => l.id)
                }
            }
        );

        const userMissCount = {};
        logs.forEach(log => {
            userMissCount[log.user_id] = (userMissCount[log.user_id] || 0) + 1;
        });

        for (const [userId, missCount] of Object.entries(userMissCount)) {
            await addXP(userId, missCount * missedXP)
        }

        console.log(`Marked ${logs.length} logs as missed and deducted XP`);
    } catch (err) {
        console.log(err)
    }
}

module.exports = { todaysHabits, updatelogStatus }
