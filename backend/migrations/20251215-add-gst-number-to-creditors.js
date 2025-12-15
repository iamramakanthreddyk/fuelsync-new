"use strict";

/**
 * Add gst_number to creditors table
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("creditors", "gst_number", {
      type: Sequelize.STRING,
      allowNull: true,
      comment: "GST number for creditor"
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("creditors", "gst_number");
  }
};
