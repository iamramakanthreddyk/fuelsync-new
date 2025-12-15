'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add invoice_number to credit_transactions
    await queryInterface.addColumn('credit_transactions', 'invoice_number', {
      type: Sequelize.STRING(50),
      allowNull: true
    });

    // Create credit_settlement_links table
    await queryInterface.createTable('credit_settlement_links', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true
      },
      settlement_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'credit_transactions', key: 'id' },
        onDelete: 'CASCADE'
      },
      credit_transaction_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'credit_transactions', key: 'id' },
        onDelete: 'CASCADE'
      },
      amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('credit_settlement_links', ['settlement_id']);
    await queryInterface.addIndex('credit_settlement_links', ['credit_transaction_id']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('credit_transactions', 'invoice_number');
    await queryInterface.dropTable('credit_settlement_links');
  }
};
