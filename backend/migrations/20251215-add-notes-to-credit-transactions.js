'use strict';

/**
 * Migration to add notes column to credit_transactions table
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('credit_transactions', 'notes', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Optional notes for credit transaction'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('credit_transactions', 'notes');
  }
};
