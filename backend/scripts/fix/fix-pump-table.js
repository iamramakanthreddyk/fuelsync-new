/**
 * Fix pump table - remove bad constraints and add correct composite index
 */
const { Sequelize } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'data/fuelsync.db'),
  logging: console.log
});

(async () => {
  try {
    console.log('🔧 FIXING PUMP TABLE SCHEMA...\n');

    // Step 1: Back up existing data
    console.log('Step 1: Backing up pump data...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS pumps_backup AS 
      SELECT * FROM pumps
    `);
    const backupCount = await sequelize.query(`SELECT COUNT(*) as cnt FROM pumps_backup`, {
      type: Sequelize.QueryTypes.SELECT
    });
    console.log(`  ✓ Backed up ${backupCount[0].cnt} pumps\n`);

    // Step 2: Drop the old pumps table
    console.log('Step 2: Dropping old pumps table...');
    await sequelize.query(`DROP TABLE pumps`);
    console.log('  ✓ Old table dropped\n');

    // Step 3: Create new pumps table with correct constraints
    console.log('Step 3: Creating new pumps table with correct schema...');
    await sequelize.query(`
      CREATE TABLE pumps (
        id UUID PRIMARY KEY,
        station_id UUID NOT NULL,
        name VARCHAR(100) NOT NULL,
        pump_number INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        notes TEXT,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE,
        UNIQUE(station_id, pump_number)
      )
    `);
    console.log('  ✓ New table created with composite unique index\n');

    // Step 4: Restore data
    console.log('Step 4: Restoring pump data...');
    await sequelize.query(`
      INSERT INTO pumps 
      SELECT * FROM pumps_backup
    `);
    const restoredCount = await sequelize.query(`SELECT COUNT(*) as cnt FROM pumps`, {
      type: Sequelize.QueryTypes.SELECT
    });
    console.log(`  ✓ Restored ${restoredCount[0].cnt} pumps\n`);

    // Step 5: Verify
    console.log('Step 5: Verifying schema...');
    const indexes = await sequelize.query(`PRAGMA INDEX_LIST(pumps)`, {
      type: Sequelize.QueryTypes.SELECT
    });
    console.log(`  Indexes found: ${indexes.length}`);
    for (const idx of indexes) {
      const details = await sequelize.query(`PRAGMA INDEX_INFO(${idx.name})`, {
        type: Sequelize.QueryTypes.SELECT
      });
      console.log(`    - ${idx.name} (unique: ${idx.unique})`);
      details.forEach(d => console.log(`      → ${d.name}`));
    }

    console.log('\n✅ PUMP TABLE FIXED!');
    console.log('   - Removed individual UNIQUE constraints');
    console.log('   - Added composite UNIQUE(station_id, pump_number)');
    console.log('   - Data preserved\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
})();
