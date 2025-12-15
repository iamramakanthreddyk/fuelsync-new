/**
 * Migration: Add is_flagged and flag_reason columns to creditors table
 * Fixes 500 error for missing columns in API
 */

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('creditors', 'is_flagged', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Flagged for review or risk'
    });
    await queryInterface.addColumn('creditors', 'flag_reason', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Reason for flagging creditor'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('creditors', 'is_flagged');
    await queryInterface.removeColumn('creditors', 'flag_reason');
  }
};