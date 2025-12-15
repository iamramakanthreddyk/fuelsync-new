"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add cash_collected column to shifts table
    await queryInterface.addColumn('shifts', 'cash_collected', {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: true,
      comment: 'Total cash collected during the shift'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove cash_collected column from shifts table
    await queryInterface.removeColumn('shifts', 'cash_collected');
  }
};
