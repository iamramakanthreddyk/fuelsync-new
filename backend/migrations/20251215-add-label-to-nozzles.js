"use strict";

/**
 * Add label to nozzles table
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("nozzles", "label", {
      type: Sequelize.STRING,
      allowNull: true,
      comment: "Nozzle label (display name)"
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("nozzles", "label");
  }
};
