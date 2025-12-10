/**
 * Create second owner with different stations for testing
 */

const bcrypt = require('bcrypt');
const sequelize = require('./src/config/database');
const { User, Station } = require('./src/models');

async function createSecondOwner() {
  try {
    console.log('\n📋 Creating Additional Owner for Testing...\n');
    
    // Create unique owner with timestamp
    const timestamp = Date.now();
    const ownerEmail = `owner${timestamp}@fuelsync.in`;
    const ownerName = `Owner ${timestamp}`;
    
    // Create second owner
    const hashedPassword = await bcrypt.hash('testpassword123', 10);
    
    const owner2 = await User.create({
      email: ownerEmail,
      password: hashedPassword,
      name: ownerName,
      phone: '9999999999',
      role: 'owner',
      isActive: true
    });
    
    console.log(`✓ Created Owner: ${owner2.name} (${owner2.email})`);
    console.log(`  ID: ${owner2.id}\n`);
    
    // Create 2 stations for owner2
    const station3 = await Station.create({
      ownerId: owner2.id,
      name: 'Owner2 Station A',
      code: 'STN003',
      address: '123 Owner Two Street',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560001',
      isActive: true
    });
    
    console.log(`✓ Created Station 3: ${station3.name}`);
    console.log(`  Owner: ${owner2.name}\n`);
    
    const station4 = await Station.create({
      ownerId: owner2.id,
      name: 'Owner2 Station B',
      code: 'STN004',
      address: '456 Owner Two Avenue',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411001',
      isActive: true
    });
    
    console.log(`✓ Created Station 4: ${station4.name}`);
    console.log(`  Owner: ${owner2.name}\n`);
    
    // Show all owners and their stations
    console.log('\n📊 All Owners and Stations:\n');
    
    const owners = await User.findAll({
      where: { role: 'owner' }
    });
    
    // Get stations for each owner
    for (const owner of owners) {
      const stations = await Station.findAll({
        where: { ownerId: owner.id },
        attributes: ['id', 'name', 'code']
      });
      owner.stations = stations;
    }
    
    for (const owner of owners) {
      console.log(`Owner: ${owner.name} (${owner.email})`);
      console.log(`  ID: ${owner.id}`);
      console.log(`  Stations: ${owner.stations?.length || 0}`);
      owner.stations?.forEach(station => {
        console.log(`    - ${station.name} (${station.code})`);
      });
      console.log('');
    }
    
    console.log('\n✅ Setup completed!\n');
    console.log('💡 Test Credentials:');
    console.log('  Owner 1: owner@fuelsync.in / password');
    console.log('  Owner 2: owner2@fuelsync.in / owner2password\n');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createSecondOwner();
