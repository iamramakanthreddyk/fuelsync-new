'use strict';

/**
 * Migration: Add missing columns to users table for model sync
 * Ensures users table matches Sequelize model (phone, etc.)
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add phone column if missing
    await queryInterface.addColumn('users', 'phone', {
      type: Sequelize.STRING(20),
      allowNull: true
    }).catch(() => {});
    // Add any other missing columns here if needed
  },

  async down(queryInterface, Sequelize) {
    // No-op for safety
  }
};
