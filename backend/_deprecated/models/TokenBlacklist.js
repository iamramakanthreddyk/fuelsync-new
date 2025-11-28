/**
 * Token Blacklist Model
 * Stores invalidated JWT tokens
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TokenBlacklist = sequelize.define('TokenBlacklist', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  token: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'user_id'
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'expires_at'
  },
  reason: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'logout, password_change, security, etc.'
  }
}, {
  tableName: 'token_blacklist',
  timestamps: true,
  updatedAt: false,
  underscored: true,
  indexes: [
    { fields: ['token'], unique: true },
    { fields: ['user_id'] },
    { fields: ['expires_at'] }
  ]
});

/**
 * Check if a token is blacklisted
 */
TokenBlacklist.isBlacklisted = async function(token) {
  const entry = await this.findOne({ where: { token } });
  return !!entry;
};

/**
 * Add token to blacklist
 */
TokenBlacklist.blacklist = async function(token, userId, expiresAt, reason = 'logout') {
  return this.create({ token, userId, expiresAt, reason });
};

/**
 * Clean up expired tokens (run periodically)
 */
TokenBlacklist.cleanup = async function() {
  return this.destroy({
    where: {
      expiresAt: { [require('sequelize').Op.lt]: new Date() }
    }
  });
};

module.exports = TokenBlacklist;
