"use strict";

/**
 * Add contact_person and business_name columns to creditors table
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("creditors", "contact_person", {
      type: Sequelize.STRING,
      allowNull: true,
      comment: "Contact person for creditor"
    });
    await queryInterface.addColumn("creditors", "business_name", {
      type: Sequelize.STRING,
      allowNull: true,
      comment: "Business name for creditor"
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("creditors", "contact_person");
    await queryInterface.removeColumn("creditors", "business_name");
  }
};
