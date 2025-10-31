const express = require("express");
const router = express.Router();
const { todaysHabits, updatelogStatus } = require("../controllers/habitLog");
const { authorizeRole } = require("../middleware/authorizeRole");
// const validator = require("../validators/validator");

router.patch("/:id", authorizeRole(['user']), updatelogStatus);

router.get("/today", authorizeRole(['user']), todaysHabits);

module.exports = router;