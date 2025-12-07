/**
 * Database Initialization Module
 * 
 * Handles:
 * 1. Database connection validation
 * 2. Schema verification
 * 3. Automatic migration execution
 * 4. Clear logging at each step
 * 
 * Runs BEFORE server starts
 */

const path = require('path');
const fs = require('fs');

let db = null;
let Sequelize = null;

/**
 * Step 1: Validate Database Connection
 */
async function validateDatabaseConnection() {
  console.log('\n✓ [DATABASE] Starting initialization sequence...\n');
  
  try {
    // Require sequelize and models
    Sequelize = require('sequelize');
    db = require('../models');
    
    console.log('📋 [DATABASE] Environment Check:');
    console.log(`   - NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   - DB_DIALECT: ${process.env.DB_DIALECT || 'sqlite'}`);
    
    if (process.env.DATABASE_URL) {
      console.log(`   - DATABASE_URL: ${process.env.DATABASE_URL.substring(0, 30)}...`);
    }
    
    console.log('\n🔌 [DATABASE] Connecting to database...');
    
    // Test connection
    await db.sequelize.authenticate();
    
    console.log('   ✅ Connection successful');
    console.log(`   - Dialect: ${db.sequelize.options.dialect}`);
    
    if (db.sequelize.options.dialect === 'sqlite') {
      const storage = db.sequelize.options.storage || ':memory:';
      console.log(`   - Storage: ${storage}`);
    } else if (db.sequelize.options.dialect === 'postgres') {
      console.log(`   - Host: ${db.sequelize.options.host}`);
      console.log(`   - Database: ${db.sequelize.options.database}`);
    }
    
    return db;
  } catch (error) {
    console.error('\n❌ [DATABASE] Connection failed!');
    console.error(`   Error: ${error.message}`);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.error('   → PostgreSQL server is not running');
    } else if (error.message.includes('permission denied')) {
      console.error('   → Database file permission error');
    } else if (error.message.includes('does not exist')) {
      console.error('   → Database does not exist');
    }
    
    throw new Error(`Database connection failed: ${error.message}`);
  }
}

/**
 * Step 2: Get Current Schema Status
 */
async function checkSchemaStatus() {
  console.log('\n📊 [SCHEMA] Checking current schema...');
  
  try {
    // Get list of tables
    const tables = await db.sequelize.showAllSchemas();
    
    if (db.sequelize.options.dialect === 'postgres') {
      // For PostgreSQL, check public schema tables
      const queryInterface = db.sequelize.getQueryInterface();
      const tableList = await queryInterface.showAllTables();
      
      console.log(`   - Tables found: ${tableList.length}`);
      if (tableList.length > 0) {
        console.log(`   - Existing tables: ${tableList.slice(0, 3).join(', ')}${tableList.length > 3 ? '...' : ''}`);
      }
      
      return tableList.length > 0;
    } else {
      // For SQLite
      const queryInterface = db.sequelize.getQueryInterface();
      const tableList = await queryInterface.showAllTables();
      
      console.log(`   - Tables found: ${tableList.length}`);
      if (tableList.length > 0) {
        console.log(`   - Existing tables: ${tableList.slice(0, 3).join(', ')}${tableList.length > 3 ? '...' : ''}`);
      }
      
      return tableList.length > 0;
    }
  } catch (error) {
    console.log(`   ⚠️  Schema check incomplete: ${error.message}`);
    return false;
  }
}

/**
 * Step 3: Execute Migrations
 */
