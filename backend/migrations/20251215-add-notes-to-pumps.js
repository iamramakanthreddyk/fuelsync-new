"use strict";

/**
 * Add notes column to pumps table
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("pumps", "notes", {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: "Pump notes (optional)"
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("pumps", "notes");
  }
};
