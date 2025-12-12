/**
 * Test script to verify owner-specific stats
 */

const sequelize = require('./src/config/database');
const { User, Station, NozzleReading, Nozzle, Pump } = require('./src/models');
const { Op, fn, col } = require('sequelize');

async function testOwnerStats() {
  try {
    console.log('\n📋 Starting Owner Stats Test...\n');
    
    // Get all owners
    const owners = await User.findAll({
      where: { role: 'owner' }
    });
    
    console.log(`Found ${owners.length} owners:\n`);
    
    // For each owner, calculate their stats
    for (const owner of owners) {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Owner: ${owner.name} (ID: ${owner.id})`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      
      // Get stations for this owner
      const stations = await Station.findAll({
        where: { ownerId: owner.id },
        include: [
          {
            model: Pump,
            as: 'pumps',
            attributes: ['id', 'status']
          }
        ]
      });
      
      const stationIds = stations.map(s => s.id);
      console.log(`✓ Total Stations: ${stations.length}`);
      console.log(`  Station IDs: ${stationIds.join(', ')}`);
      
      const activeStations = stations.filter(s => s.isActive).length;
      console.log(`✓ Active Stations: ${activeStations}`);
      
      // Count employees
      const totalEmployees = await User.count({
        where: {
          stationId: { [Op.in]: stationIds },
          role: { [Op.in]: ['manager', 'employee'] }
        }
      });
      console.log(`✓ Total Employees: ${totalEmployees}`);
      
      // Today's sales
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todaySalesData = await NozzleReading.findAll({
        attributes: [
          [fn('SUM', col('NozzleReading.total_amount')), 'totalAmount']
        ],
        include: [{
          model: Nozzle,
          as: 'nozzle',
          attributes: [],
          include: [{
            model: Pump,
            as: 'pump',
            attributes: [],
            where: { stationId: { [Op.in]: stationIds } }
          }]
        }],
        where: {
          readingDate: {
            [Op.gte]: today
          }
        },
        raw: true
      });
      
      const todaySales = parseFloat(todaySalesData[0]?.totalAmount || 0);
      console.log(`✓ Today's Sales: ₹${todaySales.toFixed(2)}`);
      
      // Month's sales
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      
      const monthSalesData = await NozzleReading.findAll({
        attributes: [
          [fn('SUM', col('NozzleReading.total_amount')), 'totalAmount']
        ],
        include: [{
          model: Nozzle,
          as: 'nozzle',
          attributes: [],
          include: [{
            model: Pump,
            as: 'pump',
            attributes: [],
            where: { stationId: { [Op.in]: stationIds } }
          }]
        }],
        where: {
          readingDate: {
            [Op.gte]: monthStart
          }
        },
        raw: true
      });
      
      const monthSales = parseFloat(monthSalesData[0]?.totalAmount || 0);
      console.log(`✓ Month's Sales: ₹${monthSales.toFixed(2)}`);
      
      // Pending actions removed (CashHandover logic no longer present)
    }
    
    console.log('\n✅ Test completed!\n');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Test error:', error);
    process.exit(1);
  }
}

testOwnerStats();
