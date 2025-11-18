const express = require("express");
const router = express.Router();

const { authorizeRole } = require("../middleware/authorizeRole");
const { getLogById, getLogsOfUser, getAllLogsOfChallenge, getLogs, updateChallengeLog, todaysChallenges } = require("../controllers/challengeLogs");
// const validator = require("../validators/validator");

router.get("/user", authorizeRole(['user', 'admin']), getLogsOfUser); // get user's all logs of all challenges
router.get("/:challenge_id", authorizeRole(['user', 'admin']), getLogs); // get logs of user with given challenge_id
router.get("/log/:id", authorizeRole(['user', 'admin']), getLogById); // get log of given id
router.get("/challenge/:challenge_id", authorizeRole(['user', 'admin']), getAllLogsOfChallenge); // get all partcipant's logs of given challenge_id
router.patch("/:id", authorizeRole(['user', 'admin']), updateChallengeLog); //update user's log of given challenge_id
router.get("/user/today", authorizeRole(['user', 'admin']), todaysChallenges); // get user's all logs of all challenges



module.exports = router;
