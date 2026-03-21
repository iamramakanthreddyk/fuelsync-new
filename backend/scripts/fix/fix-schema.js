/**
 * Fix SQLite schema - add missing columns to existing tables
 * This script detects which columns are missing and adds them
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data/fuelsync.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err);
    process.exit(1);
  }
  console.log('✅ Connected to SQLite database');
});

// Get table info
const getTableInfo = (tableName) => {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${tableName})`, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

// Add column if it doesn't exist
const addColumn = (tableName, columnName, columnDef) => {
  return new Promise((resolve, reject) => {
    db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`, (err) => {
      if (err) {
        if (err.message.includes('duplicate column name')) {
          console.log(`⚠️  Column ${columnName} already exists in ${tableName}`);
          resolve();
        } else {
          reject(err);
        }
      } else {
        console.log(`✅ Added column ${columnName} to ${tableName}`);
        resolve();
      }
    });
  });
};

// Main migration
const migrate = async () => {
  try {
    console.log('\n🔧 Starting schema migration...\n');

    // Check pumps table
    console.log('Checking pumps table...');
    let pumpColumns = await getTableInfo('pumps');
    let pumpColumnNames = pumpColumns.map(col => col.name);
    
    if (!pumpColumnNames.includes('pump_number')) {
      console.log('  ❌ Missing pump_number column');
      await addColumn('pumps', 'pump_number', 'INTEGER NOT NULL DEFAULT 1');
    } else {
      console.log('  ✅ pump_number column exists');
    }

    // Check nozzles table
    console.log('\nChecking nozzles table...');
    let nozzleColumns = await getTableInfo('nozzles');
    let nozzleColumnNames = nozzleColumns.map(col => col.name);
    
    if (!nozzleColumnNames.includes('nozzle_number')) {
      console.log('  ❌ Missing nozzle_number column');
      await addColumn('nozzles', 'nozzle_number', 'INTEGER NOT NULL DEFAULT 1');
    } else {
      console.log('  ✅ nozzle_number column exists');
    }

    if (!nozzleColumnNames.includes('fuel_type')) {
      console.log('  ❌ Missing fuel_type column');
      await addColumn('nozzles', 'fuel_type', 'TEXT NOT NULL DEFAULT "petrol"');
    } else {
      console.log('  ✅ fuel_type column exists');
    }

    console.log('\n✅ Schema migration completed successfully!\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
};

db.serialize(() => {
  migrate();
});
