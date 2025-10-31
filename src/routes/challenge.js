const express = require("express");
const router = express.Router();

const { authorizeRole } = require("../middleware/authorizeRole");
const { createChallenge, getChallenges, getChallengesByUser, getChallengeById, editOrDeleteChallenge } = require("../controllers/challenge");
const { addParticipant, deleteParticipant, getChallengeParticipants } = require("../controllers/challengeParticipants");
// const validator = require("../validators/validator");

router.post("/create", authorizeRole(['user']), createChallenge); //create a challenge
router.post("/:challenge_id", authorizeRole(['user', 'admin']), editOrDeleteChallenge) // update/delete challenge
router.post("/join/:challenege_id", authorizeRole(['admin', 'user']), addParticipant) // join a challenge
router.delete("/leave/:id", authorizeRole(['admin', 'user']), deleteParticipant) // leave a challenge
// router.post("/update/:id", authorizeRole(['admin', 'user']), editOrDeleteHabit);
router.get("/user", authorizeRole(['user', 'admin']), getChallengesByUser); // get challenges by user
router.get("/:id", authorizeRole(['user', 'admin']), getChallengeById); // get challenge by Id
router.get("/", authorizeRole(['admin', 'user']), getChallenges); // get all challenges

router.get("/:challenge_id/participants", authorizeRole(['admin', 'user']), getChallengeParticipants)

module.exports = router;
