"use strict";

/**
 * Add initial_reading to nozzles table
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("nozzles", "initial_reading", {
      type: Sequelize.DECIMAL(15, 3),
      allowNull: true,
      comment: "Initial reading for nozzle (optional)"
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("nozzles", "initial_reading");
  }
};
