'use strict';

/**
 * Migration: Add category column to audit_logs table
 * 
 * The AuditLog model defines a `category` field (line 87-91) that is used for:
 * - Filtering audit logs by category ('auth', 'data', 'finance', 'system')
 * - Creating an index for faster queries
 * 
 * This migration adds the missing column to the database.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Add category column
      await queryInterface.addColumn(
        'audit_logs',
        'category',
        {
          type: Sequelize.STRING(30),
          defaultValue: 'general',
          allowNull: false,
          comment: 'Category for filtering: auth, data, finance, system'
        },
        { transaction }
      );

      // Add index on category column for faster queries
      await queryInterface.addIndex(
        'audit_logs',
        ['category'],
        { transaction }
      );

      await transaction.commit();
      console.log('✅ Migration completed: Added category column to audit_logs');
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Remove the category column (which also removes the index)
      await queryInterface.removeColumn('audit_logs', 'category', { transaction });

      await transaction.commit();
      console.log('✅ Migration rolled back: Removed category column from audit_logs');
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
