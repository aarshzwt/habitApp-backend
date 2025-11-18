require('dotenv').config();

const { col, Op } = require('sequelize');
const db = require("../models");
const { getPagingData, getPagination } = require('../utils/utilityFunctions');

async function getTemplateById(req, res) {
    const id = req.params.id;

    try {
        const template = await db.habitTemplates.findByPk(id);
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
        const {
            page,
            limit,
            category_id,
            frequency_type,
            min_frequency_value,
            max_frequency_value,
            search
        } = req.query;

        const { _page, _limit, offset } = getPagination(page, limit);

        const where = {};

        if (category_id) where.category_id = Number(category_id);

        if (frequency_type) where.frequency_type = frequency_type;

        if (min_frequency_value) {
            where.frequency_value = { ...where.frequency_value, [Op.gte]: Number(min_frequency_value) };
        }

        if (max_frequency_value) {
            where.frequency_value = { ...where.frequency_value, [Op.lte]: Number(max_frequency_value) };
        }

        if (search) {
            where[Op.or] = [
                { title: { [Op.like]: `%${search}%` } },
                { description: { [Op.like]: `%${search}%` } }
            ];
        }

        const { rows, count } = await db.habitTemplates.findAndCountAll({
            where,
            attributes: [
                "id",
                "title",
                "description",
                "category_id",
                [col("category.name"), "categoryName"],
                [col("category.image"), "categoryImage"]
            ],
            include: [{
                model: db.categories,
                as: "category",
                attributes: [],
                required: false,
            }],
            limit: _limit,
            offset,
            order: [["createdAt", "DESC"]],
            raw: true,
        });

        return res.json({
            templates: rows,
            ...getPagingData(count, _page, _limit),
        });

    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: "server error" });
    }
}

module.exports = { getTemplateById, getTemplates }