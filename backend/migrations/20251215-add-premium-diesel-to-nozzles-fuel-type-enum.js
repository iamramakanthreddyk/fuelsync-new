"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add 'premium_diesel' value to the enum type for nozzles.fuel_type
    await queryInterface.sequelize.query(`ALTER TYPE "enum_nozzles_fuel_type" ADD VALUE IF NOT EXISTS 'premium_diesel';`);
  },

  down: async (queryInterface, Sequelize) => {
    // Cannot remove enum values in Postgres easily; document this in migration
    // No action taken on down
  }
};