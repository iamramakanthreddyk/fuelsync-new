'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('settlements', 'employee_shortfalls', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'JSON object tracking employee-wise shortfalls: {empId: {employeeName, shortfall, count}}'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('settlements', 'employee_shortfalls');
  }
};
