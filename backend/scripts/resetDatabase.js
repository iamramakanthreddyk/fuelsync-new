/**
 * Reset Database Script
 * Completely drops all tables and recreates schema fresh
 * Use this when schema migrations fail
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const { sequelize } = require('../src/models');

const resetDatabase = async () => {
  try {
    console.log('🔥 WARNING: About to DROP ALL TABLES in database!');
    console.log('⏳ Waiting 3 seconds... (press Ctrl+C to cancel)');
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('🗑️  Dropping all tables...');
    
    // Drop all tables in cascade
    await sequelize.query(`
      DO $$ 
      DECLARE 
        r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') 
        LOOP
          EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `);
    
    console.log('✅ All tables dropped');
    
    // Drop all enums
    console.log('🗑️  Dropping all enums...');
    await sequelize.query(`
      DO $$ 
      DECLARE 
        r RECORD;
      BEGIN
        FOR r IN (SELECT typname FROM pg_type WHERE typkind = 'e' AND typnamespace = 'public'::regnamespace) 
        LOOP
          EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(r.typname) || ' CASCADE';
        END LOOP;
      END $$;
    `);
    
    console.log('✅ All enums dropped');
    console.log('✅ Database completely reset!');
    console.log('');
    console.log('Next step: Restart your application');
    console.log('The app will auto-create all tables fresh with correct schema');
    
    await sequelize.close();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error resetting database:', error.message);
    process.exit(1);
  }
};

resetDatabase();
