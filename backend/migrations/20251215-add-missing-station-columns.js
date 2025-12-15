'use strict';

/**
 * Migration: Add missing columns to stations table (city, state, pincode, gst_number)
 * Ensures stations table matches Sequelize model
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add city column if missing
    await queryInterface.addColumn('stations', 'city', {
      type: Sequelize.STRING(100),
      allowNull: true
    });
    // Add state column if missing
    await queryInterface.addColumn('stations', 'state', {
      type: Sequelize.STRING(100),
      allowNull: true
    });
    // Add pincode column if missing
    await queryInterface.addColumn('stations', 'pincode', {
      type: Sequelize.STRING(10),
      allowNull: true
    });
    // Add gst_number column if missing
    await queryInterface.addColumn('stations', 'gst_number', {
      type: Sequelize.STRING(20),
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('stations', 'city');
    await queryInterface.removeColumn('stations', 'state');
    await queryInterface.removeColumn('stations', 'pincode');
    await queryInterface.removeColumn('stations', 'gst_number');
  }
};
