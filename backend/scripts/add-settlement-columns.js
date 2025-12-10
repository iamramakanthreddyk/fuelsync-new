/**
 * Add missing columns to SQLite database for settlement feature
 */
const { Sequelize } = require('sequelize');
const path = require('path');

async function addMissingColumns() {
  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '../data/fuelsync.db'),
    logging: console.log
  });

  try {
    console.log('Adding settlement_id to nozzle_readings...');
    await sequelize.query('ALTER TABLE nozzle_readings ADD COLUMN settlement_id TEXT REFERENCES settlements(id)').catch(e => {
      if (e.message.includes('duplicate column')) console.log('Column already exists');
      else console.log('Note:', e.message);
    });

    console.log('Adding employee_cash to settlements...');
    await sequelize.query('ALTER TABLE settlements ADD COLUMN employee_cash DECIMAL(12,2) DEFAULT 0').catch(e => {
      if (e.message.includes('duplicate column')) console.log('Column already exists');
      else console.log('Note:', e.message);
    });

    console.log('Adding employee_online to settlements...');
    await sequelize.query('ALTER TABLE settlements ADD COLUMN employee_online DECIMAL(12,2) DEFAULT 0').catch(e => {
      if (e.message.includes('duplicate column')) console.log('Column already exists');
      else console.log('Note:', e.message);
    });

    console.log('Adding employee_credit to settlements...');
    await sequelize.query('ALTER TABLE settlements ADD COLUMN employee_credit DECIMAL(12,2) DEFAULT 0').catch(e => {
      if (e.message.includes('duplicate column')) console.log('Column already exists');
      else console.log('Note:', e.message);
    });

    console.log('Adding variance_online to settlements...');
    await sequelize.query('ALTER TABLE settlements ADD COLUMN variance_online DECIMAL(12,2) DEFAULT 0').catch(e => {
      if (e.message.includes('duplicate column')) console.log('Column already exists');
      else console.log('Note:', e.message);
    });

    console.log('Adding variance_credit to settlements...');
    await sequelize.query('ALTER TABLE settlements ADD COLUMN variance_credit DECIMAL(12,2) DEFAULT 0').catch(e => {
      if (e.message.includes('duplicate column')) console.log('Column already exists');
      else console.log('Note:', e.message);
    });

    console.log('Adding is_final to settlements...');
    await sequelize.query('ALTER TABLE settlements ADD COLUMN is_final INTEGER DEFAULT 0').catch(e => {
      if (e.message.includes('duplicate column')) console.log('Column already exists');
      else console.log('Note:', e.message);
    });

    console.log('Adding finalized_at to settlements...');
    await sequelize.query('ALTER TABLE settlements ADD COLUMN finalized_at DATETIME').catch(e => {
      if (e.message.includes('duplicate column')) console.log('Column already exists');
      else console.log('Note:', e.message);
    });

    console.log('\nAll migrations completed!');
    await sequelize.close();
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

addMissingColumns();
