
const fs = require('fs');
const path = require('path');
const { sequelize } = require('../config/database');

const setupDatabase = async () => {
  try {
    console.log('🔄 Setting up FuelSync database...');
    
    // Test connection first
    await sequelize.authenticate();
    console.log('✅ Database connection established');
    
    // Drop all tables if they exist (fresh start)
    console.log('🗑️  Dropping existing tables...');
    
    // Drop tables in the correct order to avoid foreign key constraint errors
    const tablesToDrop = [
      'sales', 'ocr_readings', 'uploads', 'nozzles', 
      'pumps', 'fuel_prices', 'users', 'stations', 'plans'
    ];
    
    for (const table of tablesToDrop) {
      try {
        await sequelize.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
        console.log(`✅ Dropped table: ${table}`);
      } catch (error) {
        console.warn(`⚠️  Could not drop table ${table}: ${error.message}`);
      }
    }
    
    // Drop custom types
    try {
      await sequelize.query('DROP TYPE IF EXISTS user_role CASCADE');
      await sequelize.query('DROP TYPE IF EXISTS fuel_type CASCADE');
      await sequelize.query('DROP TYPE IF EXISTS upload_status CASCADE');
      await sequelize.query('DROP TYPE IF EXISTS shift_type CASCADE');
      await sequelize.query('DROP TYPE IF EXISTS plan_name CASCADE');
      console.log('✅ Dropped custom types');
    } catch (error) {
      console.warn('⚠️  Could not drop types, continuing anyway:', error.message);
    }
    
    // Read and execute SQL files in order
    const sqlFiles = [
      '004_station_architecture.sql',
      '005_seed_multi_tenant_data.sql'
    ];
    
    for (const file of sqlFiles) {
      const filePath = path.join(__dirname, '../../sql', file);
      
      if (fs.existsSync(filePath)) {
        console.log(`📄 Executing ${file}...`);
        const sql = fs.readFileSync(filePath, 'utf8');
        
        try {
          // Execute entire SQL file at once (better for complex scripts)
          await sequelize.query(sql, { raw: true });
          console.log(`✅ ${file} executed successfully`);
        } catch (error) {
          // If executing the entire file fails, try statement by statement
          console.warn(`⚠️  Could not execute ${file} in one go, trying statement by statement`);
          
          // Split by semicolon to execute each statement separately
          const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
          
          for (const statement of statements) {
            try {
              await sequelize.query(statement + ';');
            } catch (error) {
              // Log warning but continue
              console.warn(`⚠️  Warning in ${file}: ${error.message}`);
            }
          }
          console.log(`✅ ${file} executed with some warnings`);
        }
      } else {
        console.log(`⚠️  ${file} not found, skipping...`);
      }
    }
    
    // Verify setup by checking if admin user exists
    try {
      const [results] = await sequelize.query("SELECT email, role FROM users WHERE email = 'admin@fuelsync.com'");
      
      if (results.length > 0) {
        console.log('✅ Database setup completed successfully!');
        console.log('🔑 Demo credentials:');
        console.log('   Admin: admin@fuelsync.com / admin123');
        console.log('   Owner: owner@fuelsync.com / owner123');
        console.log('   Manager: manager@fuelsync.com / manager123');
        console.log('   Employee: employee@fuelsync.com / employee123');
      } else {
        console.log('⚠️  Setup completed but admin user not found');
      }
    } catch (error) {
      console.error('❌ Could not verify setup:', error.message);
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
};

setupDatabase();
