#!/usr/bin/env node

/**
 * Quick endpoint tester for new daily settlement endpoints
 * Tests the 4 new endpoints added in Phase 13
 */

const http = require('http');

const BASE_URL = 'http://localhost:3001/api/v1';
const STATION_ID = 'af55cdf8-f40c-420a-bc15-ea55967b1995'; // From previous error
const TEST_DATE = '2025-12-04';

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token' // May not be required for some endpoints
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: body ? JSON.parse(body) : null
        });
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing Daily Settlement Endpoints\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Station ID: ${STATION_ID}`);
  console.log(`Test Date: ${TEST_DATE}\n`);

  // Test 1: GET /stations/:stationId/daily-sales
  console.log('1️⃣  Testing GET /stations/:stationId/daily-sales');
  try {
    const result = await makeRequest('GET', `/stations/${STATION_ID}/daily-sales?date=${TEST_DATE}`);
    console.log(`   Status: ${result.status}`);
    if (result.status === 200) {
      console.log(`   ✅ PASS - Nozzle alias fix working!`);
      if (result.body.data) {
        console.log(`   - Total Sale Value: ${result.body.data.totalSaleValue || 0}`);
        console.log(`   - Total Liters: ${result.body.data.totalLiters || 0}`);
        console.log(`   - Readings Count: ${result.body.data.readingsCount || 0}`);
      }
    } else {
      console.log(`   ❌ FAIL - Status ${result.status}`);
      console.log(`   Error: ${result.body?.error || 'Unknown error'}`);
    }
  } catch (err) {
    console.log(`   ❌ ERROR: ${err.message}`);
  }
  console.log();

  // Test 2: GET /stations/:stationId/settlements
  console.log('2️⃣  Testing GET /stations/:stationId/settlements');
  try {
    const result = await makeRequest('GET', `/stations/${STATION_ID}/settlements?limit=5`);
    console.log(`   Status: ${result.status}`);
    if (result.status === 200) {
      console.log(`   ✅ PASS`);
      console.log(`   - Returned ${result.body?.data?.length || 0} settlements`);
    } else {
      console.log(`   ⚠️  Status ${result.status} (might be expected for test data)`);
    }
  } catch (err) {
    console.log(`   ❌ ERROR: ${err.message}`);
  }
  console.log();

  // Test 3: POST /stations/:stationId/settlements
  console.log('3️⃣  Testing POST /stations/:stationId/settlements');
  try {
    const settlementData = {
      date: TEST_DATE,
      actualCash: 50000,
      expectedCash: 48500,
      variance: 1500,
      notes: 'Test settlement submission'
    };
    const result = await makeRequest('POST', `/stations/${STATION_ID}/settlements`, settlementData);
    console.log(`   Status: ${result.status}`);
    if (result.status === 200 || result.status === 201) {
      console.log(`   ✅ PASS`);
    } else {
      console.log(`   ⚠️  Status ${result.status}`);
      if (result.body?.message) console.log(`   Note: ${result.body.message}`);
    }
  } catch (err) {
    console.log(`   ❌ ERROR: ${err.message}`);
  }
  console.log();

  // Test 4: GET /reports/daily-sales
  console.log('4️⃣  Testing GET /reports/daily-sales');
  try {
    const result = await makeRequest('GET', `/reports/daily-sales?date=${TEST_DATE}`);
    console.log(`   Status: ${result.status}`);
    if (result.status === 200) {
      console.log(`   ✅ PASS`);
      console.log(`   - Returned ${result.body?.data?.length || 0} stations`);
    } else {
      console.log(`   ⚠️  Status ${result.status}`);
    }
  } catch (err) {
    console.log(`   ❌ ERROR: ${err.message}`);
  }
  console.log();

  console.log('✅ Test suite complete!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
