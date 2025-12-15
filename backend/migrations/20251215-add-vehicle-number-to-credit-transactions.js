'use strict';

/**
 * Migration to add vehicle_number column to credit_transactions table
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('credit_transactions', 'vehicle_number', {
      type: Sequelize.STRING(20),
      allowNull: true,
      comment: 'Vehicle number for the credit transaction'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('credit_transactions', 'vehicle_number');
  }
};
