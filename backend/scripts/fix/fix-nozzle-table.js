/**
 * Check and fix nozzle table schema
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
    console.log('🔧 CHECKING NOZZLE TABLE SCHEMA...\n');

    // Check nozzles
    const nozzleIndexes = await sequelize.query(`PRAGMA INDEX_LIST(nozzles)`, {
      type: Sequelize.QueryTypes.SELECT
    });
    
    console.log('Nozzle indexes:');
    for (const idx of nozzleIndexes) {
      const details = await sequelize.query(`PRAGMA INDEX_INFO(${idx.name})`, {
        type: Sequelize.QueryTypes.SELECT
      });
      console.log(`\n${idx.name} (unique: ${idx.unique}):`);
      details.forEach(d => console.log(`  - ${d.name}`));
    }

    // Check if nozzles have bad constraints
    const badNozzleIndexes = nozzleIndexes.filter(idx => {
      return idx.unique === 1 && idx.name !== 'sqlite_autoindex_nozzles_1'; // 1 is PK
    });

    if (badNozzleIndexes.length > 0) {
      console.log('\n⚠️  FOUND BAD NOZZLE CONSTRAINTS - FIXING...\n');

      // Back up
      console.log('Step 1: Backing up nozzle data...');
      await sequelize.query(`CREATE TABLE IF NOT EXISTS nozzles_backup AS SELECT * FROM nozzles`);
      const backupCount = await sequelize.query(`SELECT COUNT(*) as cnt FROM nozzles_backup`, {
        type: Sequelize.QueryTypes.SELECT
      });
      console.log(`  ✓ Backed up ${backupCount[0].cnt} nozzles\n`);

      // Drop old table
      console.log('Step 2: Dropping old nozzles table...');
      await sequelize.query(`DROP TABLE nozzles`);
      console.log('  ✓ Old table dropped\n');

      // Create new table
      console.log('Step 3: Creating new nozzles table with correct schema...');
      await sequelize.query(`
        CREATE TABLE nozzles (
          id UUID PRIMARY KEY,
          pump_id UUID NOT NULL,
          station_id UUID REFERENCES stations(id),
          nozzle_number INTEGER NOT NULL,
          fuel_type VARCHAR(30) NOT NULL,
          label VARCHAR(50),
          status VARCHAR(20) NOT NULL DEFAULT 'active',
          initial_reading DECIMAL(12,2) DEFAULT '0',
          last_reading DECIMAL(12,2),
          last_reading_date DATE,
          notes TEXT,
          created_at DATETIME NOT NULL,
          updated_at DATETIME NOT NULL,
          FOREIGN KEY (pump_id) REFERENCES pumps(id) ON DELETE CASCADE,
          UNIQUE(pump_id, nozzle_number)
        )
      `);
      console.log('  ✓ New table created with composite unique index\n');

      // Restore data
      console.log('Step 4: Restoring nozzle data...');
      await sequelize.query(`INSERT INTO nozzles SELECT * FROM nozzles_backup`);
      const restoredCount = await sequelize.query(`SELECT COUNT(*) as cnt FROM nozzles`, {
        type: Sequelize.QueryTypes.SELECT
      });
      console.log(`  ✓ Restored ${restoredCount[0].cnt} nozzles\n`);

      // Verify
      console.log('Step 5: Verifying schema...');
      const newIndexes = await sequelize.query(`PRAGMA INDEX_LIST(nozzles)`, {
        type: Sequelize.QueryTypes.SELECT
      });
      console.log(`  Indexes found: ${newIndexes.length}`);
      for (const idx of newIndexes) {
        const details = await sequelize.query(`PRAGMA INDEX_INFO(${idx.name})`, {
          type: Sequelize.QueryTypes.SELECT
        });
        console.log(`    - ${idx.name} (unique: ${idx.unique})`);
        details.forEach(d => console.log(`      → ${d.name}`));
      }

      console.log('\n✅ NOZZLE TABLE FIXED!\n');
    } else {
      console.log('\n✅ Nozzle table schema is correct!\n');
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
})();
