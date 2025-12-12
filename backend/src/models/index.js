/**
 * Models Index
 * Central export for all Sequelize models
 * Auto-syncs database tables on startup
 * 
 * Supports: SQLite (default) and PostgreSQL
 * Set DB_DIALECT=postgres in .env to use PostgreSQL
 */

console.log('📝 [MODELS] Loading models...');

const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');

// Load .env only if it exists locally (development)
const envPath = path.join(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
  console.log('📝 [MODELS] Loaded .env file');
} else {
  console.log('📝 [MODELS] No .env file (using environment variables)');
}

const { DEFAULT_PLAN_LIMITS } = require('../config/constants');

// Determine dialect from environment
// LOCAL DEVELOPMENT: Use SQLite (no setup needed, data in ./data/fuelsync.db)
// PRODUCTION: Use PostgreSQL via DATABASE_URL from Railway
const isProduction = process.env.NODE_ENV === 'production';
const hasPostgresUrl = process.env.DATABASE_URL && isProduction;
const dialect = hasPostgresUrl ? 'postgres' : (process.env.DB_DIALECT || 'sqlite');

console.log('📝 [MODELS] Dialect:', dialect);
console.log('📝 [MODELS] Production:', isProduction);
console.log('📝 [MODELS] Has DATABASE_URL:', !!process.env.DATABASE_URL);

// Create Sequelize instance based on dialect
let sequelize;

if (dialect === 'sqlite') {
  // SQLite configuration (zero setup)
  const dataDir = path.join(__dirname, '../../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const storagePath = path.join(dataDir, 'fuelsync.db');
  
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: storagePath,
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    define: {
      underscored: true,
      timestamps: true
    }
  });
  console.log(`📁 Using SQLite: ${storagePath}`);
} else {
  // PostgreSQL configuration
  // If DATABASE_URL is provided, use it directly (Railway style)
  if (process.env.DATABASE_URL) {
    console.log('📝 [MODELS] Connecting to PostgreSQL via DATABASE_URL');
    sequelize = new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: false,
      pool: {
        max: 5,
        min: 0,
        acquire: 5000,  // 5 second timeout
        idle: 5000
      },
      define: {
        underscored: true,
        timestamps: true
      }
    });
  } else {
    // Fallback to component-based configuration
    const config = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'fuelsync',
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
    };

    sequelize = new Sequelize(
      config.database,
      config.username,
      config.password,
      {
        host: config.host,
        port: config.port,
        dialect: 'postgres',
        logging: false,
        pool: {
          max: 5,
          min: 0,
          acquire: 5000,  // 5 second timeout
          idle: 5000
        },
        define: {
          underscored: true,
          timestamps: true
        }
      }
    );
    console.log(`🐘 Using PostgreSQL: ${config.host}:${config.port}/${config.database}`);
  }
}

// Import models - Order matters for foreign key dependencies
const Plan = require('./Plan')(sequelize);
const Station = require('./Station')(sequelize);
const User = require('./User')(sequelize);
const Pump = require('./Pump')(sequelize);
const Nozzle = require('./Nozzle')(sequelize);
const FuelPrice = require('./FuelPrice')(sequelize);
const NozzleReading = require('./NozzleReading')(sequelize);
const Creditor = require('./Creditor')(sequelize);
const CreditTransaction = require('./CreditTransaction')(sequelize);
const Expense = require('./Expense')(sequelize);
const CostOfGoods = require('./CostOfGoods')(sequelize);
// New models for enhanced functionality
const Tank = require('./Tank')(sequelize);
const TankRefill = require('./TankRefill')(sequelize);
const Shift = require('./Shift')(sequelize);
const AuditLog = require('./AuditLog')(sequelize);
const Settlement = require('./Settlement')(sequelize);

// Create models object for associations
const models = {
  Plan,
  Station,
  User,
  Pump,
  Nozzle,
  FuelPrice,
  NozzleReading,
  Creditor,
  CreditTransaction,
  Expense,
  CostOfGoods,
  Tank,
  TankRefill,
  Shift,
  AuditLog,
  Settlement
};

