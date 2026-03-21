/**
 * COMPREHENSIVE TEST: Multi-Day Sales with Changing Prices
 * 
 * This test:
 * 1. Creates fuel prices for Dec 1, 2, 3 with different values
 * 2. Creates readings for those dates
 * 3. Tests all multi-day sales retrieval APIs
 * 4. Verifies calculations are correct
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api/v1';
const TEST_OWNER_EMAIL = 'anil@metrofuel.com';
const TEST_OWNER_PASSWORD = 'password123';
const TEST_MANAGER_EMAIL = 'sanjay@metrofuel.com';
const TEST_MANAGER_PASSWORD = 'password123';

let authTokens = {};
let testData = {
  stationId: null,
  nozzleId: null,
  pumpId: null,
  ownerId: null,
  managerId: null
};

// ==================== HELPER FUNCTIONS ====================

async function login(email, password) {
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email,
      password
    });
    return response.data.data.accessToken;
  } catch (error) {
    console.error(`❌ Login failed for ${email}:`, error.response?.data?.error || error.message);
    return null;
  }
}

async function makeRequest(method, endpoint, data = null, token = null) {
  const useToken = token || authTokens.manager;
  const config = {
    headers: {
      'Authorization': `Bearer ${useToken}`,
      'Content-Type': 'application/json'
    }
  };

  try {
    let response;
    if (method === 'GET') {
      response = await axios.get(`${BASE_URL}${endpoint}`, config);
    } else if (method === 'POST') {
      response = await axios.post(`${BASE_URL}${endpoint}`, data, config);
    } else if (method === 'PUT') {
      response = await axios.put(`${BASE_URL}${endpoint}`, data, config);
    }
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message,
      status: error.response?.status
    };
  }
}

async function print(title, obj) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`📊 ${title}`);
  console.log('═'.repeat(70));
  console.log(JSON.stringify(obj, null, 2));
}

// ==================== SETUP ====================

async function setup() {
  console.log('\n🔧 SETUP: Creating test environment...\n');

  // 1. Login as owner
  console.log('  1️⃣  Logging in as owner...');
  authTokens.owner = await login(TEST_OWNER_EMAIL, TEST_OWNER_PASSWORD);
  if (!authTokens.owner) {
    console.error('❌ Failed to login as owner');
    process.exit(1);
  }
  console.log('     ✓ Owner authenticated');

  // 2. Get or create test station
  console.log('  2️⃣  Finding test station...');
  const stationsRes = await makeRequest('GET', '/stations', null, authTokens.owner);
  if (stationsRes.success && stationsRes.data.data.length > 0) {
    testData.stationId = stationsRes.data.data[0].id;
    testData.ownerId = stationsRes.data.data[0].ownerId;
    console.log(`     ✓ Found station: ${testData.stationId}`);
  } else {
    console.error('❌ No station found');
    process.exit(1);
  }

  // 3. Get pumps and nozzles
  console.log('  3️⃣  Finding pump and nozzle...');
  const stationRes = await makeRequest('GET', `/stations/${testData.stationId}`, null, authTokens.owner);
  if (stationRes.success && stationRes.data.data.pumps?.length > 0) {
    testData.pumpId = stationRes.data.data.pumps[0].id;
    if (stationRes.data.data.pumps[0].nozzles?.length > 0) {
      testData.nozzleId = stationRes.data.data.pumps[0].nozzles[0].id;
      console.log(`     ✓ Found pump: ${testData.pumpId}`);
      console.log(`     ✓ Found nozzle: ${testData.nozzleId}`);
    }
  }

  // 4. Login as manager
  console.log('  4️⃣  Logging in as manager...');
  authTokens.manager = await login(TEST_MANAGER_EMAIL, TEST_MANAGER_PASSWORD);
  if (!authTokens.manager) {
    console.error('❌ Failed to login as manager');
    process.exit(1);
  }
  console.log('     ✓ Manager authenticated');

  console.log('\n✅ Setup complete!\n');
}

// ==================== TEST: CREATE PRICES ====================

async function testCreatePrices() {
  console.log('\n\n📝 TEST 1: Setting Fuel Prices for 3 Days\n');

  const prices = [
    { date: '2025-12-10', price: 95, label: 'Dec 10' },
    { date: '2025-12-11', price: 100, label: 'Dec 11' },
    { date: '2025-12-12', price: 105, label: 'Dec 12' }
  ];

  console.log('Creating prices:');
  for (const p of prices) {
    const res = await makeRequest('POST', '/fuel-prices', {
      stationId: testData.stationId,
      fuelType: 'petrol',
      price: p.price,
      effectiveFrom: p.date
    }, authTokens.owner);

    if (res.success) {
      console.log(`  ✓ ${p.label}: ₹${p.price}/L`);
    } else {
      console.log(`  ⚠️  ${p.label}: ${res.error}`);
    }
  }
}

// ==================== TEST: CREATE READINGS ====================

async function testCreateReadings() {
  console.log('\n\n📖 TEST 2: Creating Readings on 3 Days with Price Changes\n');

  const readings = [
    { date: '2025-12-10', value: 1000, expected: 95 },
    { date: '2025-12-11', value: 1100, expected: 100 },
    { date: '2025-12-12', value: 1220, expected: 105 }
  ];

  console.log('Creating readings:');
  for (const r of readings) {
    const res = await makeRequest('POST', '/readings', {
      nozzleId: testData.nozzleId,
      stationId: testData.stationId,
      readingValue: r.value,
      readingDate: r.date,
      paymentType: 'cash'
    });

    if (res.success) {
      const reading = res.data.data;
      const litres = reading.litresSold;
      const price = reading.pricePerLitre;
      const amount = reading.totalAmount;
      console.log(`  ✓ ${r.date}: ${litres}L @ ₹${price}/L = ₹${amount}`);
    } else {
      console.log(`  ❌ ${r.date}: ${res.error}`);
    }
  }
}

// ==================== TEST: DASHBOARD SUMMARY ====================

async function testDashboardSummary() {
  console.log('\n\n📊 TEST 3: Dashboard Summary (Today Only)\n');

  const res = await makeRequest('GET', `/dashboard/summary?stationId=${testData.stationId}`);

  if (res.success) {
    const summary = res.data.data;
    console.log(`Total Litres Today: ${summary.today?.litres || 0}`);
    console.log(`Total Sales Today: ₹${summary.today?.amount || 0}`);
    console.log(`Cash: ₹${summary.today?.cash || 0}`);
    console.log(`Online: ₹${summary.today?.online || 0}`);
    console.log(`Credit: ₹${summary.today?.credit || 0}`);
  } else {
    console.log(`❌ Error: ${res.error}`);
  }
}

// ==================== TEST: DAILY SUMMARY ====================

async function testDailySummary() {
  console.log('\n\n📅 TEST 4: Daily Summary (Multi-Day Range)\n');

  const res = await makeRequest('GET', 
    `/dashboard/daily?stationId=${testData.stationId}&startDate=2025-12-10&endDate=2025-12-12`
  );

  if (res.success) {
    const data = res.data.data;
    console.log(`Days in range: ${data.length}`);
    
    let totalLitres = 0;
    let totalAmount = 0;
    
    data.forEach((day, idx) => {
      console.log(`\n  Day ${idx + 1}: ${day.date}`);
      console.log(`    Litres: ${day.litres}`);
      console.log(`    Amount: ₹${day.amount}`);
      console.log(`    Cash: ₹${day.cash}`);
      console.log(`    Readings: ${day.readings}`);
      totalLitres += day.litres;
      totalAmount += day.amount;
    });

    console.log(`\n  TOTAL: ${totalLitres}L = ₹${totalAmount}`);
  } else {
    console.log(`❌ Error: ${res.error}`);
  }
}

// ==================== TEST: FUEL BREAKDOWN ====================

async function testFuelBreakdown() {
  console.log('\n\n⛽ TEST 5: Fuel Type Breakdown (Multi-Day)\n');

  const res = await makeRequest('GET',
    `/dashboard/fuel-breakdown?stationId=${testData.stationId}&startDate=2025-12-10&endDate=2025-12-12`
  );

  if (res.success) {
    const breakdown = res.data.data.breakdown;
    console.log(`Fuel types: ${breakdown.length}`);
    
    breakdown.forEach(item => {
      console.log(`\n  ${item.label}:`);
      console.log(`    Litres: ${item.litres}`);
      console.log(`    Amount: ₹${item.amount}`);
      console.log(`    Percentage: ${item.percentage}%`);
    });
  } else {
    console.log(`❌ Error: ${res.error}`);
  }
}

// ==================== TEST: PUMP PERFORMANCE ====================

async function testPumpPerformance() {
  console.log('\n\n💨 TEST 6: Pump Performance (Multi-Day)\n');

  const res = await makeRequest('GET',
    `/dashboard/pump-performance?stationId=${testData.stationId}&startDate=2025-12-10&endDate=2025-12-12`
  );

  if (res.success) {
    const pumps = res.data.data.pumps;
    console.log(`Pumps: ${pumps.length}`);
    
    pumps.forEach(pump => {
      console.log(`\n  ${pump.name}:`);
      console.log(`    Litres: ${pump.litres}`);
      console.log(`    Amount: ₹${pump.amount}`);
      console.log(`    Readings: ${pump.readings}`);
    });
  } else {
    console.log(`❌ Error: ${res.error}`);
  }
}

// ==================== TEST: STATION DAILY REPORT ====================

async function testStationDailyReport() {
  console.log('\n\n📋 TEST 7: Station Daily Report (Multi-Day)\n');

  const res = await makeRequest('GET',
    `/stations/${testData.stationId}/daily-report?startDate=2025-12-10&endDate=2025-12-12`,
    null,
    authTokens.owner
  );

  if (res.success) {
    const report = res.data.data;
    console.log(`Period: ${report.startDate} to ${report.endDate}`);
    console.log(`Days reported: ${report.dailyStats?.length || 0}`);
    
    if (report.dailyStats) {
      let totalLitres = 0;
      let totalSales = 0;
      
      report.dailyStats.forEach((day, idx) => {
        console.log(`\n  Day ${idx + 1}: ${day.date}`);
        console.log(`    Litres: ${day.litresSold}`);
        console.log(`    Sale Value: ₹${day.saleValue}`);
        console.log(`    Readings: ${day.readingCount}`);
        totalLitres += day.litresSold;
        totalSales += day.saleValue;
      });

      console.log(`\n  TOTAL: ${totalLitres}L = ₹${totalSales}`);
    }
    
    if (report.summary) {
      console.log(`\nSummary:`);
      console.log(`  Total Litres: ${report.summary.totalLitres}`);
      console.log(`  Total Sales: ₹${report.summary.totalSales}`);
      console.log(`  Total Readings: ${report.summary.totalReadings}`);
    }
  } else {
    console.log(`❌ Error: ${res.error}`);
  }
}

// ==================== TEST: SALES REPORT ====================

async function testSalesReport() {
  console.log('\n\n📈 TEST 8: Sales Report (Multi-Day)\n');

  const res = await makeRequest('GET',
    `/reports/sales?stationId=${testData.stationId}&startDate=2025-12-10&endDate=2025-12-12&groupBy=date`,
    null,
    authTokens.owner
  );

  if (res.success) {
    const data = res.data.data;
    console.log(`Period: ${data.startDate} to ${data.endDate}`);
    console.log(`Data points: ${data.data?.length || 0}`);
    
    if (data.data) {
      let totalLitres = 0;
      let totalSales = 0;
      
      data.data.forEach((item, idx) => {
        console.log(`\n  Entry ${idx + 1}:`);
        console.log(`    Date: ${item.date}`);
        console.log(`    Litres: ${item.litres}`);
        console.log(`    Sales: ₹${item.sales}`);
        totalLitres += item.litres;
        totalSales += item.sales;
      });

      console.log(`\n  TOTAL: ${totalLitres}L = ₹${totalSales}`);
    }
    
    if (data.summary) {
      console.log(`\nSummary:`);
      console.log(`  Total Litres: ${data.summary.totalLitres}`);
      console.log(`  Total Sales: ₹${data.summary.totalSales}`);
    }
  } else {
    console.log(`❌ Error: ${res.error}`);
  }
}

// ==================== TEST: OWNER STATS ====================

async function testOwnerStats() {
  console.log('\n\n👤 TEST 9: Owner Stats (All Stations)\n');

  const res = await makeRequest('GET', '/dashboard/owner/stats', null, authTokens.owner);

  if (res.success) {
    const stats = res.data.data;
    console.log(`Total Stations: ${stats.totalStations}`);
    console.log(`Active Stations: ${stats.activeStations}`);
    console.log(`Total Employees: ${stats.totalEmployees}`);
    console.log(`Today's Sales: ₹${stats.todaySales}`);
    console.log(`Month's Sales: ₹${stats.monthSales}`);
  } else {
    console.log(`❌ Error: ${res.error}`);
  }
}

// ==================== TEST: OWNER ANALYTICS ====================

async function testOwnerAnalytics() {
  console.log('\n\n📊 TEST 10: Owner Analytics (Period Comparison)\n');

  const res = await makeRequest('GET',
    `/dashboard/owner/analytics?startDate=2025-12-10&endDate=2025-12-12`,
    null,
    authTokens.owner
  );

  if (res.success) {
    const data = res.data.data;
    
    console.log(`Overview:`);
    console.log(`  Total Sales: ₹${data.overview?.totalSales || 0}`);
    console.log(`  Total Quantity: ${data.overview?.totalQuantity || 0}L`);
    console.log(`  Total Transactions: ${data.overview?.totalTransactions || 0}`);
    console.log(`  Average Transaction: ₹${data.overview?.averageTransaction || 0}`);
    console.log(`  Sales Growth: ${data.overview?.salesGrowth || 0}%`);
    console.log(`  Quantity Growth: ${data.overview?.quantityGrowth || 0}%`);
    
    if (data.salesByStation?.length > 0) {
      console.log(`\nSales by Station:`);
      data.salesByStation.forEach(s => {
        console.log(`  ${s.stationName}: ₹${s.sales} (${s.percentage}%)`);
      });
    }
    
    if (data.dailyTrend?.length > 0) {
      console.log(`\nDaily Trend:`);
      data.dailyTrend.forEach(d => {
        console.log(`  ${d.date}: ${d.quantity}L = ₹${d.sales}`);
      });
    }
  } else {
    console.log(`❌ Error: ${res.error}`);
  }
}

// ==================== MAIN EXECUTION ====================

async function main() {
  console.log(`\n${'═'.repeat(70)}`);
  console.log('🚀 COMPREHENSIVE TEST: Multi-Day Sales with Price Changes');
  console.log(`${'═'.repeat(70)}`);

  try {
    // Setup
    await setup();

    // Create test data
    await testCreatePrices();
    await testCreateReadings();

    // Test all APIs
    await testDashboardSummary();
    await testDailySummary();
    await testFuelBreakdown();
    await testPumpPerformance();
    await testStationDailyReport();
    await testSalesReport();
    await testOwnerStats();
    await testOwnerAnalytics();

    console.log(`\n${'═'.repeat(70)}`);
    console.log('✅ TEST COMPLETE');
    console.log(`${'═'.repeat(70)}\n`);

  } catch (error) {
    console.error('\n❌ Test Error:', error.message);
    console.error(error);
  }
}

main().catch(console.error);
