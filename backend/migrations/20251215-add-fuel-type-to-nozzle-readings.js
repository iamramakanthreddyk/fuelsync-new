/**
 * Migration: Add missing fuel_type column to nozzle_readings table
 * Fixes 500 errors in reports and analytics
 */

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('nozzle_readings', 'fuel_type', {
      type: Sequelize.STRING(20),
      allowNull: true,
      comment: 'Fuel type for this reading (Petrol, Diesel, etc.)'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('nozzle_readings', 'fuel_type');
  }
};