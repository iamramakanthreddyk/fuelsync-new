/**
 * Restore the pump from backup
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
    // Check if backup has data
    const backupCount = await sequelize.query(`SELECT COUNT(*) as cnt FROM pumps_backup`, {
      type: Sequelize.QueryTypes.SELECT
    });
    console.log(`\nPumps in backup: ${backupCount[0].cnt}`);

    if (backupCount[0].cnt > 0) {
      // Restore from backup
      console.log('\nRestoring pumps from backup...');
      await sequelize.query(`DELETE FROM pumps`);
      await sequelize.query(`INSERT INTO pumps SELECT * FROM pumps_backup`);
      
      const restoredCount = await sequelize.query(`SELECT COUNT(*) as cnt FROM pumps`, {
        type: Sequelize.QueryTypes.SELECT
      });
      console.log(`Restored: ${restoredCount[0].cnt} pumps`);

      // Show details
      const pumps = await sequelize.query(
        `SELECT id, station_id, pump_number, name, status FROM pumps`,
        { type: Sequelize.QueryTypes.SELECT }
      );
      console.log('\nRestored pumps:');
      pumps.forEach(p => {
        console.log(`  - Pump #${p.pump_number} (${p.status}): ${p.name} (Station: ${p.station_id})`);
      });
      console.log('\n✅ Restore complete!');
    } else {
      console.log('❌ No backup available to restore');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
