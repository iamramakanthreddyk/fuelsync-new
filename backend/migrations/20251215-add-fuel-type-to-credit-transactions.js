'use strict';

/**
 * Migration to add fuel_type column to credit_transactions table
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('credit_transactions', 'fuel_type', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Fuel type for the credit transaction (e.g., PETROL, DIESEL, CNG)'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('credit_transactions', 'fuel_type');
  }
};
