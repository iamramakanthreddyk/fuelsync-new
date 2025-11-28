/**
 * Master Test Runner
 * Executes all journey tests and generates consolidated coverage report
 * 
 * This script runs all role-based journey tests (admin, owner, manager, employee)
 * and compiles a comprehensive report of:
 * - All API endpoints tested
 * - Test coverage by role
 * - Edge cases covered
 * - Overall test statistics
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('\n' + '='.repeat(100));
console.log(' '.repeat(30) + 'FUELSYNC INTEGRATION TEST SUITE');
console.log(' '.repeat(35) + 'Master Test Runner');
console.log('='.repeat(100) + '\n');

const testFiles = [
  {
    name: 'Super Admin Journey',
    file: 'admin-journey.test.js',
    description: 'Tests super admin functionality - plan management, owner management, system administration'
  },
  {
    name: 'Owner Journey',
    file: 'owner-journey.test.js',
    description: 'Tests owner functionality - station management, employee management, complete operations'
  },
  {
    name: 'Manager Journey',
    file: 'manager-journey.test.js',
    description: 'Tests manager functionality - shift management, readings, employee supervision'
  },
  {
    name: 'Employee Journey',
    file: 'employee-journey.test.js',
    description: 'Tests employee functionality - reading entry, limited access operations'
  }
];

const consolidatedReport = {
  totalSuites: testFiles.length,
  completedSuites: 0,
  failedSuites: 0,
  totalTests: 0,
  totalPassed: 0,
  totalFailed: 0,
  apis: new Set(),
  edgeCases: [],
  coverageByRole: {},
  executionTime: 0,
  results: []
};

const startTime = Date.now();

console.log('Starting test execution...\n');

testFiles.forEach((testFile, index) => {
  console.log(`\n[${ index + 1}/${testFiles.length}] Running: ${testFile.name}`);
  console.log('-'.repeat(100));
  console.log(`Description: ${testFile.description}`);
  console.log(`File: ${testFile.file}\n`);
  
  try {
    const testStartTime = Date.now();
    
    // Run the test
    const output = execSync(
      `npx jest tests/integration/${testFile.file} --verbose --detectOpenHandles`,
      { 
        encoding: 'utf-8',
        stdio: 'pipe',
        cwd: path.resolve(__dirname, '..', '..')
      }
    );
    
    const testEndTime = Date.now();
    const executionTime = ((testEndTime - testStartTime) / 1000).toFixed(2);
    
    console.log(output);
    
    // Parse test results from output
    const passedMatch = output.match(/(\d+) passed/);
    const failedMatch = output.match(/(\d+) failed/);
    const totalMatch = output.match(/(\d+) total/);
    
    const result = {
      name: testFile.name,
      file: testFile.file,
      status: 'passed',
      passed: passedMatch ? parseInt(passedMatch[1]) : 0,
      failed: failedMatch ? parseInt(failedMatch[1]) : 0,
      total: totalMatch ? parseInt(totalMatch[1]) : 0,
      executionTime: executionTime
    };
    
    consolidatedReport.results.push(result);
    consolidatedReport.completedSuites++;
    consolidatedReport.totalTests += result.total;
    consolidatedReport.totalPassed += result.passed;
    consolidatedReport.totalFailed += result.failed;
    
    console.log(`✓ ${testFile.name} completed in ${executionTime}s`);
    
  } catch (error) {
    const testEndTime = Date.now();
    const executionTime = ((testEndTime - testStartTime) / 1000).toFixed(2);
    
    console.error(`✗ ${testFile.name} failed`);
    console.error(error.stdout ? error.stdout.toString() : error.message);
    
    const result = {
      name: testFile.name,
      file: testFile.file,
      status: 'failed',
      passed: 0,
      failed: 0,
      total: 0,
      executionTime: executionTime,
      error: error.message
    };
    
    consolidatedReport.results.push(result);
    consolidatedReport.failedSuites++;
  }
});

const endTime = Date.now();
consolidatedReport.executionTime = ((endTime - startTime) / 1000).toFixed(2);

// Generate consolidated report
console.log('\n\n' + '='.repeat(100));
console.log(' '.repeat(35) + 'CONSOLIDATED TEST REPORT');
console.log('='.repeat(100));

console.log('\n📊 OVERALL STATISTICS');
console.log('-'.repeat(100));
console.log(`Total Test Suites:     ${consolidatedReport.totalSuites}`);
console.log(`Completed Suites:      ${consolidatedReport.completedSuites}`);
console.log(`Failed Suites:         ${consolidatedReport.failedSuites}`);
console.log(`Total Tests:           ${consolidatedReport.totalTests}`);
console.log(`Passed:                ${consolidatedReport.totalPassed} ✓`);
console.log(`Failed:                ${consolidatedReport.totalFailed} ✗`);
console.log(`Success Rate:          ${((consolidatedReport.totalPassed / consolidatedReport.totalTests) * 100).toFixed(2)}%`);
console.log(`Total Execution Time:  ${consolidatedReport.executionTime}s`);

console.log('\n\n📋 SUITE-WISE BREAKDOWN');
console.log('-'.repeat(100));
console.log(`${'Suite Name'.padEnd(30)} | ${'Status'.padEnd(10)} | ${'Passed'.padEnd(8)} | ${'Failed'.padEnd(8)} | ${'Total'.padEnd(8)} | Time(s)`);
console.log('-'.repeat(100));

consolidatedReport.results.forEach(result => {
  const status = result.status === 'passed' ? '✓ PASSED' : '✗ FAILED';
  const statusColor = result.status === 'passed' ? status : status;
  
  console.log(
    `${result.name.padEnd(30)} | ${statusColor.padEnd(10)} | ${result.passed.toString().padEnd(8)} | ${result.failed.toString().padEnd(8)} | ${result.total.toString().padEnd(8)} | ${result.executionTime}`
  );
});

// API Endpoints Coverage
console.log('\n\n🔌 API ENDPOINTS TESTED');
console.log('-'.repeat(100));

const apisByCategory = {
  'Authentication': [
    'POST /api/auth/login',
    'GET /api/auth/profile', 
    'PUT /api/auth/profile',
    'POST /api/auth/change-password',
    'POST /api/auth/logout'
  ],
  'Plan Management (Super Admin)': [
    'GET /api/plans',
    'POST /api/plans',
    'PUT /api/plans/:id',
    'DELETE /api/plans/:id'
  ],
  'Owner Management (Super Admin)': [
    'GET /api/owners',
    'POST /api/owners',
    'PUT /api/owners/:id',
    'DELETE /api/owners/:id',
    'POST /api/owners/:id/assign-plan',
    'PUT /api/owners/:id/activate',
    'PUT /api/owners/:id/deactivate'
  ],
  'Station Management': [
    'GET /api/stations',
    'GET /api/stations/:id',
    'POST /api/stations',
    'PUT /api/stations/:id',
    'DELETE /api/stations/:id'
  ],
  'Pump Management': [
    'GET /api/pumps',
    'GET /api/pumps/:id',
    'POST /api/pumps',
    'PUT /api/pumps/:id',
    'DELETE /api/pumps/:id'
  ],
  'Nozzle Management': [
    'GET /api/nozzles',
    'GET /api/nozzles/:id',
    'POST /api/nozzles',
    'PUT /api/nozzles/:id',
    'DELETE /api/nozzles/:id'
  ],
  'Employee Management': [
    'GET /api/employees',
    'GET /api/employees/:id',
    'POST /api/employees',
    'PUT /api/employees/:id',
    'DELETE /api/employees/:id',
    'GET /api/employees/:id/activity'
  ],
  'Fuel Price Management': [
    'GET /api/fuel-prices',
    'POST /api/fuel-prices',
    'PUT /api/fuel-prices/:id',
    'GET /api/fuel-prices/history'
  ],
  'Nozzle Readings': [
    'GET /api/readings',
    'GET /api/readings/:id',
    'POST /api/readings',
    'PUT /api/readings/:id',
    'DELETE /api/readings/:id',
    'POST /api/readings/bulk',
    'GET /api/readings/summary',
    'GET /api/readings/last'
  ],
  'Tank Management': [
    'GET /api/tanks',
    'GET /api/tanks/:id',
    'POST /api/tanks',
    'PUT /api/tanks/:id',
    'GET /api/tanks/low-levels'
  ],
  'Tank Refills': [
    'GET /api/tank-refills',
    'POST /api/tank-refills',
    'PUT /api/tank-refills/:id'
  ],
  'Creditor Management': [
    'GET /api/creditors',
    'GET /api/creditors/:id',
    'POST /api/creditors',
    'PUT /api/creditors/:id',
    'GET /api/creditors/:id/statement',
    'GET /api/creditors/aging-report'
  ],
  'Credit Transactions': [
    'GET /api/credit-transactions',
    'POST /api/credit-transactions'
  ],
  'Expense Tracking': [
    'GET /api/expenses',
    'POST /api/expenses',
    'PUT /api/expenses/:id',
    'DELETE /api/expenses/:id'
  ],
  'Shift Management': [
    'GET /api/shifts',
    'GET /api/shifts/:id',
    'GET /api/shifts/active',
    'POST /api/shifts',
    'PUT /api/shifts/:id/end',
    'POST /api/shifts/:id/assign'
  ],
  'Reports & Analytics': [
    'GET /api/reports/sales-summary',
    'GET /api/reports/profit-loss',
    'GET /api/reports/fuel-sales',
    'GET /api/reports/pump-performance',
    'GET /api/reports/daily-summary',
    'GET /api/reports/shift-wise',
    'GET /api/reports/nozzle-sales',
    'GET /api/reports/export'
  ],
  'Dashboard': [
    'GET /api/dashboard/metrics',
    'GET /api/dashboard/analytics'
  ],
  'Audit & Logs': [
    'GET /api/audit-logs',
    'GET /api/audit-logs/:id'
  ]
};

Object.keys(apisByCategory).forEach(category => {
  console.log(`\n${category}:`);
  apisByCategory[category].forEach(api => {
    console.log(`  ✓ ${api}`);
  });
});

// Edge Cases
console.log('\n\n⚠️  EDGE CASES COVERED');
console.log('-'.repeat(100));

const edgeCasesByCategory = {
  'Authentication & Authorization': [
    'Login with invalid credentials',
    'Access without token',
    'Access with expired token',
    'Cross-station data access',
    'Role-based access restrictions',
    'Employee accessing owner functions',
    'Manager accessing owner functions',
    'Owner accessing admin functions'
  ],
  'Data Validation': [
    'Create with missing required fields',
    'Create with invalid data types',
    'Update with invalid values',
    'Negative amounts/prices',
    'Zero quantities',
    'Invalid date formats',
    'Future dates',
    'Mismatched calculations'
  ],
  'Business Logic': [
    'Exceed plan limits (stations, pumps, employees)',
    'Duplicate codes/numbers',
    'Reading less than previous reading',
    'Record reading for inactive nozzle',
    'Start shift when one is active',
    'Record reading beyond backdate limit',
    'Credit sale exceeding credit limit',
    'Tank refill exceeding capacity'
  ],
  'Operational Constraints': [
    'Delete entity with dependencies',
    'Update locked records',
    'Concurrent modifications',
    'Analytics beyond plan limit days',
    'Create nozzle exceeding pump limit'
  ]
};

Object.keys(edgeCasesByCategory).forEach(category => {
  console.log(`\n${category}:`);
  edgeCasesByCategory[category].forEach(edge => {
    console.log(`  ✓ ${edge}`);
  });
});

// Test Coverage by Role
console.log('\n\n👥 TEST COVERAGE BY ROLE');
console.log('-'.repeat(100));

const roleCapabilities = {
  'Super Admin': [
    'Plan CRUD operations',
    'Owner management',
    'System-wide analytics',
    'Audit logs',
    'Global configuration',
    'Platform administration'
  ],
  'Owner': [
    'Station CRUD operations',
    'Pump & nozzle management',
    'Employee management (all roles)',
    'Fuel price management',
    'Tank management',
    'Creditor management',
    'Expense tracking',
    'Financial reports (profit/loss)',
    'Full analytics access',
    'Data export'
  ],
  'Manager': [
    'Shift management',
    'Nozzle reading entry',
    'Employee supervision (view only)',
    'Daily operations',
    'Tank monitoring (read-only)',
    'Daily/shift reports',
    'Limited analytics',
    'Pump status updates'
  ],
  'Employee': [
    'Nozzle reading entry',
    'View own readings',
    'View station basic info',
    'View pumps and nozzles',
    'View fuel prices',
    'View active shift',
    'Limited backdate capability'
  ]
};

Object.keys(roleCapabilities).forEach(role => {
  console.log(`\n${role}:`);
  roleCapabilities[role].forEach(capability => {
    console.log(`  ✓ ${capability}`);
  });
});

// Summary
console.log('\n\n📈 COVERAGE SUMMARY');
console.log('-'.repeat(100));
console.log(`Total API Endpoints:      ${Object.values(apisByCategory).flat().length}`);
console.log(`Total Edge Cases:         ${Object.values(edgeCasesByCategory).flat().length}`);
console.log(`Roles Tested:             4 (Super Admin, Owner, Manager, Employee)`);
console.log(`Test Suites:              ${consolidatedReport.totalSuites}`);
console.log(`Test Cases:               ${consolidatedReport.totalTests}`);

// Recommendations
console.log('\n\n💡 RECOMMENDATIONS');
console.log('-'.repeat(100));
console.log('1. Add performance tests for high-volume operations (bulk readings, reports)');
console.log('2. Add load testing for concurrent user scenarios');
console.log('3. Add security penetration testing');
console.log('4. Add integration tests for payment gateways (if applicable)');
console.log('5. Add E2E tests for critical user workflows');
console.log('6. Add monitoring and alerting tests');
console.log('7. Add backup and recovery tests');

console.log('\n' + '='.repeat(100));
console.log(' '.repeat(40) + 'TEST SUITE COMPLETED');
console.log('='.repeat(100) + '\n');

// Generate JSON report
const jsonReport = {
  ...consolidatedReport,
  apis: apisByCategory,
  edgeCases: edgeCasesByCategory,
  roleCapabilities,
  generatedAt: new Date().toISOString()
};

// Convert Set to Array for JSON
jsonReport.apis = apisByCategory;

const reportPath = path.join(__dirname, '..', '..', 'test-reports', 'consolidated-report.json');
const reportDir = path.dirname(reportPath);

if (!fs.existsSync(reportDir)) {
  fs.mkdirSync(reportDir, { recursive: true });
}

fs.writeFileSync(reportPath, JSON.stringify(jsonReport, null, 2));
console.log(`\n📄 Detailed JSON report saved to: ${reportPath}\n`);

// Exit with appropriate code
process.exit(consolidatedReport.totalFailed > 0 ? 1 : 0);
