const { sequelize } = require('./src/config/database');
const { QueryTypes } = require('sequelize');

async function checkTables() {
  try {
    const tables = await sequelize.query('SELECT name FROM sqlite_master WHERE type="table"', { type: QueryTypes.SELECT });
    console.log('Tables:', tables.map(t => t.name));

    // Check pumps table structure
    const pumpsInfo = await sequelize.query('PRAGMA table_info(pumps)', { type: QueryTypes.SELECT });
    console.log('Pumps table structure:', pumpsInfo);

    // Check nozzles table structure
    const nozzlesInfo = await sequelize.query('PRAGMA table_info(nozzles)', { type: QueryTypes.SELECT });
    console.log('Nozzles table structure:', nozzlesInfo);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sequelize.close();
  }
}

checkTables();