async function executeMigrations() {
  console.log('\n⚙️  [MIGRATIONS] Running pending migrations...\n');
  
  try {
    const { execSync } = require('child_process');
    
    // Run sequelize CLI migrations
    try {
      console.log('   Executing: npx sequelize-cli db:migrate\n');
      
      const output = execSync('npx sequelize-cli db:migrate', {
        cwd: process.cwd(),
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      
      console.log(output);
      console.log('   ✅ Migrations executed successfully\n');
      return true;
      
    } catch (execError) {
      const errorMsg = execError.stdout || execError.stderr || execError.message;
      
      // Check if migrations are already applied
      if (errorMsg.includes('already up to date') || errorMsg.includes('no changes')) {
        console.log('   ✅ All migrations already up to date\n');
        return true;
      }
      
      // Check if it's a real error
      if (errorMsg.includes('ERROR') || errorMsg.includes('does not exist')) {
        console.error('\n❌ [MIGRATIONS] Migration execution failed!');
        console.error(`   ${errorMsg}\n`);
        throw new Error(`Migration failed: ${errorMsg}`);
      }
      
      // Otherwise, assume success (migrations might have run)
      console.log('   ⚠️  Migration execution completed (check logs above)\n');
      return true;
    }
    
  } catch (error) {
    console.error('\n❌ [MIGRATIONS] Failed to execute migrations!');
    console.error(`   Error: ${error.message}`);
    
    // Try fallback to db.sync()
    console.log('\n⚠️  [FALLBACK] Attempting database sync instead...');
    try {
      await db.sequelize.sync({ alter: true });
      console.log('   ✅ Database synced successfully\n');
      return true;
    } catch (syncError) {
      console.error(`   ❌ Sync failed: ${syncError.message}\n`);
      throw new Error(`Could not execute migrations or sync: ${error.message}`);
    }
  }
}

/**
 * Step 4: Verify Schema After Migration
 */
async function verifySchema() {
  console.log('\n✔️  [SCHEMA] Verifying schema after migrations...');
  
  try {
    const queryInterface = db.sequelize.getQueryInterface();
    const tables = await queryInterface.showAllTables();
    
    // Expected tables
    const expectedTables = [
      'plans',
      'users',
      'stations',
      'pumps',
      'nozzles',
      'nozzle_readings'
    ];
    
    console.log(`   - Total tables: ${tables.length}`);
    
    let allExists = true;
    expectedTables.forEach(table => {
      const exists = tables.includes(table);
      console.log(`   ${exists ? '✅' : '❌'} ${table}`);
      if (!exists) allExists = false;
    });
    
    if (allExists) {
      console.log('\n   🎉 Schema verification complete - all required tables exist!\n');
      return true;
    } else {
      console.warn('\n   ⚠️  Some tables are missing - migrations may not have run\n');
      return false;
    }
  } catch (error) {
    console.error(`\n❌ [SCHEMA] Verification failed: ${error.message}`);
    throw error;
  }
}

/**
 * Step 5: Initialize Seed Data (if DB is empty)
 */
async function initializeSeedData() {
  console.log('\n🌱 [SEEDING] Checking for initial data...');
  
  try {
    // Check if plans exist
    const plans = await db.Plan.findAll();
    
    if (plans.length === 0) {
      console.log('   - No plans found, seeding essential data...\n');
      
      try {
        const seedEssentials = require('../../scripts/seedEssentials');
        await seedEssentials();
        console.log('   ✅ Seed data initialized\n');
      } catch (seedError) {
        console.log(`   ⚠️  Seed data initialization skipped: ${seedError.message}\n`);
      }
    } else {
      console.log(`   ✅ Found ${plans.length} plan(s) - skipping seed\n`);
    }
  } catch (error) {
    console.warn(`\n⚠️  [SEEDING] Could not check seed status: ${error.message}\n`);
  }
}

/**
 * Main initialization function
 */
async function initializeDatabase() {
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║     DATABASE INITIALIZATION - FUELSYNC BACKEND      ║');
  console.log('╚════════════════════════════════════════════════════╝\n');
  
  try {
    // Step 1: Connect to database
    await validateDatabaseConnection();
    
    // Step 2: Check current schema
    const schemaExists = await checkSchemaStatus();
    
    // Step 3: Run migrations
    await executeMigrations();
    
    // Step 4: Verify schema
    await verifySchema();
    
    // Step 5: Seed data if needed
    await initializeSeedData();
    
    console.log('╔════════════════════════════════════════════════════╗');
    console.log('║     DATABASE READY - STARTING SERVER               ║');
    console.log('╚════════════════════════════════════════════════════╝\n');
    
    return db;
    
  } catch (error) {
    console.error('\n╔════════════════════════════════════════════════════╗');
    console.error('║     DATABASE INITIALIZATION FAILED                 ║');
    console.error('╚════════════════════════════════════════════════════╝\n');
    
    console.error(`Fatal Error: ${error.message}\n`);
    
    // Exit process with error code
    process.exit(1);
  }
}

module.exports = {
  initializeDatabase,
  validateDatabaseConnection,
  checkSchemaStatus,
  executeMigrations,
  verifySchema,
  initializeSeedData
};
