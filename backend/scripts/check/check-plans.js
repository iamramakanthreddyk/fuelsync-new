const { sequelize } = require('./src/config/database');
const { QueryTypes } = require('sequelize');

async function checkPlans() {
  try {
    // Check existing plans
    await sequelize.query('SELECT id, name, max_stations, max_pumps_per_station, max_nozzles_per_pump FROM plans', { type: QueryTypes.SELECT });

    // Check user plans
    await sequelize.query('SELECT u.email, u.role, p.name as plan_name FROM users u LEFT JOIN plans p ON u.plan_id = p.id', { type: QueryTypes.SELECT });

  } catch (error) {
    // Handle error
  } finally {
    await sequelize.close();
  }
}

checkPlans();