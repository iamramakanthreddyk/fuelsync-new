/**
 * CreditSettlementLink Model
 * Links settlements to specific credit transactions for partial settlement support
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CreditSettlementLink = sequelize.define('CreditSettlementLink', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    settlementId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'settlement_id',
      references: {
        model: 'credit_transactions', // Only settlement transactions
        key: 'id'
      },
      comment: 'The settlement transaction (transactionType=settlement)'
    },
    creditTransactionId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'credit_transaction_id',
      references: {
        model: 'credit_transactions', // Only credit transactions
        key: 'id'
      },
      comment: 'The original credit transaction being settled'
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      comment: 'Amount of this settlement applied to this credit transaction'
    }
  }, {
    tableName: 'credit_settlement_links',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['settlement_id'] },
      { fields: ['credit_transaction_id'] }
    ]
  });

  CreditSettlementLink.associate = (models) => {
    CreditSettlementLink.belongsTo(models.CreditTransaction, { foreignKey: 'settlementId', as: 'settlement' });
    CreditSettlementLink.belongsTo(models.CreditTransaction, { foreignKey: 'creditTransactionId', as: 'credit' });
  };

  return CreditSettlementLink;
};
