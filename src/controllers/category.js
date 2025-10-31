require('dotenv').config();

const db = require("../models");
const category = db.categories;

async function getCategories(req, res) {
    try {
        const categories = await category.findAll({
            attributes: ['id', 'name']
        });
        return res.status(200).json({ categories });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: "server error" })
    }

}

async function createCategory(req, res) {
    try {
        const { name, description } = req.body;
        const image = req.file ? `/uploads/image/${req.file.filename}` : null;
        const categoryData = { name, ...(description && { description }), ...(image && { image }) };
        const cat = await category.create(categoryData);
        return res.status(200).json({ category: cat, message: "Category added successfully" })
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: "server error" })
    }
}

module.exports = { getCategories, createCategory }