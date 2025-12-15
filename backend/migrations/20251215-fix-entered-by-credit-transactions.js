'use strict';

/**
 * Migration to drop created_by and ensure entered_by is NOT NULL in credit_transactions table
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Remove created_by if it exists
    const table = await queryInterface.describeTable('credit_transactions');
    if (table.created_by) {
      await queryInterface.removeColumn('credit_transactions', 'created_by');
    }
    // Ensure entered_by is NOT NULL
    await queryInterface.changeColumn('credit_transactions', 'entered_by', {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'User who entered the credit transaction'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Optionally re-add created_by (as nullable)
    await queryInterface.addColumn('credit_transactions', 'created_by', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'User who created the credit transaction (legacy)'
    });
  }
};
