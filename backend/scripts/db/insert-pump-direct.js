/**
 * Insert pump directly - bypass validation
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
    await sequelize.query(`
      INSERT INTO pumps (id, station_id, name, pump_number, status, notes, created_at, updated_at)
      VALUES (
        '096484ea-6279-4dc2-908b-c4849cb7ff99',
        '4fe70f4c-1380-47d5-815c-6fb773151abb',
        'Updated Pump 1',
        1,
        'maintenance',
        NULL,
        '2025-12-06 15:20:38.180 +00:00',
        '2025-12-06 15:20:38.232 +00:00'
      )
    `);

    const result = await sequelize.query('SELECT COUNT(*) as cnt FROM pumps', {
      type: Sequelize.QueryTypes.SELECT
    });
    console.log('✅ Pump restored! Count:', result[0].cnt);

    // Verify
    const pumps = await sequelize.query('SELECT * FROM pumps', {
      type: Sequelize.QueryTypes.SELECT
    });
    pumps.forEach(p => {
      console.log(`\n✓ Pump #${p.pump_number} (${p.status}): ${p.name}`);
      console.log(`  Station: ${p.station_id}`);
      console.log(`  ID: ${p.id}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
