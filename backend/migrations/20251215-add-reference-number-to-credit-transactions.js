'use strict';

/**
 * Migration to add reference_number column to credit_transactions table
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('credit_transactions', 'reference_number', {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: 'Reference or receipt number for the credit transaction'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('credit_transactions', 'reference_number');
  }
};
