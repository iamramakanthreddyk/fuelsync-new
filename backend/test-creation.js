const { sequelize } = require('./src/config/database');
const { User, Station, Pump, Nozzle } = require('./src/models');

async function testCreation() {
  try {
    // Get a user
    const user = await User.findOne({ where: { role: 'super_admin' } });
    console.log('User:', user.id, user.email, user.role);

    // Create a test station
    const station = await Station.create({
      name: 'Test Station',
      ownerId: user.id,
      location: 'Test Location'
    });
    console.log('Created station:', station.id);

    // Create a test pump
    const pump = await Pump.create({
      stationId: station.id,
      name: 'Test Pump 1',
      pumpNumber: 1,
      status: 'active'
    });
    console.log('Created pump:', pump.id);

    // Create a test nozzle
    const nozzle = await Nozzle.create({
      pumpId: pump.id,
      stationId: station.id,
      nozzleNumber: 1,
      fuelType: 'petrol',
      status: 'active'
    });
    console.log('Created nozzle:', nozzle.id);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sequelize.close();
  }
}

testCreation();