// Run associations
Object.keys(models).forEach(modelName => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

// ============================================
// NEW MODEL ASSOCIATIONS
// ============================================

// Tank associations
Tank.belongsTo(Station, { foreignKey: 'stationId', as: 'station' });
Station.hasMany(Tank, { foreignKey: 'stationId', as: 'tanks' });

// TankRefill associations
TankRefill.belongsTo(Tank, { foreignKey: 'tankId', as: 'tank' });
Tank.hasMany(TankRefill, { foreignKey: 'tankId', as: 'refills' });
TankRefill.belongsTo(Station, { foreignKey: 'stationId', as: 'station' });
TankRefill.belongsTo(User, { foreignKey: 'enteredBy', as: 'enteredByUser' });
TankRefill.belongsTo(User, { foreignKey: 'verifiedBy', as: 'verifiedByUser' });

// Shift associations
Shift.belongsTo(Station, { foreignKey: 'stationId', as: 'station' });
Station.hasMany(Shift, { foreignKey: 'stationId', as: 'shifts' });
Shift.belongsTo(User, { foreignKey: 'employeeId', as: 'employee' });
User.hasMany(Shift, { foreignKey: 'employeeId', as: 'shifts' });
Shift.belongsTo(User, { foreignKey: 'endedBy', as: 'endedByUser' });

// AuditLog associations
AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });
AuditLog.belongsTo(Station, { foreignKey: 'stationId', as: 'station' });

// NozzleReading-Shift association (Shift.hasMany only - belongsTo is in model's associate)
Shift.hasMany(NozzleReading, { foreignKey: 'shiftId', as: 'readings' });

/**
 * Sync database tables
 * @param {Object} options - Sequelize sync options
 * @param {boolean} options.force - Drop tables before recreating (DANGEROUS)
 * @param {boolean} options.alter - Alter tables to match models
 */
const syncDatabase = async (options = {}) => {
  console.log('📝 [SYNC] Starting database sync...');
  try {
    // Add connection timeout - very short, fail fast
    const connectionTimeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout')), 5000)
    );
    
    console.log('📝 [SYNC] Authenticating connection...');
    await Promise.race([sequelize.authenticate(), connectionTimeout]);
    console.log('✅ [SYNC] Database connection established');
    
    // Sync all models with minimal wait
    // Note: alter:true may fail with Sequelize + PostgreSQL ENUM columns
    // but tables should already exist from previous deployments
    console.log('📝 [SYNC] Syncing tables...');
    try {
      await sequelize.sync(options);
      console.log('✅ [SYNC] Database tables synced');
    } catch (syncError) {
      // Ignore USING syntax errors - tables likely already exist
      if (syncError.message.includes('USING') || syncError.message.includes('syntax error')) {
        console.warn('⚠️  [SYNC] Ignoring ENUM alter error (tables exist):', syncError.message.split('\n')[0]);
        return true; // Still consider this a success - tables exist
      }
      throw syncError;
    }
    
    return true;
  } catch (error) {
    console.error('❌ [SYNC] Database sync failed:', error.message);
    console.error('📝 [SYNC] Will continue with existing tables');
    // Don't throw - let server continue
    return false;
  }
};

/**
 * Seed default data (plans, super admin)
 */
const seedDefaultData = async () => {
  try {
    // Check if plans exist
    const planCount = await Plan.count();
    if (planCount === 0) {
      console.log('📦 Seeding default plans...');
      
      const plans = Object.entries(DEFAULT_PLAN_LIMITS).map(([name, limits], index) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1), // Capitalize
        description: `${name.charAt(0).toUpperCase() + name.slice(1)} plan`,
        sortOrder: index,
        ...limits
      }));
      
      await Plan.bulkCreate(plans);
      console.log('✅ Default plans created');
    }
    
    // Check if super admin exists
    const adminExists = await User.findOne({ where: { role: 'super_admin' } });
    if (!adminExists) {
      console.log('📦 Creating super admin user...');
      
      const premiumPlan = await Plan.findOne({ where: { name: 'Premium' } });
      
      await User.create({
        email: 'admin@fuelsync.com',
        password: 'admin123', // Will be hashed by hook
        name: 'Super Admin',
        role: 'super_admin',
        planId: premiumPlan?.id
      });
      console.log('✅ Super admin created (admin@fuelsync.com / admin123)');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
};

module.exports = {
  sequelize,
  Sequelize,
  ...models,
  syncDatabase,
  seedDefaultData
};
