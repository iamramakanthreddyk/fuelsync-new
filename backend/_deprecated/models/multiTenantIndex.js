
const Station = require('./Station');
const User = require('./MultiTenantUser');
const Plan = require('./Plan');
const Pump = require('./MultiTenantPump');
const Nozzle = require('./MultiTenantNozzle');
const FuelPrice = require('./MultiTenantFuelPrice');
const Upload = require('./Upload');
const OCRReading = require('./MultiTenantOCRReading');
const Sale = require('./MultiTenantSale');
const NozzleReading = require('./NozzleReading');

// Define associations for multi-tenant architecture

// Station relationships
Station.hasMany(User, { foreignKey: 'stationId', as: 'users' });
Station.hasMany(Pump, { foreignKey: 'stationId', as: 'pumps' });
Station.hasMany(FuelPrice, { foreignKey: 'stationId', as: 'fuelPrices' });
Station.hasMany(Upload, { foreignKey: 'stationId', as: 'uploads' });
Station.hasMany(OCRReading, { foreignKey: 'stationId', as: 'ocrReadings' });
Station.hasMany(Sale, { foreignKey: 'stationId', as: 'sales' });

// User relationships
User.belongsTo(Station, { foreignKey: 'stationId', as: 'station' });
User.belongsTo(Plan, { foreignKey: 'planId', as: 'plan' });
User.hasMany(Upload, { foreignKey: 'userId', as: 'uploads' });
User.hasMany(OCRReading, { foreignKey: 'enteredBy', as: 'ocrReadings' });
User.hasMany(Sale, { foreignKey: 'createdBy', as: 'sales' });
User.hasMany(FuelPrice, { foreignKey: 'updatedBy', as: 'priceUpdates' });
User.hasMany(NozzleReading, { foreignKey: 'userId', as: 'nozzleReadings' });

// Plan relationships
Plan.hasMany(User, { foreignKey: 'planId', as: 'users' });

// Pump relationships
Pump.belongsTo(Station, { foreignKey: 'stationId', as: 'station' });
Pump.hasMany(Nozzle, { foreignKey: 'pumpId', as: 'nozzles' });
Pump.hasMany(OCRReading, { foreignKey: 'pumpId', as: 'ocrReadings' });
Pump.hasMany(Sale, { foreignKey: 'pumpId', as: 'sales' });

// Nozzle relationships
Nozzle.belongsTo(Pump, { foreignKey: 'pumpId', as: 'pump' });

// FuelPrice relationships
FuelPrice.belongsTo(Station, { foreignKey: 'stationId', as: 'station' });
FuelPrice.belongsTo(User, { foreignKey: 'updatedBy', as: 'updatedByUser' });

// Upload relationships
Upload.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Upload.belongsTo(Station, { foreignKey: 'stationId', as: 'station' });
Upload.hasMany(OCRReading, { foreignKey: 'uploadId', as: 'ocrReadings' });

// OCRReading relationships
OCRReading.belongsTo(Upload, { foreignKey: 'uploadId', as: 'upload' });
OCRReading.belongsTo(Station, { foreignKey: 'stationId', as: 'station' });
OCRReading.belongsTo(Pump, { foreignKey: 'pumpId', as: 'pump' });
OCRReading.belongsTo(User, { foreignKey: 'enteredBy', as: 'enteredByUser' });
OCRReading.hasMany(Sale, { foreignKey: 'readingId', as: 'sales' });

// Sale relationships
Sale.belongsTo(Station, { foreignKey: 'stationId', as: 'station' });
Sale.belongsTo(Pump, { foreignKey: 'pumpId', as: 'pump' });
Sale.belongsTo(OCRReading, { foreignKey: 'readingId', as: 'reading' });
Sale.belongsTo(OCRReading, { foreignKey: 'previousReadingId', as: 'previousReading' });
Sale.belongsTo(User, { foreignKey: 'createdBy', as: 'createdByUser' });

// NozzleReading relationships
NozzleReading.belongsTo(User, { foreignKey: 'userId', as: 'user' });

module.exports = {
  Station,
  User,
  Plan,
  Pump,
  Nozzle,
  FuelPrice,
  Upload,
  OCRReading,
  Sale,
  NozzleReading
};
