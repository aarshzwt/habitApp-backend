require('dotenv').config();
const app = require('./src/services/app');
const db = require('./src/models');
const runDevReset = require('./src/services/resetDev');
const initResetScheduler = require('./src/scheduler/resetScheduler');
const getWebPush = require("./src/config/vapid");

const PORT = process.env.PORT || 3000;

app.set("webpush", getWebPush());

// Sync Sequelize models
db.sequelize.sync({ alter: true })
  .then(async () => {
    console.log('Database synced');

    if (process.env.APP_ENV === "development") {
      (setTimeout(runDevReset, 3000));
    }
    if (process.env.APP_ENV === "production") {
      initResetScheduler();
    }

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Error syncing database:', err);
  });
