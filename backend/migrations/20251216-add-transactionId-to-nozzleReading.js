/**
 * Migration: Add transactionId to NozzleReading
 * Adds a nullable transactionId column to nozzle_readings table
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('nozzle_readings', 'transaction_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'daily_transactions',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'Links reading to a DailyTransaction (grouped entry)'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('nozzle_readings', 'transaction_id');
  }
};
