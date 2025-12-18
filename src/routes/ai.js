const express = require('express');
const { authorizeRole } = require('../middleware/authorizeRole');
const { query } = require('../controllers/ai');

const router = express.Router();

router.post("/query", authorizeRole(['admin', 'user']), query)

module.exports = router;