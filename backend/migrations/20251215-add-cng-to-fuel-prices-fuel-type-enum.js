"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add 'cng' value to the enum type for fuel_prices.fuel_type
    await queryInterface.sequelize.query(`ALTER TYPE "enum_fuel_prices_fuel_type" ADD VALUE IF NOT EXISTS 'cng';`);
  },

  down: async (queryInterface, Sequelize) => {
    // Cannot remove enum values in Postgres easily; document this in migration
    // No action taken on down
  }
};
