const express = require('express');
const path = require('path');
const { Sequelize } = require('sequelize');
const db = require('./models');

const app = express();
const cors = require('cors');

app.use("/uploads/image", express.static(path.join(__dirname, "uploads/image")));

const authRoutes = require('./routes/auth');
const habitRoutes = require('./routes/habit');
const habitLogRoutes = require('./routes/habitLog');
const userRoutes = require('./routes/user');
const templateRoutes = require("./routes/template");
const categoryRoutes = require("./routes/category");
const challengeRoutes = require("./routes/challenge");
const challengeLogRoutes = require("./routes/challengeLogs");

const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: 'http://localhost:3000',
  methods: '*',
  credentials: true
}));

app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/habit", habitRoutes)
app.use("/api/habitLog", habitLogRoutes)
app.use("/api/user", userRoutes)
app.use("/api/templates", templateRoutes)
app.use("/api/category", categoryRoutes)
app.use("/api/challenges", challengeRoutes)
app.use("/api/challengeLogs", challengeLogRoutes)

app.get('/', (req, res) => {
  res.send('Sequelize is working!');
});

// Sync Sequelize models
db.sequelize.sync({ alter: true })
  .then(() => {
    console.log('Database synced');
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Error syncing database:', err);
  });
