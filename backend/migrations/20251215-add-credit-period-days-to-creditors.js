"use strict";

/**
 * Add credit_period_days to creditors table
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("creditors", "credit_period_days", {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: "Credit period in days for creditor"
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("creditors", "credit_period_days");
  }
};
