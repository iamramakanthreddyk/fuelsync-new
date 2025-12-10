/**
 * Check all stations and their owners
 */

const sequelize = require('./src/config/database');
const { User, Station } = require('./src/models');

async function checkStations() {
  try {
    console.log('\n📋 Checking All Stations...\n');
    
    const stations = await Station.findAll({
      include: [{
        model: User,
        as: 'owner',
        attributes: ['id', 'name', 'email', 'role']
      }]
    });
    
    console.log(`Found ${stations.length} total stations:\n`);
    
    for (const station of stations) {
      console.log(`Station: ${station.name}`);
      console.log(`  ID: ${station.id}`);
      console.log(`  Owner ID: ${station.ownerId}`);
      console.log(`  Owner Name: ${station.owner?.name || 'N/A'}`);
      console.log(`  Active: ${station.isActive}`);
      console.log('');
    }
    
    // Group by owner
    const byOwner = {};
    for (const station of stations) {
      const ownerId = station.ownerId;
      if (!byOwner[ownerId]) {
        byOwner[ownerId] = [];
      }
      byOwner[ownerId].push(station.name);
    }
    
    console.log('\n📊 Stations by Owner:');
    for (const [ownerId, stationNames] of Object.entries(byOwner)) {
      const owner = stations.find(s => s.ownerId === ownerId)?.owner;
      console.log(`  ${owner?.name || 'Unknown'}: ${stationNames.length} stations`);
      stationNames.forEach(name => console.log(`    - ${name}`));
    }
    
    console.log('\n✅ Check completed!\n');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkStations();
