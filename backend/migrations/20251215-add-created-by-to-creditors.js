"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("creditors", "created_by", {
      type: Sequelize.UUID,
      allowNull: true,
      comment: "User ID who created the creditor (nullable for legacy data)"
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("creditors", "created_by");
  }
};
