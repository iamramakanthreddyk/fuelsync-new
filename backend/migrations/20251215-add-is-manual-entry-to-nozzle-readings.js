"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add is_manual_entry column to nozzle_readings table
    await queryInterface.addColumn('nozzle_readings', 'is_manual_entry', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'Whether this reading was entered manually or parsed from receipt'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the is_manual_entry column
    await queryInterface.removeColumn('nozzle_readings', 'is_manual_entry');
  }
};