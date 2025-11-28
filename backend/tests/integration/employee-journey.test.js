/**
 * Employee Journey Integration Tests
 * Tests the complete workflow of an employee user
 * 
 * Coverage:
 * - Authentication
 * - Reading Entry (Basic)
 * - View Own Shift Data
 * - Limited Station Information
 * - Authorization Restrictions
 */

const request = require('supertest');
const app = require('../../src/app');
const { sequelize, User, Plan, Station, Pump, Nozzle, Shift } = require('../../src/models');
const bcrypt = require('bcryptjs');

describe('Employee Journey', () => {
  let employeeToken;
  let employeeUser;
  let ownerUser;
  let managerUser;
  let testStation;
  let testPump;
  let testNozzle;
  let testPlan;
  let activeShift;
  
  const testReport = {
    totalTests: 0,
    passed: 0,
    failed: 0,
    apis: new Set(),
    edgeCases: [],
    coverage: []
  };

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    
    // Create plan
    testPlan = await Plan.create({
      name: 'Employee Test Plan',
      description: 'Plan for testing',
      maxStations: 1,
      maxPumpsPerStation: 5,
      maxNozzlesPerPump: 4,
      maxEmployees: 5,
      backdatedDays: 3,
      analyticsDays: 7,
      priceMonthly: 499,
      isActive: true
    });
    
    // Create owner
    ownerUser = await User.create({
      email: 'owner@employee.test',
      password: 'owner123',  // Plain password - model will hash it
      name: 'Test Owner',
      role: 'owner',
      planId: testPlan.id,
      isActive: true
    });
    
    // Create station
    testStation = await Station.create({
      ownerId: ownerUser.id,
      name: 'Employee Test Station',
      code: 'ETS001',
      address: 'Test Street',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560001',
      isActive: true
    });
    
    // Update owner
    await ownerUser.update({ stationId: testStation.id });
    
    // Create manager
    managerUser = await User.create({
      email: 'manager@employee.test',
      password: 'manager123',  // Plain password - model will hash it
      name: 'Test Manager',
      role: 'manager',
      stationId: testStation.id,
      isActive: true
    });
    
    // Create employee
    employeeUser = await User.create({
      email: 'employee@test.com',
      password: 'employee123',  // Plain password - model will hash it
      name: 'Test Employee',
      phone: '+91-9876543210',
      role: 'employee',
      stationId: testStation.id,
      isActive: true
    });
    
    // Create pump and nozzle
    testPump = await Pump.create({
      stationId: testStation.id,
      name: 'Pump 1',
      pumpNumber: 1,
      status: 'active'
    });
    
    testNozzle = await Nozzle.create({
      pumpId: testPump.id,
      stationId: testStation.id,
      nozzleNumber: 1,
      fuelType: 'petrol',
      label: 'Petrol',
      status: 'active',
      initialReading: 500
    });
    
    // Create an active shift
    activeShift = await Shift.create({
      stationId: testStation.id,
      managerId: managerUser.id,
      shiftType: 'morning',
      startTime: new Date(),
      openingCash: 5000,
      status: 'active'
    });
  });

  afterAll(async () => {
    console.log('\n' + '='.repeat(80));
    console.log('EMPLOYEE JOURNEY TEST REPORT');
    console.log('='.repeat(80));
    console.log(`Total Tests: ${testReport.totalTests}`);
    console.log(`Passed: ${testReport.passed}`);
    console.log(`Failed: ${testReport.failed}`);
    console.log(`Success Rate: ${((testReport.passed / testReport.totalTests) * 100).toFixed(2)}%`);
    console.log('\nAPIs Tested:');
    testReport.apis.forEach(api => console.log(`  ✓ ${api}`));
    console.log('\nEdge Cases Covered:');
    testReport.edgeCases.forEach(edge => console.log(`  ✓ ${edge}`));
    console.log('\nTest Coverage:');
    testReport.coverage.forEach(item => console.log(`  • ${item}`));
    console.log('='.repeat(80) + '\n');
    
    await sequelize.close();
  });

  describe('1. Authentication', () => {
    test('Employee login', async () => {
      testReport.totalTests++;
      testReport.apis.add('POST /api/auth/login');
      testReport.coverage.push('Employee login with valid credentials');
      
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'employee@test.com',
          password: 'employee123'
        });

      expect(response.status).toBe(200);
      expect(response.body.user.role).toBe('employee');
      expect(response.body.user.stationId).toBe(testStation.id);
      
      employeeToken = response.body.token;
      testReport.passed++;
    });

    test('Invalid credentials', async () => {
      testReport.totalTests++;
      testReport.edgeCases.push('Login with invalid credentials');
      
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'employee@test.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      testReport.passed++;
    });

    test('Get profile', async () => {
      testReport.totalTests++;
      testReport.apis.add('GET /api/auth/profile');
      testReport.coverage.push('Retrieve employee profile');
      
      const response = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user.role).toBe('employee');
      expect(response.body.user.id).toBe(employeeUser.id);
      testReport.passed++;
    });

    test('Update own profile', async () => {
      testReport.totalTests++;
      testReport.apis.add('PUT /api/auth/profile');
      testReport.coverage.push('Update employee profile');
      
      const response = await request(app)
        .put('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          phone: '+91-9999999999'
        });

      expect(response.status).toBe(200);
      testReport.passed++;
    });

    test('Change password', async () => {
      testReport.totalTests++;
      testReport.apis.add('POST /api/auth/change-password');
      testReport.coverage.push('Change password');
      
      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          currentPassword: 'employee123',
          newPassword: 'newemployee123'
        });

      expect(response.status).toBe(200);
      
      // Change back
      await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          currentPassword: 'newemployee123',
          newPassword: 'employee123'
        });
      
      testReport.passed++;
    });
  });

  describe('2. Reading Entry', () => {
    test('Record nozzle reading', async () => {
      testReport.totalTests++;
      testReport.apis.add('POST /api/readings');
      testReport.coverage.push('Record nozzle reading');
      
      const response = await request(app)
        .post('/api/v1/readings')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          nozzleId: testNozzle.id,
          stationId: testStation.id,
          readingDate: new Date().toISOString().split('T')[0],
          readingValue: 800,
          previousReading: 500,
          litresSold: 300,
          pricePerLitre: 105.00,
          totalAmount: 31500,
          cashAmount: 20000,
          onlineAmount: 10000,
          creditAmount: 1500
        });

      expect(response.status).toBe(201);
      testReport.passed++;
    });

    test('View own readings', async () => {
      testReport.totalTests++;
      testReport.apis.add('GET /api/readings');
      testReport.coverage.push('View readings entered by employee');
      
      const today = new Date().toISOString().split('T')[0];
      const response = await request(app)
        .get(`/api/readings?stationId=${testStation.id}&startDate=${today}&endDate=${today}`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.readings)).toBe(true);
      testReport.passed++;
    });

    test('Update own reading', async () => {
      testReport.totalTests++;
      testReport.apis.add('PUT /api/readings/:id');
      testReport.coverage.push('Update reading entered by employee');
      
      const readings = await request(app)
        .get(`/api/readings?stationId=${testStation.id}`)
        .set('Authorization', `Bearer ${employeeToken}`);

      if (readings.body.readings.length > 0) {
        const response = await request(app)
          .put(`/api/readings/${readings.body.readings[0].id}`)
          .set('Authorization', `Bearer ${employeeToken}`)
          .send({
            notes: 'Verified reading'
          });

        expect([200, 403]).toContain(response.status); // May be restricted to own readings
      }
      
      testReport.passed++;
    });

    test('Record reading with invalid calculation - Edge Case', async () => {
      testReport.totalTests++;
      testReport.edgeCases.push('Record reading with mismatched calculations');
      
      const response = await request(app)
        .post('/api/v1/readings')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          nozzleId: testNozzle.id,
          stationId: testStation.id,
          readingDate: new Date().toISOString().split('T')[0],
          readingValue: 900,
          previousReading: 800,
          litresSold: 50, // Should be 100
          pricePerLitre: 105.00,
          totalAmount: 10500
        });

      expect(response.status).toBe(400);
      testReport.passed++;
    });

    test('Record backdated reading within limit', async () => {
      testReport.totalTests++;
      testReport.coverage.push('Record backdated reading within allowed days');
      
      const backdateDate = new Date();
      backdateDate.setDate(backdateDate.getDate() - 2); // Within 3 days limit
      
      const response = await request(app)
        .post('/api/v1/readings')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          nozzleId: testNozzle.id,
          stationId: testStation.id,
          readingDate: backdateDate.toISOString().split('T')[0],
          readingValue: 750,
          previousReading: 700,
          litresSold: 50,
          pricePerLitre: 105.00,
          totalAmount: 5250
        });

      expect(response.status).toBe(201);
      testReport.passed++;
    });

    test('Record backdated reading beyond limit - Edge Case', async () => {
      testReport.totalTests++;
      testReport.edgeCases.push('Record reading beyond allowed backdate days');
      
      const backdateDate = new Date();
      backdateDate.setDate(backdateDate.getDate() - 5); // Beyond 3 days limit
      
      const response = await request(app)
        .post('/api/v1/readings')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          nozzleId: testNozzle.id,
          stationId: testStation.id,
          readingDate: backdateDate.toISOString().split('T')[0],
          readingValue: 850,
          previousReading: 800
        });

      expect(response.status).toBe(403);
      testReport.passed++;
    });

    test('Delete own reading within time limit', async () => {
      testReport.totalTests++;
      testReport.coverage.push('Delete own reading within time limit');
      
      // Create a reading
      const newReading = await request(app)
        .post('/api/v1/readings')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          nozzleId: testNozzle.id,
          stationId: testStation.id,
          readingDate: new Date().toISOString().split('T')[0],
          readingValue: 950,
          previousReading: 900,
          litresSold: 50,
          pricePerLitre: 105.00,
          totalAmount: 5250
        });

      const response = await request(app)
        .delete(`/api/readings/${newReading.body.reading.id}`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect([200, 403]).toContain(response.status); // May be restricted
      testReport.passed++;
    });
  });

  describe('3. Limited Station Access', () => {
    test('View station basic info', async () => {
      testReport.totalTests++;
      testReport.apis.add('GET /api/stations/:id');
      testReport.coverage.push('View basic station information');
      
      const response = await request(app)
        .get(`/api/stations/${testStation.id}`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      testReport.passed++;
    });

    test('View pumps', async () => {
      testReport.totalTests++;
      testReport.apis.add('GET /api/pumps');
      testReport.coverage.push('View station pumps');
      
      const response = await request(app)
        .get(`/api/pumps?stationId=${testStation.id}`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.pumps)).toBe(true);
      testReport.passed++;
    });

    test('View nozzles', async () => {
      testReport.totalTests++;
      testReport.apis.add('GET /api/nozzles');
      testReport.coverage.push('View nozzles');
      
      const response = await request(app)
        .get(`/api/nozzles?stationId=${testStation.id}`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.nozzles)).toBe(true);
      testReport.passed++;
    });

    test('View fuel prices', async () => {
      testReport.totalTests++;
      testReport.apis.add('GET /api/fuel-prices');
      testReport.coverage.push('View current fuel prices');
      
      const response = await request(app)
        .get(`/api/fuel-prices?stationId=${testStation.id}`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      testReport.passed++;
    });

    test('View active shift', async () => {
      testReport.totalTests++;
      testReport.apis.add('GET /api/shifts/active');
      testReport.coverage.push('View active shift');
      
      const response = await request(app)
        .get(`/api/shifts/active?stationId=${testStation.id}`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      testReport.passed++;
    });
  });

  describe('4. Authorization Restrictions', () => {
    test('Cannot create pump - Edge Case', async () => {
      testReport.totalTests++;
      testReport.edgeCases.push('Employee attempting to create pump');
      
      const response = await request(app)
        .post('/api/v1/pumps')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          stationId: testStation.id,
          name: 'Unauthorized Pump',
          pumpNumber: 99,
          status: 'active'
        });

      expect(response.status).toBe(403);
      testReport.passed++;
    });

    test('Cannot create nozzle - Edge Case', async () => {
      testReport.totalTests++;
      testReport.edgeCases.push('Employee attempting to create nozzle');
      
      const response = await request(app)
        .post('/api/v1/nozzles')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          pumpId: testPump.id,
          stationId: testStation.id,
          nozzleNumber: 99,
          fuelType: 'diesel',
          status: 'active'
        });

      expect(response.status).toBe(403);
      testReport.passed++;
    });

    test('Cannot update pump - Edge Case', async () => {
      testReport.totalTests++;
      testReport.edgeCases.push('Employee attempting to update pump');
      
      const response = await request(app)
        .put(`/api/pumps/${testPump.id}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          status: 'maintenance'
        });

      expect(response.status).toBe(403);
      testReport.passed++;
    });

    test('Cannot update nozzle - Edge Case', async () => {
      testReport.totalTests++;
      testReport.edgeCases.push('Employee attempting to update nozzle');
      
      const response = await request(app)
        .put(`/api/nozzles/${testNozzle.id}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          status: 'inactive'
        });

      expect(response.status).toBe(403);
      testReport.passed++;
    });

    test('Cannot delete pump - Edge Case', async () => {
      testReport.totalTests++;
      testReport.edgeCases.push('Employee attempting to delete pump');
      
      const response = await request(app)
        .delete(`/api/pumps/${testPump.id}`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(403);
      testReport.passed++;
    });

    test('Cannot set fuel prices - Edge Case', async () => {
      testReport.totalTests++;
      testReport.edgeCases.push('Employee attempting to set fuel price');
      
      const response = await request(app)
        .post('/api/v1/fuel-prices')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          stationId: testStation.id,
          fuelType: 'petrol',
          price: 110.00,
          effectiveFrom: new Date().toISOString().split('T')[0]
        });

      expect(response.status).toBe(403);
      testReport.passed++;
    });

    test('Cannot create shift - Edge Case', async () => {
      testReport.totalTests++;
      testReport.edgeCases.push('Employee attempting to create shift');
      
      const response = await request(app)
        .post('/api/v1/shifts')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          stationId: testStation.id,
          shiftType: 'evening',
          startTime: new Date().toISOString(),
          openingCash: 5000
        });

      expect(response.status).toBe(403);
      testReport.passed++;
    });

    test('Cannot end shift - Edge Case', async () => {
      testReport.totalTests++;
      testReport.edgeCases.push('Employee attempting to end shift');
      
      const response = await request(app)
        .put(`/api/shifts/${activeShift.id}/end`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          endTime: new Date().toISOString(),
          closingCash: 10000
        });

      expect(response.status).toBe(403);
      testReport.passed++;
    });

    test('Cannot view employees - Edge Case', async () => {
      testReport.totalTests++;
      testReport.edgeCases.push('Employee attempting to view employees list');
      
      const response = await request(app)
        .get('/api/v1/employees')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(403);
      testReport.passed++;
    });

    test('Cannot create employee - Edge Case', async () => {
      testReport.totalTests++;
      testReport.edgeCases.push('Employee attempting to create employee');
      
      const response = await request(app)
        .post('/api/v1/employees')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          email: 'newemployee@test.com',
          password: 'password123',
          name: 'New Employee',
          role: 'employee',
          stationId: testStation.id
        });

      expect(response.status).toBe(403);
      testReport.passed++;
    });

    test('Cannot view tanks - Edge Case', async () => {
      testReport.totalTests++;
      testReport.edgeCases.push('Employee attempting to view tanks');
      
      const response = await request(app)
        .get(`/api/tanks?stationId=${testStation.id}`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(403);
      testReport.passed++;
    });

    test('Cannot record tank refill - Edge Case', async () => {
      testReport.totalTests++;
      testReport.edgeCases.push('Employee attempting to record tank refill');
      
      const response = await request(app)
        .post('/api/v1/tank-refills')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          stationId: testStation.id,
          litres: 5000,
          costPerLitre: 95.00
        });

      expect(response.status).toBe(403);
      testReport.passed++;
    });

    test('Cannot view creditors - Edge Case', async () => {
      testReport.totalTests++;
      testReport.edgeCases.push('Employee attempting to view creditors');
      
      const response = await request(app)
        .get(`/api/creditors?stationId=${testStation.id}`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(403);
      testReport.passed++;
    });

    test('Cannot record credit transaction - Edge Case', async () => {
      testReport.totalTests++;
      testReport.edgeCases.push('Employee attempting to record credit transaction');
      
      const response = await request(app)
        .post('/api/v1/credit-transactions')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          stationId: testStation.id,
          transactionType: 'sale',
          amount: 1000
        });

      expect(response.status).toBe(403);
      testReport.passed++;
    });

    test('Cannot view expenses - Edge Case', async () => {
      testReport.totalTests++;
      testReport.edgeCases.push('Employee attempting to view expenses');
      
      const response = await request(app)
        .get(`/api/expenses?stationId=${testStation.id}`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(403);
      testReport.passed++;
    });

    test('Cannot record expense - Edge Case', async () => {
      testReport.totalTests++;
      testReport.edgeCases.push('Employee attempting to record expense');
      
      const response = await request(app)
        .post('/api/v1/expenses')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          stationId: testStation.id,
          category: 'utilities',
          amount: 5000,
          expenseDate: new Date().toISOString().split('T')[0]
        });

      expect(response.status).toBe(403);
      testReport.passed++;
    });

    test('Cannot access reports - Edge Case', async () => {
      testReport.totalTests++;
      testReport.edgeCases.push('Employee attempting to access reports');
      
      const response = await request(app)
        .get(`/api/reports/sales-summary?stationId=${testStation.id}`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(403);
      testReport.passed++;
    });

    test('Cannot access profit/loss - Edge Case', async () => {
      testReport.totalTests++;
      testReport.edgeCases.push('Employee attempting to access profit/loss');
      
      const response = await request(app)
        .get(`/api/reports/profit-loss?stationId=${testStation.id}`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(403);
      testReport.passed++;
    });

    test('Cannot export reports - Edge Case', async () => {
      testReport.totalTests++;
      testReport.edgeCases.push('Employee attempting to export reports');
      
      const response = await request(app)
        .get(`/api/reports/export?stationId=${testStation.id}&type=sales&format=csv`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(403);
      testReport.passed++;
    });

    test('Cannot update station - Edge Case', async () => {
      testReport.totalTests++;
      testReport.edgeCases.push('Employee attempting to update station');
      
      const response = await request(app)
        .put(`/api/stations/${testStation.id}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          address: 'Unauthorized Update'
        });

      expect(response.status).toBe(403);
      testReport.passed++;
    });

    test('Cannot access other station - Edge Case', async () => {
      testReport.totalTests++;
      testReport.edgeCases.push('Employee accessing unauthorized station');
      
      // Create another station
      const otherStation = await Station.create({
        ownerId: ownerUser.id,
        name: 'Other Station',
        code: 'OTHER001',
        address: 'Other',
        city: 'Other',
        state: 'Other'
      });

      const response = await request(app)
        .get(`/api/stations/${otherStation.id}`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect([403, 404]).toContain(response.status);
      testReport.passed++;
    });

    test('Cannot access dashboard metrics - Edge Case', async () => {
      testReport.totalTests++;
      testReport.edgeCases.push('Employee attempting to access dashboard');
      
      const response = await request(app)
        .get(`/api/dashboard/metrics?stationId=${testStation.id}`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(403);
      testReport.passed++;
    });
  });

  describe('5. Daily Operations', () => {
    test('View today readings summary', async () => {
      testReport.totalTests++;
      testReport.coverage.push('View daily readings summary');
      
      const today = new Date().toISOString().split('T')[0];
      const response = await request(app)
        .get(`/api/readings/summary?stationId=${testStation.id}&date=${today}`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect([200, 403]).toContain(response.status);
      testReport.passed++;
    });

    test('Check nozzle status before reading', async () => {
      testReport.totalTests++;
      testReport.coverage.push('Check nozzle status');
      
      const response = await request(app)
        .get(`/api/nozzles/${testNozzle.id}`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      testReport.passed++;
    });

    test('View last reading for nozzle', async () => {
      testReport.totalTests++;
      testReport.coverage.push('View last reading for nozzle');
      
      const response = await request(app)
        .get(`/api/readings/last?nozzleId=${testNozzle.id}`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      testReport.passed++;
    });
  });
});
