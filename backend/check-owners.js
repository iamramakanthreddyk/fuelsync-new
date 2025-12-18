/**
 * Check all stations and their owners
 */

const sequelize = require('./src/config/database');
const { User, Station } = require('./src/models');

async function checkStations() {
  try {
    const stations = await Station.findAll({
      include: [{
        model: User,
        as: 'owner',
        attributes: ['id', 'name', 'email', 'role']
      }]
    });
    
    // Group by owner
    const byOwner = {};
    for (const station of stations) {
      const ownerId = station.ownerId;
      if (!byOwner[ownerId]) {
        byOwner[ownerId] = [];
      }
      byOwner[ownerId].push(station.name);
    }
    
    for (const [ownerId, stationNames] of Object.entries(byOwner)) {
      const owner = stations.find(s => s.ownerId === ownerId)?.owner;
    }
    
  } catch (error) {
    process.exit(1);
  }
}

checkStations();
