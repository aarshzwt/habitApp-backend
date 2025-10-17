const express = require("express");
const router = express.Router();
const { authorizeRole } = require("../middleware/authorizeRole");
const { getUserStats, getLeaderboard } = require("../controllers/user");
// const validator = require("../validators/validator");

// router.patch("/:id", authorizeRole(['user']), updatelogStatus);

router.get("/", authorizeRole(['user','admin']), getUserStats);
router.get("/leaderboard", authorizeRole(['user', 'admin']), getLeaderboard)

module.exports = router;