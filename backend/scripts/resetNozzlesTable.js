// Script to drop and recreate the nozzles table with correct schema
const { Sequelize } = require('sequelize');
const dbConfig = require('../config/database');

// Use the development config by default
const config = dbConfig.development;

const sequelize = new Sequelize(config.database, config.username, config.password, {
  host: config.host,
  port: config.port,
  dialect: config.dialect,
  logging: false
});

(async () => {
  try {
    await sequelize.authenticate();
    console.log('Connected to DB.');
    // Drop the nozzles table if it exists
    await sequelize.query('DROP TABLE IF EXISTS nozzles CASCADE;');
    console.log('Dropped nozzles table.');
    // Recreate the nozzles table with correct schema
    await sequelize.query(`
      CREATE TABLE nozzles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pump_id UUID NOT NULL REFERENCES pumps(id) ON DELETE CASCADE,
        station_id UUID REFERENCES stations(id),
        nozzle_number INTEGER NOT NULL,
        fuel_type VARCHAR(30) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        initial_reading DECIMAL(12,2) DEFAULT 0,
        last_reading DECIMAL(12,2),
        last_reading_date DATE,
        label VARCHAR(50),
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(pump_id, nozzle_number)
      );
    `);
    console.log('Recreated nozzles table with correct schema.');
    await sequelize.close();
    console.log('Done.');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
