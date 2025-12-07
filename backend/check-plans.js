const { sequelize } = require('./src/config/database');
const { QueryTypes } = require('sequelize');

async function checkPlans() {
  try {
    // Check existing plans
    const plans = await sequelize.query('SELECT id, name, max_stations, max_pumps_per_station, max_nozzles_per_pump FROM plans', { type: QueryTypes.SELECT });
    console.log('Existing plans:', plans);

    // Check user plans
    const userPlans = await sequelize.query('SELECT u.email, u.role, p.name as plan_name FROM users u LEFT JOIN plans p ON u.plan_id = p.id', { type: QueryTypes.SELECT });
    console.log('User plans:', userPlans);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sequelize.close();
  }
}

checkPlans();