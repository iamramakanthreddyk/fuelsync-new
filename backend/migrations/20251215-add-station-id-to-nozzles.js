"use strict";

/**
 * Add station_id to nozzles table
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("nozzles", "station_id", {
      type: Sequelize.UUID,
      allowNull: true,
      comment: "Station ID for nozzle (denormalized)"
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("nozzles", "station_id");
  }
};
