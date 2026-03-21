/**
 * Detailed diagnostic to find why getPumps doesn't return the pump
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
    const stationId = '4fe70f4c-1380-47d5-815c-6fb773151abb';

    // Test 1: Raw query
    console.log('=== TEST 1: Raw SQL Query ===');
    const rawPumps = await sequelize.query(
      `SELECT * FROM pumps WHERE station_id = ?`,
      { 
        replacements: [stationId],
        type: Sequelize.QueryTypes.SELECT 
      }
    );
    console.log(`Raw query returned: ${rawPumps.length} pumps`);
    rawPumps.forEach(p => console.log(`  - Pump #${p.pump_number}: ${p.name}`));

    // Test 2: Check if query is case-sensitive
    console.log('\n=== TEST 2: Check station_id format ===');
    const allStations = await sequelize.query(
      `SELECT id FROM stations LIMIT 5`,
      { type: Sequelize.QueryTypes.SELECT }
    );
    console.log('Sample station IDs:');
    allStations.forEach(s => console.log(`  - ${s.id}`));

    // Test 3: Check pump table structure
    console.log('\n=== TEST 3: Pump table structure ===');
    const pumpStructure = await sequelize.query(
      `PRAGMA table_info(pumps)`,
      { type: Sequelize.QueryTypes.SELECT }
    );
    console.log('Pump columns:');
    pumpStructure.forEach(col => console.log(`  - ${col.name}: ${col.type}`));

    // Test 4: Check for any status filtering
    console.log('\n=== TEST 4: All pumps in station (no filters) ===');
    const allPumpsInStation = await sequelize.query(
      `SELECT id, station_id, pump_number, name, status FROM pumps WHERE station_id = ?`,
      { 
        replacements: [stationId],
        type: Sequelize.QueryTypes.SELECT 
      }
    );
    console.log(`Found: ${allPumpsInStation.length} pumps`);
    allPumpsInStation.forEach(p => {
      console.log(`  - ID: ${p.id}`);
      console.log(`    Pump #${p.pump_number} (${p.status}): ${p.name}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
