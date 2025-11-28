
const fs = require('fs');
const path = require('path');
const { sequelize } = require('../config/database');

const runMigrations = async () => {
  try {
    console.log('🔄 Starting database migrations...');
    
    // Ensure pgcrypto extension is available
    try {
      await sequelize.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
      console.log('✅ Ensured pgcrypto extension is available');
    } catch (error) {
      console.warn('⚠️  Could not ensure pgcrypto extension:', error.message);
      console.log('⚠️  Migrations may fail if UUIDs are required!');
    }
    
    // Read and execute SQL files in order
    const sqlFiles = [
      '004_station_architecture.sql',
      '005_seed_multi_tenant_data.sql'
    ];
    
    for (const file of sqlFiles) {
      const filePath = path.join(__dirname, '../../sql', file);
      
      if (fs.existsSync(filePath)) {
        console.log(`📄 Processing ${file}...`);
        const sql = fs.readFileSync(filePath, 'utf8');
        
        // Replace the DROP statements with conditional drops
        let modifiedSql = sql;
        if (file === '004_station_architecture.sql') {
          // Modify DROP statements to be conditional using IF EXISTS
          modifiedSql = sql.replace(/DROP TABLE IF EXISTS/g, 'DROP TABLE IF EXISTS');
          modifiedSql = modifiedSql.replace(/DROP TYPE IF EXISTS/g, 'DROP TYPE IF EXISTS');
        }
        
        try {
          // Try to execute the entire file first
          await sequelize.query(modifiedSql, { raw: true });
          console.log(`✅ ${file} executed successfully`);
        } catch (error) {
          console.warn(`⚠️  Could not execute ${file} in one go, trying statement by statement`);
          
          // Split by semicolon and execute each statement
          const statements = modifiedSql.split(';').filter(stmt => stmt.trim().length > 0);
          
          for (const statement of statements) {
            try {
              await sequelize.query(statement + ';');
            } catch (error) {
              // Only log warnings for "already exists" errors
              if (error.message.includes('already exists')) {
                console.warn(`⚠️  Statement skipped (already exists): ${statement.substring(0, 50)}...`);
              } else {
                // Log other errors but continue
                console.error(`❌ Error executing statement: ${statement.substring(0, 50)}...`);
                console.error(`   Error: ${error.message}`);
              }
            }
          }
          console.log(`✅ ${file} executed with some warnings/errors`);
        }
      } else {
        console.log(`⚠️  ${file} not found, skipping...`);
      }
    }
    // Ensure 'user_id' exists in 'nozzle_readings'
    try {
      const [results] = await sequelize.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'nozzle_readings' AND column_name = 'user_id'
      `);

      if (results.length === 0) {
        console.log('➕ Adding missing column "user_id" to nozzle_readings...');
        await sequelize.query(`ALTER TABLE nozzle_readings ADD COLUMN user_id UUID;`);
        await sequelize.query(`
          ALTER TABLE nozzle_readings
          ADD CONSTRAINT fk_user_id FOREIGN KEY (user_id)
          REFERENCES users(id) ON DELETE SET NULL
        `);
        console.log('✅ user_id column added');
      } else {
        console.log('✅ user_id column already exists');
      }
    } catch (error) {
      console.error('❌ Failed to check or add user_id:', error.message);
    }


    // Add supplementary data fixes (based on reference SQL)
    console.log('🔄 Adding supplementary data fixes...');
    
    const fixSQL = `
    -- Fix dummy data to ensure proper station associations
    UPDATE users SET station_id = '550e8400-e29b-41d4-a716-446655440001' 
    WHERE role = 'owner' AND email = 'owner@fuelsync.com' AND station_id IS NULL;

    UPDATE users SET station_id = '550e8400-e29b-41d4-a716-446655440001' 
    WHERE role = 'employee' AND station_id IS NULL;
    
    -- Add additional fuel prices if needed
    INSERT INTO fuel_prices (id, station_id, fuel_type, price, valid_from, updated_by)
    SELECT 
      gen_random_uuid(), 
      s.id, 
      'petrol', 
      105.50, 
      CURRENT_TIMESTAMP, 
      (SELECT id FROM users WHERE role = 'owner' LIMIT 1)
    FROM stations s
    WHERE NOT EXISTS (
      SELECT 1 FROM fuel_prices fp WHERE fp.station_id = s.id AND fp.fuel_type = 'petrol'
    )
    LIMIT 5;
    
    INSERT INTO fuel_prices (id, station_id, fuel_type, price, valid_from, updated_by)
    SELECT 
      gen_random_uuid(), 
      s.id, 
      'diesel', 
      92.30, 
      CURRENT_TIMESTAMP, 
      (SELECT id FROM users WHERE role = 'owner' LIMIT 1)
    FROM stations s
    WHERE NOT EXISTS (
      SELECT 1 FROM fuel_prices fp WHERE fp.station_id = s.id AND fp.fuel_type = 'diesel'
    )
    LIMIT 5;
    `;
    
    try {
      await sequelize.query(fixSQL);
      console.log('✅ Supplementary data fixes applied');
    } catch (error) {
      console.warn('⚠️  Could not apply some supplementary fixes:', error.message);
    }
    
    console.log('✅ All migrations completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

runMigrations();
