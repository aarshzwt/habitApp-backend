const express = require('express');
const { authorizeRole } = require('../middleware/authorizeRole');
const { getTemplates, getTemplateById } = require('../controllers/template');
const router = express.Router();

router.post("/", authorizeRole(['admin', 'user']), getTemplates)
router.get("/:id", authorizeRole(['admin', 'user']), getTemplateById)

module.exports = router;