/**
 * Models Index
 * Central export for all Sequelize models with associations
 */

const { sequelize } = require('../config/database');

// Import all models
const User = require('./MultiTenantUser');
const Station = require('./Station');
const Plan = require('./Plan');
const Pump = require('./MultiTenantPump');
const Nozzle = require('./MultiTenantNozzle');
const FuelPrice = require('./MultiTenantFuelPrice');
const Upload = require('./Upload');
const OCRReading = require('./MultiTenantOCRReading');
const Sale = require('./MultiTenantSale');
const FuelTank = require('./FuelTank');
const FuelDelivery = require('./FuelDelivery');
const DailyClosure = require('./DailyClosure');
const AuditLog = require('./AuditLog');
const TokenBlacklist = require('./TokenBlacklist');
const PasswordResetToken = require('./PasswordResetToken');

// ============================================
// ASSOCIATIONS
// ============================================

// --- User Associations ---
User.belongsTo(Station, { foreignKey: 'stationId', as: 'station' });
User.belongsTo(Plan, { foreignKey: 'planId', as: 'plan' });
User.hasMany(Upload, { foreignKey: 'userId', as: 'uploads' });
User.hasMany(OCRReading, { foreignKey: 'enteredBy', as: 'enteredReadings' });
User.hasMany(Sale, { foreignKey: 'createdBy', as: 'createdSales' });
User.hasMany(DailyClosure, { foreignKey: 'preparedBy', as: 'preparedClosures' });
User.hasMany(DailyClosure, { foreignKey: 'approvedBy', as: 'approvedClosures' });
User.hasMany(FuelDelivery, { foreignKey: 'receivedBy', as: 'receivedDeliveries' });
User.hasMany(AuditLog, { foreignKey: 'userId', as: 'auditLogs' });

// --- Station Associations ---
Station.hasMany(User, { foreignKey: 'stationId', as: 'users' });
Station.hasMany(Pump, { foreignKey: 'stationId', as: 'pumps' });
Station.hasMany(FuelPrice, { foreignKey: 'stationId', as: 'fuelPrices' });
Station.hasMany(Upload, { foreignKey: 'stationId', as: 'uploads' });
Station.hasMany(OCRReading, { foreignKey: 'stationId', as: 'ocrReadings' });
Station.hasMany(Sale, { foreignKey: 'stationId', as: 'sales' });
Station.hasMany(FuelTank, { foreignKey: 'stationId', as: 'fuelTanks' });
Station.hasMany(FuelDelivery, { foreignKey: 'stationId', as: 'fuelDeliveries' });
Station.hasMany(DailyClosure, { foreignKey: 'stationId', as: 'dailyClosures' });
Station.hasMany(AuditLog, { foreignKey: 'stationId', as: 'auditLogs' });

// --- Plan Associations ---
Plan.hasMany(User, { foreignKey: 'planId', as: 'users' });

// --- Pump Associations ---
Pump.belongsTo(Station, { foreignKey: 'stationId', as: 'station' });
Pump.hasMany(Nozzle, { foreignKey: 'pumpId', as: 'nozzles' });
Pump.hasMany(OCRReading, { foreignKey: 'pumpId', as: 'ocrReadings' });
Pump.hasMany(Sale, { foreignKey: 'pumpId', as: 'sales' });

// --- Nozzle Associations ---
Nozzle.belongsTo(Pump, { foreignKey: 'pumpId', as: 'pump' });

// --- FuelPrice Associations ---
FuelPrice.belongsTo(Station, { foreignKey: 'stationId', as: 'station' });
FuelPrice.belongsTo(User, { foreignKey: 'updatedBy', as: 'updatedByUser' });

// --- Upload Associations ---
Upload.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Upload.belongsTo(Station, { foreignKey: 'stationId', as: 'station' });
Upload.hasMany(OCRReading, { foreignKey: 'uploadId', as: 'ocrReadings' });

// --- OCRReading Associations ---
OCRReading.belongsTo(Upload, { foreignKey: 'uploadId', as: 'upload' });
OCRReading.belongsTo(Station, { foreignKey: 'stationId', as: 'station' });
OCRReading.belongsTo(Pump, { foreignKey: 'pumpId', as: 'pump' });
OCRReading.belongsTo(User, { foreignKey: 'enteredBy', as: 'enteredByUser' });
OCRReading.hasMany(Sale, { foreignKey: 'readingId', as: 'sales' });

// --- Sale Associations ---
Sale.belongsTo(Station, { foreignKey: 'stationId', as: 'station' });
Sale.belongsTo(Pump, { foreignKey: 'pumpId', as: 'pump' });
Sale.belongsTo(OCRReading, { foreignKey: 'readingId', as: 'reading' });
Sale.belongsTo(User, { foreignKey: 'createdBy', as: 'createdByUser' });

// --- FuelTank Associations ---
FuelTank.belongsTo(Station, { foreignKey: 'stationId', as: 'station' });
FuelTank.hasMany(FuelDelivery, { foreignKey: 'tankId', as: 'deliveries' });

// --- FuelDelivery Associations ---
FuelDelivery.belongsTo(Station, { foreignKey: 'stationId', as: 'station' });
FuelDelivery.belongsTo(FuelTank, { foreignKey: 'tankId', as: 'tank' });
FuelDelivery.belongsTo(User, { foreignKey: 'receivedBy', as: 'receivedByUser' });
FuelDelivery.belongsTo(User, { foreignKey: 'verifiedBy', as: 'verifiedByUser' });

// --- DailyClosure Associations ---
DailyClosure.belongsTo(Station, { foreignKey: 'stationId', as: 'station' });
DailyClosure.belongsTo(User, { foreignKey: 'preparedBy', as: 'preparedByUser' });
DailyClosure.belongsTo(User, { foreignKey: 'approvedBy', as: 'approvedByUser' });

// --- AuditLog Associations ---
AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });
AuditLog.belongsTo(Station, { foreignKey: 'stationId', as: 'station' });

// --- PasswordResetToken Associations ---
PasswordResetToken.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(PasswordResetToken, { foreignKey: 'userId', as: 'passwordResetTokens' });

// ============================================
// EXPORTS
// ============================================

module.exports = {
  sequelize,
  User,
  Station,
  Plan,
  Pump,
  Nozzle,
  FuelPrice,
  Upload,
  OCRReading,
  Sale,
  FuelTank,
  FuelDelivery,
  DailyClosure,
  AuditLog,
  TokenBlacklist,
  PasswordResetToken
};
