"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add 'ev_charging' value to the enum type for nozzles.fuel_type
    await queryInterface.sequelize.query(`ALTER TYPE "enum_nozzles_fuel_type" ADD VALUE IF NOT EXISTS 'ev_charging';`);
  },

  down: async (queryInterface, Sequelize) => {
    // Cannot remove enum values in Postgres easily; document this in migration
    // No action taken on down
  }
};