'use strict';

const fs = require('fs');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');
const process = require('process');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/config.js')[env];
const db = {};

let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, config);
}

fs
  .readdirSync(__dirname)
  .filter(file => {
    return (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.js' &&
      file.indexOf('.test.js') === -1
    );
  })
  .forEach(file => {
    const model = require(path.join(__dirname, file))(sequelize, DataTypes);
    db[model.name] = model;
  });

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

db.habits = require("./habits")(sequelize, Sequelize.DataTypes)
db.habitLogs = require("./habit_logs")(sequelize, Sequelize.DataTypes)
db.users = require("./users")(sequelize, Sequelize.DataTypes)
db.badges = require("./badges")(sequelize, Sequelize.DataTypes)
db.userBadges = require("./user_badges")(sequelize, Sequelize.DataTypes)
db.habitTemplates = require("./habit_templates")(sequelize, Sequelize.DataTypes)
db.categories = require("./category")(sequelize, Sequelize.DataTypes)
db.challenges = require("./challenges")(sequelize, Sequelize.DataTypes)
db.challengeParticipants = require("./challenge_participants")(sequelize, Sequelize.DataTypes)
db.challengeLogs = require("./challenge_logs")(sequelize, Sequelize.DataTypes)

//User has many Habits
db.users.hasMany(db.habits, {
  foreignKey: 'user_id',
  onDelete: 'CASCADE'
});
// Habit belongs to a User
db.habits.belongsTo(db.users, {
  foreignKey: 'user_id',
  onDelete: 'CASCADE',
});
//User has many HabitLogs
db.users.hasMany(db.habitLogs, {
  foreignKey: 'user_id',
  onDelete: 'CASCADE'
});
// HabitLog belongs to a User
db.habitLogs.belongsTo(db.users, {
  foreignKey: 'user_id',
  onDelete: 'CASCADE',
})

// User has many Challenges
db.users.hasMany(db.challenges, {
  foreignKey: 'id',
  onDelete: 'CASCADE'
});
// Challenge belongs to a User
db.challenges.belongsTo(db.users, {
  foreignKey: 'created_by',
  onDelete: 'CASCADE',
  as: 'creator',
});

//Challenge has many ChallengeParticipants
db.challenges.hasMany(db.challengeParticipants, {
  foreignKey: 'challenge_id',
  onDelete: 'CASCADE',
  as: 'participants',
});
// ChallengeParticipant belongs to a Challenge
db.challengeParticipants.belongsTo(db.challenges, {
  foreignKey: 'challenge_id',
  onDelete: 'CASCADE',
});

//ChallengeParticipant belongs to a User
db.challengeParticipants.belongsTo(db.users, {
  foreignKey: 'user_id',
  onDelete: 'CASCADE',
  as: 'user',
});

//Challenge belongs to a category
db.challenges.belongsTo(db.categories, {
  foreignKey: 'category_id',
  onDelete: 'CASCADE',
  as: 'category'
});

//User has many ChallengeLogs
db.users.hasMany(db.challengeLogs, {
  foreignKey: 'user_id',
  onDelete: 'CASCADE'
});
// ChallengeLog belongs to a User
db.challengeLogs.belongsTo(db.users, {
  foreignKey: 'user_id',
  onDelete: 'CASCADE',
})

//User has many Badges
db.users.hasMany(db.userBadges, {
  foreignKey: 'user_id',
  onDelete: 'CASCADE'
});
// UserBadge belongs to a User
db.userBadges.belongsTo(db.users, {
  foreignKey: 'user_id',
  onDelete: 'CASCADE',
})

// Habit has many HabitLogs
db.habits.hasMany(db.habitLogs, {
  foreignKey: 'habit_id',
  onDelete: 'CASCADE',
  as: 'logs'
});
// HabitLog belongs to a Habit
db.habitLogs.belongsTo(db.habits, {
  foreignKey: 'habit_id',
  onDelete: 'CASCADE',
  as: 'habit'
})

// Challenge has many ChallengeLogs
db.challenges.hasMany(db.challengeLogs, {
  foreignKey: 'challenge_id',
  onDelete: 'CASCADE',
  as: 'logs'
});
// ChallengeLog belongs to a Challenge
db.challengeLogs.belongsTo(db.challenges, {
  foreignKey: 'challenge_id',
  onDelete: 'CASCADE',
  as: 'challenge'
})

// Habit belongs to a Category
db.habits.belongsTo(db.categories, {
  foreignKey: 'category_id',
  onDelete: 'CASCADE'
})
// Template belongs to a Category
db.habitTemplates.belongsTo(db.categories, {
  foreignKey: 'category_id',
  onDelete: 'CASCADE'
})

//UserBadges belongs to a Badge
db.userBadges.belongsTo(db.badges, {
  foreignKey: 'badge_id',
  onDelete: 'CASCADE',
})

module.exports = db;
