const express = require("express");
const router = express.Router();

const { createUser, userLogin, refreshAccessToken } = require("../controllers/auth");
const validator = require("../validators/validator");
const { userCreateSchema, userLoginSchema } = require("../validationSchemas/user");


router.post("/register", validator(userCreateSchema), createUser);

router.post("/login", validator(userLoginSchema), userLogin);

router.post("/refresh-token", refreshAccessToken);

module.exports = router;
