'use strict';

/**
 * Migration to add price_per_litre column to credit_transactions table
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('credit_transactions', 'price_per_litre', {
      type: Sequelize.DECIMAL(8, 2),
      allowNull: true,
      comment: 'Price per litre for the credit transaction'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('credit_transactions', 'price_per_litre');
  }
};
