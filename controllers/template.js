require('dotenv').config();

const db = require("../models");
// const habits = db.habits
// const habitLogs = db.habitLogs
const habitTemplates = db.habitTemplates;

async function getTemplateById(req, res) {
    const id = req.params.id;

    try {
        const template = await habitTemplates.findByPk(id);
        if (!template) {
            return res.status(404).json({ error: "Not found" })
        }
        return res.status(200).json({ template })
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: err });
    }
}
async function getTemplates(req, res) {
    try {
        const { limit = 10, offset = 0 } = req.body;
        const templates = await habitTemplates.findAll({
            include: [{
                model: db.categories,
                as: 'category',
                attributes: ['name', 'image'],
                required: false
            }],
            limit,
            offset,
            order: [['createdAt', 'DESC']]
        });
        const formatted = templates.map(template => ({
            id: template.id,
            title: template.title,
            description: template.description,
            categoryName: template.category?.name || "Uncategorized",
            categoryImage: template.category?.image || "/placeholder.jpg"
        }));
        const total = await habitTemplates.count();
        return res.json({ templates: formatted, total })
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: "server error" })
    }
}
module.exports = { getTemplateById, getTemplates }