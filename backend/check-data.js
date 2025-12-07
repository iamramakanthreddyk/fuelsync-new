const { sequelize } = require('./src/config/database');
const { QueryTypes } = require('sequelize');

async function checkData() {
  try {
    // Check existing pumps
    const pumps = await sequelize.query('SELECT id, station_id, name, pump_number, status FROM pumps LIMIT 10', { type: QueryTypes.SELECT });
    console.log('Existing pumps:', pumps);

    // Check existing nozzles
    const nozzles = await sequelize.query('SELECT id, pump_id, station_id, nozzle_number, fuel_type, status FROM nozzles LIMIT 10', { type: QueryTypes.SELECT });
    console.log('Existing nozzles:', nozzles);

    // Check indexes
    const pumpIndexes = await sequelize.query('PRAGMA index_list(pumps)', { type: QueryTypes.SELECT });
    console.log('Pump indexes:', pumpIndexes);

    const nozzleIndexes = await sequelize.query('PRAGMA index_list(nozzles)', { type: QueryTypes.SELECT });
    console.log('Nozzle indexes:', nozzleIndexes);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sequelize.close();
  }
}

checkData();