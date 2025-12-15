/**
 * Migration: Add notes column to nozzles table
 * Fixes 500 error for missing notes field
 */

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('nozzles', 'notes', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Notes for this nozzle'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('nozzles', 'notes');
  }
};