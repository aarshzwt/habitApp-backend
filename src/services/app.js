const express = require('express');
const path = require('path');
const cors = require('cors');

const authRoutes = require('../routes/auth');
const habitRoutes = require('../routes/habit');
const habitLogRoutes = require('../routes/habitLog');
const userRoutes = require('../routes/user');
const templateRoutes = require("../routes/template");
const categoryRoutes = require("../routes/category");
const challengeRoutes = require("../routes/challenge");
const challengeLogRoutes = require("../routes/challengeLogs");
const notificationRoutes = require("../routes/notification");

const app = express();

// Static
app.use("/uploads/image", express.static(path.join(__dirname, "../../uploads/image")));

// Middleware
app.use(cors({ origin: 'http://localhost:3000', methods: '*', credentials: true }));
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/habit", habitRoutes);
app.use("/api/habitLog", habitLogRoutes);
app.use("/api/user", userRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/category", categoryRoutes);
app.use("/api/challenges", challengeRoutes);
app.use("/api/challengeLog", challengeLogRoutes);
app.use("/api/notifications", notificationRoutes);

app.get('/', (req, res) => {
    res.send('Sequelize is working!');
});

module.exports = app;
