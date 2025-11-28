/**
 * Password Reset Token Model
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const crypto = require('node:crypto');

const PasswordResetToken = sequelize.define('PasswordResetToken', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'user_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  token: {
    type: DataTypes.STRING(64),
    allowNull: false,
    unique: true
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'expires_at'
  },
  usedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'used_at'
  }
}, {
  tableName: 'password_reset_tokens',
  timestamps: true,
  updatedAt: false,
  underscored: true,
  indexes: [
    { fields: ['token'] },
    { fields: ['user_id'] },
    { fields: ['expires_at'] }
  ]
});

/**
 * Generate a secure reset token
 */
PasswordResetToken.generateToken = function() {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Create a reset token for a user
 */
PasswordResetToken.createForUser = async function(userId, expiresInMinutes = 60) {
  // Invalidate existing tokens
  await this.update(
    { usedAt: new Date() },
    { where: { userId, usedAt: null } }
  );

  const token = this.generateToken();
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  return this.create({ userId, token, expiresAt });
};

/**
 * Validate a reset token
 */
PasswordResetToken.validateToken = async function(token) {
  const resetToken = await this.findOne({
    where: {
      token,
      usedAt: null,
      expiresAt: { [require('sequelize').Op.gt]: new Date() }
    }
  });

  return resetToken;
};

module.exports = PasswordResetToken;
