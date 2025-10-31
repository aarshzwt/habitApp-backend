const express = require("express");
const router = express.Router();

const { createHabit, getHabits, getHabitById, getHabitsByUser, editOrDeleteHabit } = require("../controllers/habit");
const { authorizeRole } = require("../middleware/authorizeRole");
// const validator = require("../validators/validator");

router.post("/", authorizeRole(['user']), createHabit);
router.post("/:id", authorizeRole(['admin', 'user']), editOrDeleteHabit);
router.get("/user", authorizeRole(['user', 'admin']), getHabitsByUser);
router.get("/:id", authorizeRole(['user', 'admin']), getHabitById);
router.get("/", authorizeRole(['admin']), getHabits);


module.exports = router;
