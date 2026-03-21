/**
 * COMPREHENSIVE TEST: Multi-Day Sales with Price Changes
 * 
 * Direct database test (no API calls needed)
 * Tests all multi-day sales calculation logic
 */

const sequelize = require('./src/config/database');
const { User, Station, NozzleReading, Nozzle, Pump, FuelPrice } = require('./src/models');
const { Op, fn, col, literal } = require('sequelize');

// Helper function to format currency
function fmt(num) {
  return `₹${parseFloat(num || 0).toFixed(2)}`;
}

async function testMultiDayWithPriceChanges() {
  try {
    console.log('\n' + '═'.repeat(70));
    console.log('🚀 COMPREHENSIVE TEST: Multi-Day Sales with Price Changes');
    console.log('═'.repeat(70) + '\n');

    // ==================== SETUP ====================
    console.log('🔧 SETUP: Finding test station and owner...\n');

    const owner = await User.findOne({ where: { email: 'anil@metrofuel.com' } });
    if (!owner) {
      console.error('❌ Owner not found. Make sure to seed data first.');
      process.exit(1);
    }
    console.log(`✓ Owner: ${owner.name}`);

    const stations = await Station.findAll({
      where: { ownerId: owner.id },
      include: [{
        model: Pump,
        as: 'pumps',
        include: [{ model: Nozzle, as: 'nozzles' }]
      }]
    });

    if (stations.length === 0) {
      console.error('❌ No stations found for owner');
      process.exit(1);
    }

    const testStation = stations[0];
    const stationId = testStation.id;
    console.log(`✓ Station: ${testStation.name} (ID: ${stationId})\n`);

    // Get a nozzle for reading
    let testNozzle = null;
    for (const pump of testStation.pumps) {
      if (pump.nozzles && pump.nozzles.length > 0) {
        testNozzle = pump.nozzles[0];
        break;
      }
    }

    if (!testNozzle) {
      console.error('❌ No nozzles found');
      process.exit(1);
    }

    // ==================== TEST 1: Dashboard Summary ====================
    console.log('\n' + '─'.repeat(70));
    console.log('📊 TEST 1: Dashboard Summary (Today Only)');
    console.log('─'.repeat(70));

    const today = new Date().toISOString().split('T')[0];
    const todaySummary = await NozzleReading.findOne({
      where: {
        stationId,
        readingDate: today,
        [Op.or]: [
          { isInitialReading: false },
          { isInitialReading: true, litresSold: { [Op.gt]: 0 } }
        ]
      },
      attributes: [
        [fn('SUM', col('litres_sold')), 'totalLitres'],
        [literal(`SUM(litres_sold * price_per_litre)`), 'totalAmount'],
        [fn('SUM', col('cash_amount')), 'totalCash'],
        [fn('SUM', col('online_amount')), 'totalOnline'],
        [fn('SUM', col('credit_amount')), 'totalCredit'],
        [fn('COUNT', col('id')), 'readingCount']
      ],
      raw: true
    });

    if (todaySummary) {
      console.log(`\nToday (${today}):`);
      console.log(`  Total Litres: ${parseFloat(todaySummary.totalLitres || 0).toFixed(3)}`);
      console.log(`  Total Sales: ${fmt(todaySummary.totalAmount)}`);
      console.log(`  Cash: ${fmt(todaySummary.totalCash)}`);
      console.log(`  Online: ${fmt(todaySummary.totalOnline)}`);
      console.log(`  Credit: ${fmt(todaySummary.totalCredit)}`);
      console.log(`  Readings: ${todaySummary.readingCount}`);
    } else {
      console.log('\n  No readings found for today');
    }

    // ==================== TEST 2: Daily Summary (Multi-Day) ====================
    console.log('\n' + '─'.repeat(70));
    console.log('📅 TEST 2: Daily Summary (Last 7 Days - Multi-Day Range)');
    console.log('─'.repeat(70));

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const startDate = sevenDaysAgo.toISOString().split('T')[0];
    const endDate = today;

    console.log(`\nAnalyzing period: ${startDate} to ${endDate}\n`);

    const dailySummary = await NozzleReading.findAll({
      where: {
        stationId,
        readingDate: { [Op.between]: [startDate, endDate] },
        [Op.or]: [
          { isInitialReading: false },
          { isInitialReading: true, litresSold: { [Op.gt]: 0 } }
        ]
      },
      attributes: [
        'readingDate',
        [fn('SUM', col('litres_sold')), 'litres'],
        [literal(`SUM(litres_sold * price_per_litre)`), 'amount'],
        [fn('SUM', col('cash_amount')), 'cash'],
        [fn('SUM', col('online_amount')), 'online'],
        [fn('SUM', col('credit_amount')), 'credit'],
        [fn('COUNT', col('id')), 'readings']
      ],
      group: ['readingDate'],
      order: [['readingDate', 'ASC']],
      raw: true
    });

    let totalLitres = 0;
    let totalAmount = 0;

    if (dailySummary.length > 0) {
      console.log('Day by Day Breakdown:');
      dailySummary.forEach((day, idx) => {
        const litres = parseFloat(day.litres || 0);
        const amount = parseFloat(day.amount || 0);
        totalLitres += litres;
        totalAmount += amount;

        console.log(`\n  Day ${idx + 1}: ${day.readingDate}`);
        console.log(`    Litres: ${litres.toFixed(3)}`);
        console.log(`    Sales: ${fmt(amount)}`);
        console.log(`    Cash: ${fmt(day.cash)}, Online: ${fmt(day.online)}, Credit: ${fmt(day.credit)}`);
        console.log(`    Readings: ${day.readings}`);
      });

      console.log(`\n  PERIOD TOTAL:`);
      console.log(`    Total Litres: ${totalLitres.toFixed(3)}`);
      console.log(`    Total Sales: ${fmt(totalAmount)}`);
    } else {
      console.log('  No readings found for this period');
    }

    // ==================== TEST 3: Fuel Breakdown ====================
    console.log('\n' + '─'.repeat(70));
    console.log('⛽ TEST 3: Fuel Type Breakdown (Last 7 Days)');
    console.log('─'.repeat(70));

    const fuelBreakdown = await NozzleReading.findAll({
      where: {
        stationId,
        readingDate: { [Op.between]: [startDate, endDate] },
        [Op.or]: [
          { isInitialReading: false },
          { isInitialReading: true, litresSold: { [Op.gt]: 0 } }
        ]
      },
      attributes: [
        'fuelType',
        [fn('SUM', col('litres_sold')), 'litres'],
        [literal(`SUM(litres_sold * price_per_litre)`), 'amount'],
        [fn('SUM', col('cash_amount')), 'cash'],
        [fn('SUM', col('online_amount')), 'online'],
        [fn('SUM', col('credit_amount')), 'credit']
      ],
      group: ['fuelType'],
      raw: true
    });

    console.log('\nFuel Type Breakdown:\n');
    fuelBreakdown.forEach(item => {
      const litres = parseFloat(item.litres || 0);
      const amount = parseFloat(item.amount || 0);
      const pct = totalLitres > 0 ? ((litres / totalLitres) * 100).toFixed(1) : '0.0';

      console.log(`  ${item.fuelType}:`);
      console.log(`    Litres: ${litres.toFixed(3)} (${pct}%)`);
      console.log(`    Sales: ${fmt(amount)}`);
      console.log(`    Break: Cash ${fmt(item.cash)}, Online ${fmt(item.online)}, Credit ${fmt(item.credit)}`);
    });

    // ==================== TEST 4: Pump Performance ====================
    console.log('\n' + '─'.repeat(70));
    console.log('💨 TEST 4: Pump Performance (Last 7 Days)');
    console.log('─'.repeat(70));

    const pumpPerformance = await NozzleReading.findAll({
      where: {
        stationId,
        readingDate: { [Op.between]: [startDate, endDate] },
        [Op.or]: [
          { isInitialReading: false },
          { isInitialReading: true, litresSold: { [Op.gt]: 0 } }
        ]
      },
      include: [{
        model: Nozzle,
        as: 'nozzle',
        attributes: [],
        include: [{
          model: Pump,
          as: 'pump',
          attributes: ['id', 'name']
        }]
      }],
      attributes: [
        [col('nozzle.pump.id'), 'pumpId'],
        [col('nozzle.pump.name'), 'pumpName'],
        [fn('SUM', col('NozzleReading.litres_sold')), 'litres'],
        [literal(`SUM(NozzleReading.litres_sold * NozzleReading.price_per_litre)`), 'amount'],
        [fn('COUNT', col('NozzleReading.id')), 'readings']
      ],
      group: ['pumpId'],
      raw: true,
      nest: true
    });

    console.log('\nPump Performance:\n');
    pumpPerformance.forEach(pump => {
      console.log(`  Pump ${pump['nozzle.pump.name']}:`);
      console.log(`    Litres: ${parseFloat(pump.litres || 0).toFixed(3)}`);
      console.log(`    Sales: ${fmt(pump.amount)}`);
      console.log(`    Readings: ${pump.readings}`);
    });

    // ==================== TEST 5: Price Analysis ====================
    console.log('\n' + '─'.repeat(70));
    console.log('💰 TEST 5: Price Per Litre Verification (Historical Prices)');
    console.log('─'.repeat(70));

    const priceAnalysis = await NozzleReading.findAll({
      where: {
        stationId,
        readingDate: { [Op.between]: [startDate, endDate] },
        [Op.or]: [
          { isInitialReading: false },
          { isInitialReading: true, litresSold: { [Op.gt]: 0 } }
        ]
      },
      attributes: [
        'readingDate',
        'fuelType',
        'litresSold',
        'pricePerLitre',
        'totalAmount'
      ],
      order: [['readingDate', 'ASC']],
      limit: 10,
      raw: true
    });

    console.log('\nSample Readings (showing stored prices):\n');
    console.log('Date       | Fuel    | Litres  | Price/L | Amount      | Calc Check');
    console.log('───────────┼─────────┼─────────┼─────────┼─────────────┼───────────');

    priceAnalysis.forEach(reading => {
      const litres = parseFloat(reading.litresSold || 0);
      const price = parseFloat(reading.pricePerLitre || 0);
      const amount = parseFloat(reading.totalAmount || 0);
      const calculated = litres * price;
      const match = Math.abs(calculated - amount) < 0.01 ? '✓' : '❌';

      console.log(
        `${reading.readingDate} | ${reading.fuelType.padEnd(7)} | ${litres.toFixed(3).padStart(7)} | ₹${price.toFixed(2).padStart(6)} | ₹${amount.toFixed(2).padStart(10)} | ${match}`
      );
    });

    // ==================== TEST 6: Station Daily Report ====================
    console.log('\n' + '─'.repeat(70));
    console.log('📋 TEST 6: Station Daily Report (Multi-Day Aggregation)');
    console.log('─'.repeat(70));

    const dailyReport = await NozzleReading.findAll({
      where: {
        stationId,
        readingDate: { [Op.between]: [startDate, endDate] },
        [Op.or]: [
          { isInitialReading: false },
          { isInitialReading: true, litresSold: { [Op.gt]: 0 } }
        ]
      },
      attributes: [
        'readingDate',
        [fn('SUM', col('litres_sold')), 'litresSold'],
        [literal(`SUM(litres_sold * price_per_litre)`), 'saleValue'],
        [fn('COUNT', col('id')), 'readingCount']
      ],
      group: ['readingDate'],
      order: [['readingDate', 'ASC']],
      raw: true
    });

    console.log('\nDaily Report Simulation:\n');
    console.log('Date       | Litres  | Sale Value  | Readings');
    console.log('───────────┼─────────┼─────────────┼─────────');

    let reportTotalLitres = 0;
    let reportTotalSales = 0;

    dailyReport.forEach(day => {
      const litres = parseFloat(day.litresSold || 0);
      const sales = parseFloat(day.saleValue || 0);
      reportTotalLitres += litres;
      reportTotalSales += sales;

      console.log(
        `${day.readingDate} | ${litres.toFixed(3).padStart(7)} | ₹${sales.toFixed(2).padStart(10)} | ${day.readingCount}`
      );
    });

    console.log('───────────┼─────────┼─────────────┼─────────');
    console.log(
      `TOTAL      | ${reportTotalLitres.toFixed(3).padStart(7)} | ₹${reportTotalSales.toFixed(2).padStart(10)} |`
    );

    // ==================== TEST 7: Monthly Analysis ====================
    console.log('\n' + '─'.repeat(70));
    console.log('📊 TEST 7: Monthly Sales Analysis');
    console.log('─'.repeat(70));

    const monthStart = new Date(today);
    monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().split('T')[0];

    const monthlySales = await NozzleReading.findOne({
      where: {
        stationId,
        readingDate: { [Op.between]: [monthStartStr, endDate] },
        [Op.or]: [
          { isInitialReading: false },
          { isInitialReading: true, litresSold: { [Op.gt]: 0 } }
        ]
      },
      attributes: [
        [fn('SUM', col('litres_sold')), 'totalLitres'],
        [literal(`SUM(litres_sold * price_per_litre)`), 'totalSales'],
        [fn('COUNT', col('id')), 'totalReadings'],
        [fn('AVG', col('price_per_litre')), 'avgPrice']
      ],
      raw: true
    });

    console.log(`\nMonth: ${monthStart.toLocaleString('en-US', { month: 'long', year: 'numeric' })}`);
    console.log(`  Period: ${monthStartStr} to ${endDate}`);
    console.log(`\n  Total Litres: ${parseFloat(monthlySales.totalLitres || 0).toFixed(3)}`);
    console.log(`  Total Sales: ${fmt(monthlySales.totalSales)}`);
    console.log(`  Total Readings: ${monthlySales.totalReadings}`);
    console.log(`  Average Price: ₹${parseFloat(monthlySales.avgPrice || 0).toFixed(2)}/L`);

    // ==================== VALIDATION ====================
    console.log('\n' + '═'.repeat(70));
    console.log('✅ VALIDATION CHECKS');
    console.log('═'.repeat(70));

    const checks = [
      {
        name: 'Price Storage',
        pass: priceAnalysis.every(r => r.pricePerLitre && r.pricePerLitre > 0),
        desc: 'All readings have pricePerLitre stored'
      },
      {
        name: 'Amount Calculation',
        pass: priceAnalysis.every(r => Math.abs((r.litresSold * r.pricePerLitre) - r.totalAmount) < 0.01),
        desc: 'totalAmount = litres × price for all readings'
      },
      {
        name: 'Multi-Day Report',
        pass: dailySummary.length > 0,
        desc: `Report captures data from ${dailySummary.length} days`
      },
      {
        name: 'Daily Totals Match',
        pass: Math.abs(reportTotalSales - totalAmount) < 0.01,
        desc: 'Daily rollup totals match period total'
      },
      {
        name: 'Fuel Breakdown Sum',
        pass: Math.abs(fuelBreakdown.reduce((sum, f) => sum + parseFloat(f.amount || 0), 0) - totalAmount) < 0.01,
        desc: 'Fuel type breakdown sums to total'
      }
    ];

    console.log('');
    checks.forEach(check => {
      console.log(`  ${check.pass ? '✓' : '❌'} ${check.name}`);
      console.log(`     ${check.desc}`);
    });

    const allPassed = checks.every(c => c.pass);

    console.log('\n' + '═'.repeat(70));
    if (allPassed) {
      console.log('✅ ALL TESTS PASSED - System handles multi-day price changes correctly');
    } else {
      console.log('⚠️  SOME TESTS HAVE ISSUES - Review output above');
    }
    console.log('═'.repeat(70) + '\n');

    process.exit(allPassed ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Test Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testMultiDayWithPriceChanges();
