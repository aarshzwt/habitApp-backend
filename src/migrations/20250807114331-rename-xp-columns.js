'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.renameColumn('users', 'currentXp', 'currentXP');
    await queryInterface.renameColumn('users', 'TotalXp', 'totalXP');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.renameColumn('users', 'currentXP', 'currentXp');
    await queryInterface.renameColumn('users', 'totalXP', 'TotalXp');
  }
};
