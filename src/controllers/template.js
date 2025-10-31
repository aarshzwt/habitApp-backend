require('dotenv').config();

const db = require("../models");
const { getPagingData, getPagination } = require('../utils/utilityFunctions');
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
        const { page, limit } = req.query;
        const { _page, _limit, offset } = getPagination(page, limit);

        const { rows, count } = await habitTemplates.findAndCountAll({
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
        const formatted = rows.map(template => ({
            id: template.id,
            title: template.title,
            description: template.description,
            categoryName: template.category?.name || "Uncategorized",
            categoryImage: template.category?.image || "/placeholder.jpg"
        }));
        return res.json({ templates: formatted, ...getPagingData(count, _page, _limit), })
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: "server error" })
    }
}
module.exports = { getTemplateById, getTemplates }