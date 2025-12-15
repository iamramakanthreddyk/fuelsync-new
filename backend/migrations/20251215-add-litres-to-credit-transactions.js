'use strict';

/**
 * Migration to add litres column to credit_transactions table
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('credit_transactions', 'litres', {
      type: Sequelize.DECIMAL(12, 3),
      allowNull: true,
      comment: 'Litres for the credit transaction'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('credit_transactions', 'litres');
  }
};
