const { sequelize } = require('./src/config/database');
const { QueryTypes } = require('sequelize');

async function checkStations() {
  try {
    // Check existing stations
    const stations = await sequelize.query('SELECT id, name, owner_id FROM stations LIMIT 10', { type: QueryTypes.SELECT });
    console.log('Existing stations:', stations);

    // Check users
    const users = await sequelize.query('SELECT id, email, role FROM users LIMIT 10', { type: QueryTypes.SELECT });
    console.log('Existing users:', users);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sequelize.close();
  }
}

checkStations();