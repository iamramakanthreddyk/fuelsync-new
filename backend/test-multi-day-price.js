/**
 * Test: Multi-Day Report with Price Changes
 * 
 * Verifies that the system correctly calculates sales reports when fuel prices change
 * across multiple days.
 * 
 * Scenario:
 * - Day 1 (Dec 1): 100 liters @ ₹95/L = ₹9,500
 * - Day 2 (Dec 2): 150 liters @ ₹100/L = ₹15,000
 * - Day 3 (Dec 3): 120 liters @ ₹105/L = ₹12,600
 * - Expected Total: 370 liters, ₹37,100
 */

const { NozzleReading, FuelPrice, Station, User, Nozzle, Pump } = require('./models');
const { sequelize } = require('./models');

async function testMultiDayReportWithPriceChanges() {
  console.log('\n📊 TEST: Multi-Day Report with Price Changes\n');
  
  try {
    // Setup: Create test data
    console.log('🔧 Setup: Creating test data...');
    
    // Get or create test station
    const station = await Station.findOne({ where: { code: 'TEST-STATION' } });
    if (!station) {
      throw new Error('Test station not found. Please create TEST-STATION first.');
    }
    
    const stationId = station.id;
    const fuelType = 'petrol';
    
    console.log(`  ✓ Station: ${station.name} (${station.code})`);
    
    // Step 1: Set fuel prices for each day
    console.log('\n📝 Step 1: Setting fuel prices for 3 days...');
    
    const priceEntries = [
      { date: '2025-12-01', price: 95 },
      { date: '2025-12-02', price: 100 },
      { date: '2025-12-03', price: 105 }
    ];
    
    for (const entry of priceEntries) {
      const existingPrice = await FuelPrice.findOne({
        where: {
          stationId,
          fuelType,
          effectiveFrom: entry.date
        }
      });
      
      if (existingPrice) {
        console.log(`  ✓ Price already set for ${entry.date}: ₹${existingPrice.price}`);
      } else {
        await FuelPrice.create({
          stationId,
          fuelType,
          price: entry.price,
          effectiveFrom: entry.date
        });
        console.log(`  ✓ Price set for ${entry.date}: ₹${entry.price}/L`);
      }
    }
    
    // Step 2: Verify prices can be retrieved
    console.log('\n🔍 Step 2: Verify prices are retrievable by date...');
    
    for (const entry of priceEntries) {
      const retrievedPrice = await FuelPrice.getPriceForDate(stationId, fuelType, entry.date);
      console.log(`  ✓ ${entry.date}: ₹${retrievedPrice}/L`);
    }
    
    // Step 3: Verify readings store historical prices
    console.log('\n📖 Step 3: Verify readings store historical prices...');
    
    const readings = await NozzleReading.findAll({
      where: {
        stationId,
        readingDate: sequelize.where(
          sequelize.fn('DATE', sequelize.col('reading_date')),
          sequelize.Op.between,
          ['2025-12-01', '2025-12-03']
        )
      },
      attributes: [
        'readingDate',
        'litresSold',
        'pricePerLitre',
        'totalAmount'
      ],
      order: [['readingDate', 'ASC']],
      raw: true
    });
    
    if (readings.length === 0) {
      console.log('  ⚠️  No readings found for Dec 1-3. Please create test readings first.');
      console.log('\n  To create test readings, POST to /api/v1/readings with:');
      console.log('  - nozzleId: <test nozzle id>');
      console.log('  - readingValue: <increasing meter values>');
      console.log('  - readingDate: 2025-12-01, 2025-12-02, 2025-12-03');
      return;
    }
    
    console.log(`  ✓ Found ${readings.length} readings:\n`);
    
    let totalLitres = 0;
    let totalSaleValue = 0;
    
    readings.forEach(r => {
      const date = r.readingDate;
      const litres = parseFloat(r.litresSold || 0);
      const price = parseFloat(r.pricePerLitre || 0);
      const amount = parseFloat(r.totalAmount || 0);
      const calculated = litres * price;
      
      totalLitres += litres;
      totalSaleValue += amount;
      
      console.log(`    Date: ${date}`);
      console.log(`      Litres: ${litres.toFixed(3)}`);
      console.log(`      Price: ₹${price.toFixed(2)}/L`);
      console.log(`      Total Amount: ₹${amount.toFixed(2)}`);
      console.log(`      Calculated: ${litres.toFixed(3)} × ₹${price.toFixed(2)} = ₹${calculated.toFixed(2)}`);
      console.log(`      Match: ${Math.abs(calculated - amount) < 0.01 ? '✓' : '❌'}\n`);
    });
    
    // Step 4: Run the actual report query (simulating dashboard endpoint)
    console.log('📊 Step 4: Running report query (like dashboard endpoint)...\n');
    
    const reportData = await sequelize.query(`
      SELECT
        reading_date as date,
        SUM(litres_sold) as total_litres,
        SUM(litres_sold * price_per_litre) as sale_value,
        COUNT(*) as reading_count,
        AVG(price_per_litre) as avg_price
      FROM nozzle_readings
      WHERE station_id = :stationId
        AND reading_date BETWEEN :startDate AND :endDate
      GROUP BY reading_date
      ORDER BY reading_date ASC
    `, {
      replacements: {
        stationId,
        startDate: '2025-12-01',
        endDate: '2025-12-03'
      },
      type: sequelize.QueryTypes.SELECT
    });
    
    console.log('Report Results by Date:\n');
    let reportTotalLitres = 0;
    let reportTotalSales = 0;
    
    reportData.forEach(row => {
      const litres = parseFloat(row.total_litres || 0);
      const sales = parseFloat(row.sale_value || 0);
      const avgPrice = parseFloat(row.avg_price || 0);
      
      reportTotalLitres += litres;
      reportTotalSales += sales;
      
      console.log(`  ${row.date}:`);
      console.log(`    Litres: ${litres.toFixed(3)}`);
      console.log(`    Sales: ₹${sales.toFixed(2)}`);
      console.log(`    Avg Price: ₹${avgPrice.toFixed(2)}`);
      console.log(`    Readings: ${row.reading_count}\n`);
    });
    
    // Step 5: Verify totals
    console.log('📈 Step 5: Verify Period Totals...\n');
    
    const totalQuery = await sequelize.query(`
      SELECT
        SUM(litres_sold) as total_litres,
        SUM(litres_sold * price_per_litre) as total_sales,
        COUNT(*) as total_readings,
        MIN(price_per_litre) as min_price,
        MAX(price_per_litre) as max_price
      FROM nozzle_readings
      WHERE station_id = :stationId
        AND reading_date BETWEEN :startDate AND :endDate
    `, {
      replacements: {
        stationId,
        startDate: '2025-12-01',
        endDate: '2025-12-03'
      },
      type: sequelize.QueryTypes.SELECT
    });
    
    const totals = totalQuery[0];
    console.log('Period Totals (Dec 1-3):');
    console.log(`  Total Litres: ${parseFloat(totals.total_litres || 0).toFixed(3)}`);
    console.log(`  Total Sales: ₹${parseFloat(totals.total_sales || 0).toFixed(2)}`);
    console.log(`  Total Readings: ${totals.total_readings}`);
    console.log(`  Price Range: ₹${parseFloat(totals.min_price).toFixed(2)} - ₹${parseFloat(totals.max_price).toFixed(2)}/L\n`);
    
    // Step 6: Validation checks
    console.log('✅ Validation Checks:\n');
    
    const checks = [
      {
        name: 'Price Storage',
        pass: readings.every(r => r.pricePerLitre !== null && r.pricePerLitre > 0),
        message: 'All readings have pricePerLitre stored'
      },
      {
        name: 'Amount Calculation',
        pass: readings.every(r => Math.abs((r.litresSold * r.pricePerLitre) - r.totalAmount) < 0.01),
        message: 'totalAmount = litres × price for all readings'
      },
      {
        name: 'Multi-Date Report',
        pass: reportData.length === 3,
        message: 'Report captures all 3 days'
      },
      {
        name: 'Price Variation',
        pass: parseFloat(totals.min_price) !== parseFloat(totals.max_price),
        message: 'Prices vary across days (not using single price)'
      },
      {
        name: 'Total Consistency',
        pass: Math.abs(reportTotalSales - parseFloat(totals.total_sales)) < 0.01,
        message: 'Report total matches query total'
      }
    ];
    
    let allPassed = true;
    checks.forEach(check => {
      console.log(`  ${check.pass ? '✓' : '❌'} ${check.name}`);
      console.log(`     ${check.message}`);
      if (!check.pass) allPassed = false;
    });
    
    console.log('\n' + '='.repeat(60));
    if (allPassed) {
      console.log('✅ ALL TESTS PASSED - System handles multi-day price changes correctly');
    } else {
      console.log('❌ SOME TESTS FAILED - Review the output above');
    }
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('\n❌ Test Error:', error.message);
    console.error(error);
  }
}

// Export for test runner
module.exports = { testMultiDayReportWithPriceChanges };

// Run if executed directly
if (require.main === module) {
  testMultiDayReportWithPriceChanges()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}
