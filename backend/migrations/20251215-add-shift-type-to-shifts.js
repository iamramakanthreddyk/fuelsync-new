"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add shift_type column to Shift table
    await queryInterface.addColumn('shifts', 'shift_type', {
      type: Sequelize.STRING(30),
      allowNull: true,
      comment: 'Type of shift (e.g., morning, evening, night)'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove shift_type column from Shift table
    await queryInterface.removeColumn('shifts', 'shift_type');
  }
};
