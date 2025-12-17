'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add expense_month column
    await queryInterface.addColumn('expenses', 'expense_month', {
      type: Sequelize.STRING(7), // YYYY-MM format
      allowNull: true // Allow null initially
    });

    // Populate existing records with YYYY-MM format from expense_date
    await queryInterface.sequelize.query(`
      UPDATE expenses
      SET expense_month = TO_CHAR(expense_date, 'YYYY-MM')
      WHERE expense_month IS NULL
    `);

    // Make the column NOT NULL
    await queryInterface.changeColumn('expenses', 'expense_month', {
      type: Sequelize.STRING(7),
      allowNull: false
    });

    // Add index for performance
    await queryInterface.addIndex('expenses', ['expense_month'], {
      name: 'expenses_expense_month'
    });
  },

  async down (queryInterface, Sequelize) {
    // Remove index
    await queryInterface.removeIndex('expenses', 'expenses_expense_month');

    // Remove column
    await queryInterface.removeColumn('expenses', 'expense_month');
  }
};
