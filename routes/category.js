const express = require('express');
const { authorizeRole } = require('../middleware/authorizeRole');
const { getCategories, createCategory } = require('../controllers/category');
const { imageUpload } = require('../middleware/fileUpload');
const router = express.Router();

router.post("/", authorizeRole(['admin', 'user']), imageUpload.single("categoryImg"), createCategory)
router.get("/", authorizeRole(['admin', 'user']), getCategories)

module.exports = router;