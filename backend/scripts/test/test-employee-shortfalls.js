/**
 * Test Employee Shortfall Endpoint
 * Run this after setting up the backend with migrations
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api/v1';

async function testEmployeeShortfalls() {
  try {
    console.log('\n🧪 Testing Employee Shortfall Endpoint...\n');

    // 1. Get a valid station ID (use 'all' to test)
    console.log('1️⃣  Testing endpoint with all stations...');
    const response = await axios.get(
      `${BASE_URL}/stations/all/employee-shortfalls`,
      {
        params: {
          startDate: '2026-01-01',
          endDate: '2026-01-31'
        },
        headers: {
          'Authorization': 'Bearer YOUR_TOKEN_HERE'
        }
      }
    );

    console.log('✅ Success! Response:');
    console.log(JSON.stringify(response.data, null, 2));

    if (response.data.data && response.data.data.length > 0) {
      console.log('\n📊 Employee Breakdown:');
      response.data.data.forEach(emp => {
        console.log(`  ${emp.employeeName}:`);
        console.log(`    Total Shortfall: ₹${emp.totalShortfall}`);
        console.log(`    Days Affected: ${emp.daysWithShortfall}`);
        console.log(`    Avg/Day: ₹${emp.averagePerDay}`);
        console.log(`    Settlements: ${emp.settlementsCount}`);
      });
    } else {
      console.log('\nℹ️  No shortfalls recorded for this period');
    }

  } catch (error) {
    if (error.response) {
      console.error('❌ API Error:');
      console.error(`  Status: ${error.response.status}`);
      console.error(`  Message: ${error.response.data?.error || error.message}`);
    } else {
      console.error('❌ Connection Error:', error.message);
    }
  }
}

testEmployeeShortfalls();
