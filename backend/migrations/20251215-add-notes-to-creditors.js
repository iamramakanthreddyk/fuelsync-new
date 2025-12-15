"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("creditors", "notes", {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: "Optional notes for the creditor"
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("creditors", "notes");
  }
};
