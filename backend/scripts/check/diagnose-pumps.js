/**
 * Quick diagnostic script to check pump data
 */
const { Sequelize } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'data/fuelsync.db'),
  logging: false
});

(async () => {
  try {
    // Raw query to see all pumps
    const pumps = await sequelize.query(
      `SELECT id, station_id, name, pump_number, status, created_at FROM pumps ORDER BY created_at DESC LIMIT 20`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    console.log('\n========== ALL PUMPS IN DATABASE ==========');
    console.log(`Total pumps: ${pumps.length}\n`);
    
    pumps.forEach((p, idx) => {
      console.log(`${idx + 1}. Pump #${p.pump_number}`);
      console.log(`   ID: ${p.id}`);
      console.log(`   Station ID: ${p.station_id}`);
      console.log(`   Name: ${p.name}`);
      console.log(`   Status: ${p.status}`);
      console.log(`   Created: ${p.created_at}`);
      console.log();
    });

    // Group by station
    const grouped = {};
    pumps.forEach(p => {
      if (!grouped[p.station_id]) {
        grouped[p.station_id] = [];
      }
      grouped[p.station_id].push(p);
    });

    console.log('\n========== PUMPS BY STATION ==========');
    Object.entries(grouped).forEach(([stationId, stationPumps]) => {
      console.log(`\nStation: ${stationId}`);
      console.log(`  Pump count: ${stationPumps.length}`);
      stationPumps.forEach(p => {
        console.log(`    - Pump #${p.pump_number}: ${p.name} (${p.status})`);
      });
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
