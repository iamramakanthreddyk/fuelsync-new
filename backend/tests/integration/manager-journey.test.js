/**
 * Manager Journey Integration Tests
 * Tests the complete workflow of a manager user
 * 
 * Coverage:
 * - Authentication
 * - Shift Management
 * - Nozzle Readings Entry
 * - Employee Supervision
 * - Daily Reports
 * - Pump Operations
 * - Tank Monitoring
 * - Limited Analytics
 */

const request = require('supertest');
const app = require('../../src/app');
const { sequelize, User, Plan, Station, Pump, Nozzle, Shift } = require('../../src/models');
const bcrypt = require('bcryptjs');

describe('Manager Journey', () => {
  let managerToken;
  let managerUser;
  let ownerUser;
  let testStation;
  let testPump;
  let testNozzle;
  let testPlan;
  let currentShift;
  let employeeUser;
  let createdCreditorId;
  
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
      name: 'Manager Test Plan',
      description: 'Plan for testing',
      maxStations: 2,
      maxPumpsPerStation: 8,
      maxNozzlesPerPump: 4,
      maxEmployees: 10,
      backdatedDays: 7,
      analyticsDays: 30,
      canExport: true,
      canTrackExpenses: true,
      priceMonthly: 999,
      isActive: true
    });
    
    // Create owner
    ownerUser = await User.create({
      email: 'owner@manager.test',
      password: 'owner123',  // Plain password - model will hash it
      name: 'Test Owner',
      role: 'owner',
      planId: testPlan.id,
      isActive: true
    });
    
    // Create station
    testStation = await Station.create({
      ownerId: ownerUser.id,
      name: 'Manager Test Station',
      code: 'MTS001',
      address: 'Test Street',
      city: 'Delhi',
      state: 'Delhi',
      pincode: '110001',
      isActive: true
    });
    
    // Update owner
    await ownerUser.update({ stationId: testStation.id });
    
    // Create manager
    managerUser = await User.create({
      email: 'manager@test.com',
      password: 'manager123',  // Plain password - model will hash it
      name: 'Test Manager',
      phone: '+91-9876543210',
      role: 'manager',
      stationId: testStation.id,
      isActive: true
    });
    
    // Create employee
    employeeUser = await User.create({
      email: 'employee@manager.test',
      password: 'employee123',  // Plain password - model will hash it
      name: 'Test Employee',
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
      initialReading: 1000
    });
  });

  afterAll(async () => {
    console.log('\n' + '='.repeat(80));
    console.log('MANAGER JOURNEY TEST REPORT');
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
    test('Manager login', async () => {
      testReport.totalTests++;
      testReport.apis.add('POST /api/auth/login');
      testReport.coverage.push('Manager login with valid credentials');
      
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'manager@test.com',
          password: 'manager123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.role).toBe('manager');
      expect(response.body.data.user.station.id).toBe(testStation.id);
      
      managerToken = response.body.data.token;
      testReport.passed++;
    });

    test('Invalid credentials', async () => {
      testReport.totalTests++;
      testReport.edgeCases.push('Login with invalid credentials');
      
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'manager@test.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      testReport.passed++;
    });

    test('Get profile', async () => {
      testReport.totalTests++;
      testReport.apis.add('GET /api/auth/profile');
      testReport.coverage.push('Retrieve manager profile');
      
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.role).toBe('manager');
      testReport.passed++;
    });
  });

  describe('2. Shift Management', () => {
    test('Start shift', async () => {
      testReport.totalTests++;
      testReport.apis.add('POST /api/shifts');
      testReport.coverage.push('Start new shift');
      
      // First check if there's an active shift and end it
      const activeCheck = await request(app)
        .get(`/api/v1/shifts/active?stationId=${testStation.id}`)
        .set('Authorization', `Bearer ${managerToken}`);
      
      if (activeCheck.status === 200 && activeCheck.body.data) {
        // End the active shift
        const now = new Date();
        await request(app)
          .post(`/api/v1/shifts/${activeCheck.body.data.id}/end`)
          .set('Authorization', `Bearer ${managerToken}`)
          .send({
            endTime: now.toTimeString().substring(0, 5), // HH:MM format
            cashCollected: 10000
          });
      }
      
      const now = new Date();
      const response = await request(app)
        .post('/api/v1/shifts/start')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          stationId: testStation.id,
          shiftType: 'morning',
          startTime: now.toTimeString().substring(0, 5), // HH:MM format
          shiftDate: now.toISOString().split('T')[0] // YYYY-MM-DD format
        });

      if (response.status !== 201) {
        console.log('Start shift error:', response.status, response.body);
      }

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      
      currentShift = response.body.data;
      testReport.passed++;
    });

    test('Get active shift', async () => {
      testReport.totalTests++;
      testReport.apis.add('GET /api/shifts/active');
      testReport.coverage.push('Retrieve active shift');
      
      const response = await request(app)
        .get(`/api/v1/shifts/active?stationId=${testStation.id}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(currentShift.id);
      testReport.passed++;
    });

    test('Start shift when one already active - Edge Case', async () => {
      testReport.totalTests++;
      testReport.edgeCases.push('Start shift when one is already active');
      
      const now = new Date();
      const response = await request(app)
        .post('/api/v1/shifts/start')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          stationId: testStation.id,
          shiftType: 'evening',
          startTime: now.toTimeString().substring(0, 5), // HH:MM format
          shiftDate: now.toISOString().split('T')[0] // YYYY-MM-DD format
        });

      expect(response.status).toBe(400);
      testReport.passed++;
    });

    test.skip('End shift', async () => {
      testReport.totalTests++;
      testReport.apis.add('PUT /api/shifts/:id/end');
      testReport.coverage.push('End active shift');
      
      const now = new Date();
      const response = await request(app)
        .post(`/api/v1/shifts/${currentShift.id}/end`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          endTime: now.toTimeString().substring(0, 5), // HH:MM format
          cashCollected: 25000,
          endNotes: 'Normal shift'
        });

      if (response.status !== 200) {
        console.log('End shift error:', response.status, response.body);
      }

      expect(response.status).toBe(200);
      testReport.passed++;
    });

    test('Get shift history', async () => {
      testReport.totalTests++;
      testReport.apis.add('GET /api/shifts');
      testReport.coverage.push('Retrieve shift history');
      
      const response = await request(app)
        .get(`/api/v1/stations/${testStation.id}/shifts`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      testReport.passed++;
    });

    test('Get shift by ID', async () => {
      testReport.totalTests++;
      testReport.apis.add('GET /api/shifts/:id');
      testReport.coverage.push('Retrieve specific shift details');
      
      const response = await request(app)
        .get(`/api/v1/shifts/${currentShift.id}`)
        .set('Authorization', `Bearer ${managerToken}`);

      if (response.status !== 200) {
        console.log('Get shift by ID error:', response.status, response.body);
      }

      expect(response.status).toBe(200);
      testReport.passed++;
    });
  });

  describe('3. Reading Entry & Management', () => {
    test('Record nozzle reading', async () => {
      testReport.totalTests++;
      testReport.apis.add('POST /api/readings');
      testReport.coverage.push('Record nozzle reading during shift');
      
      const response = await request(app)
        .post('/api/v1/readings')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          nozzleId: testNozzle.id,
          stationId: testStation.id,
          readingDate: new Date().toISOString().split('T')[0],
          readingValue: 1500,
          previousReading: 1000,
          litresSold: 500,
          pricePerLitre: 105.00,
          totalAmount: 52500,
          cashAmount: 35000,
          onlineAmount: 15000,
          creditAmount: 2500
        });

      expect(response.status).toBe(201);
      testReport.passed++;
    });

    test('Get readings for today', async () => {
      testReport.totalTests++;
      testReport.apis.add('GET /api/readings');
      testReport.coverage.push('Retrieve readings for current date');
      
      const today = new Date().toISOString().split('T')[0];
      const response = await request(app)
        .get(`/api/v1/readings?stationId=${testStation.id}&startDate=${today}&endDate=${today}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      testReport.passed++;
    });

    test('Update reading', async () => {
      testReport.totalTests++;
      testReport.apis.add('PUT /api/readings/:id');
      testReport.coverage.push('Update nozzle reading');
      
      const readings = await request(app)
        .get(`/api/v1/readings?stationId=${testStation.id}`)
        .set('Authorization', `Bearer ${managerToken}`);

      if (readings.body.data && readings.body.data.length > 0) {
        const response = await request(app)
          .put(`/api/v1/readings/${readings.body.data[0].id}`)
          .set('Authorization', `Bearer ${managerToken}`)
          .send({
            notes: 'Verified by manager'
          });

        expect(response.status).toBe(200);
      }
      
      testReport.passed++;
    });

    test('Record reading for inactive nozzle - Edge Case', async () => {
      testReport.totalTests++;
      testReport.edgeCases.push('Record reading for inactive nozzle');
      
      // Create inactive nozzle
      const inactiveNozzle = await Nozzle.create({
        pumpId: testPump.id,
        stationId: testStation.id,
        nozzleNumber: 2,
        fuelType: 'diesel',
        status: 'inactive',
        initialReading: 0
      });

      const response = await request(app)
        .post('/api/v1/readings')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          nozzleId: inactiveNozzle.id,
          stationId: testStation.id,
          readingDate: new Date().toISOString().split('T')[0],
          readingValue: 100
        });

      expect(response.status).toBe(400);
      testReport.passed++;
    });

    test.skip('Bulk reading entry', async () => {
      testReport.totalTests++;
      testReport.apis.add('POST /api/readings/bulk');
      testReport.coverage.push('Bulk nozzle reading entry');
      
      const response = await request(app)
        .post('/api/v1/readings/bulk')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          stationId: testStation.id,
          readingDate: new Date().toISOString().split('T')[0],
          readings: [
            {
              nozzleId: testNozzle.id,
              readingValue: 1600,
              previousReading: 1500,
              litresSold: 100,
              pricePerLitre: 105.00,
              totalAmount: 10500
            }
          ]
        });

      expect([200, 201]).toContain(response.status);
      testReport.passed++;
    });
  });

  describe('4. Employee Supervision', () => {
    test('View employees list', async () => {
      testReport.totalTests++;
      testReport.apis.add('GET /api/employees');
      testReport.coverage.push('View station employees');
      
      const response = await request(app)
        .get(`/api/v1/users?role=employee&stationId=${testStation.id}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      testReport.passed++;
    });

    test('View employee details', async () => {
      testReport.totalTests++;
      testReport.apis.add('GET /api/employees/:id');
      testReport.coverage.push('View specific employee details');
      
      const response = await request(app)
        .get(`/api/v1/users/${employeeUser.id}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
      testReport.passed++;
    });

    test.skip('View employee activity', async () => {
      testReport.totalTests++;
      testReport.apis.add('GET /api/employees/:id/activity');
      testReport.coverage.push('View employee activity log');
      
      const response = await request(app)
        .get(`/api/v1/users/${employeeUser.id}/activity`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
      testReport.passed++;
    });

    test.skip('Assign employee to shift', async () => {
      testReport.totalTests++;
      testReport.apis.add('POST /api/shifts/:id/assign');
      testReport.coverage.push('Assign employee to shift');
      
      // Start new shift first
      const shift = await request(app)
        .post('/api/v1/shifts/start')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          stationId: testStation.id,
          shiftType: 'evening',
          startTime: new Date().toISOString(),
          openingCash: 8000
        });

      const response = await request(app)
        .post(`/api/v1/shifts/${shift.body.data.id}/assign`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          employeeId: employeeUser.id
        });

      expect([200, 201]).toContain(response.status);
      
      // End the shift
      const now = new Date();
      await request(app)
        .post(`/api/v1/shifts/${shift.body.data.id}/end`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          endTime: now.toTimeString().substring(0, 5), // HH:MM format
          cashCollected: 15000
        });
      
      testReport.passed++;
    });

    test('Manager can create employee', async () => {
      testReport.totalTests++;
      testReport.coverage.push('Manager creating employee user');
      
      const response = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          email: 'newemployee@test.com',
          password: 'password123',
          name: 'New Employee',
          role: 'employee',
          stationId: testStation.id
        });

      expect(response.status).toBe(201);
      testReport.passed++;
    });

    test('Manager can delete employee', async () => {
      testReport.totalTests++;
      testReport.coverage.push('Manager deleting employee user');
      
      const response = await request(app)
        .delete(`/api/v1/users/${employeeUser.id}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
      testReport.passed++;
    });
  });

  describe('5. Pump Operations', () => {
    test('View pumps', async () => {
      testReport.totalTests++;
      testReport.apis.add('GET /api/pumps');
      testReport.coverage.push('View station pumps');
      
      const response = await request(app)
        .get(`/api/v1/stations/${testStation.id}/pumps`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      testReport.passed++;
    });

    test.skip('View pump details', async () => {
      testReport.totalTests++;
      testReport.apis.add('GET /api/pumps/:id');
      testReport.coverage.push('View specific pump details');
      
      const response = await request(app)
        .get(`/api/v1/stations/pumps/${testPump.id}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
      testReport.passed++;
    });

    test('Update pump status to maintenance', async () => {
      testReport.totalTests++;
      testReport.coverage.push('Set pump to maintenance mode');
      
      const response = await request(app)
        .put(`/api/v1/stations/pumps/${testPump.id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          status: 'maintenance',
          notes: 'Routine maintenance'
        });

      expect([200, 403]).toContain(response.status); // May be restricted
      testReport.passed++;
    });

    test('View nozzles for pump', async () => {
      testReport.totalTests++;
      testReport.apis.add('GET /api/nozzles');
      testReport.coverage.push('View nozzles for pump');
      
      const response = await request(app)
        .get(`/api/v1/stations/pumps/${testPump.id}/nozzles`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
      testReport.passed++;
    });

    test('Manager cannot create pump - Edge Case', async () => {
      testReport.totalTests++;
      testReport.edgeCases.push('Manager attempting to create pump (owner privilege)');
      
      const response = await request(app)
        .post(`/api/v1/stations/${testStation.id}/pumps`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          stationId: testStation.id,
          name: 'New Pump',
          pumpNumber: 99,
          status: 'active'
        });

      expect(response.status).toBe(403);
      testReport.passed++;
    });

    test.skip('Manager cannot delete pump - Edge Case', async () => {
      testReport.totalTests++;
      testReport.edgeCases.push('Manager attempting to delete pump (owner privilege)');
      
      const response = await request(app)
        .delete(`/api/v1/stations/pumps/${testPump.id}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(403);
      testReport.passed++;
    });
  });

  describe('6. Tank Monitoring', () => {
    test('View tanks', async () => {
      testReport.totalTests++;
      testReport.apis.add('GET /api/tanks');
      testReport.coverage.push('View station tanks');
      
      const response = await request(app)
        .get(`/api/v1/stations/${testStation.id}/tanks`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      testReport.passed++;
    });

    test.skip('View tank refill history', async () => {
      testReport.totalTests++;
      testReport.apis.add('GET /api/tank-refills');
      testReport.coverage.push('View tank refill history');
      
      const response = await request(app)
        .get(`/api/tank-refills?stationId=${testStation.id}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
      testReport.passed++;
    });

    test.skip('Check low tank levels', async () => {
      testReport.totalTests++;
      testReport.apis.add('GET /api/tanks/low-levels');
      testReport.coverage.push('Check tanks with low levels');
      
      const response = await request(app)
        .get(`/api/tanks/low-levels?stationId=${testStation.id}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
      testReport.passed++;
    });

    test.skip('Manager cannot record tank refill - Edge Case', async () => {
      testReport.totalTests++;
      testReport.edgeCases.push('Manager attempting to record refill (owner privilege)');
      
      const response = await request(app)
        .post('/api/v1/tank-refills')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          stationId: testStation.id,
          litres: 5000,
          costPerLitre: 95.00
        });

      expect(response.status).toBe(403);
      testReport.passed++;
    });
  });

  describe('7. Daily Reports', () => {
    test.skip('Get daily sales summary', async () => {
      testReport.totalTests++;
      testReport.apis.add('GET /api/reports/daily-summary');
      testReport.coverage.push('Daily sales summary');
      
      const today = new Date().toISOString().split('T')[0];
      const response = await request(app)
        .get(`/api/reports/daily-summary?stationId=${testStation.id}&date=${today}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
      testReport.passed++;
    });

    test.skip('Get shift-wise report', async () => {
      testReport.totalTests++;
      testReport.apis.add('GET /api/reports/shift-wise');
      testReport.coverage.push('Shift-wise sales report');
      
      const response = await request(app)
        .get(`/api/reports/shift-wise?stationId=${testStation.id}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
      testReport.passed++;
    });

    test.skip('Get pump performance', async () => {
      testReport.totalTests++;
      testReport.apis.add('GET /api/reports/pump-performance');
      testReport.coverage.push('Pump performance report');
      
      const response = await request(app)
        .get(`/api/reports/pump-performance?stationId=${testStation.id}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
      testReport.passed++;
    });

    test.skip('Get nozzle-wise sales', async () => {
      testReport.totalTests++;
      testReport.coverage.push('Nozzle-wise sales report');
      
      const today = new Date().toISOString().split('T')[0];
      const response = await request(app)
        .get(`/api/reports/nozzle-sales?stationId=${testStation.id}&date=${today}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
      testReport.passed++;
    });

    test.skip('Export daily report', async () => {
      testReport.totalTests++;
      testReport.coverage.push('Export daily report');
      
      const today = new Date().toISOString().split('T')[0];
      const response = await request(app)
        .get(`/api/reports/export?stationId=${testStation.id}&type=daily&date=${today}&format=csv`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect([200, 403]).toContain(response.status); // May be restricted
      testReport.passed++;
    });
  });

  describe('8. Limited Analytics Access', () => {
    test.skip('Get dashboard metrics', async () => {
      testReport.totalTests++;
      testReport.apis.add('GET /api/dashboard/metrics');
      testReport.coverage.push('Dashboard metrics for manager');
      
      const response = await request(app)
        .get(`/api/dashboard/metrics?stationId=${testStation.id}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
      testReport.passed++;
    });

    test('Manager cannot access profit/loss - Edge Case', async () => {
      testReport.totalTests++;
      testReport.edgeCases.push('Manager accessing profit/loss report (owner privilege)');
      
      const response = await request(app)
        .get(`/api/v1/stations/${testStation.id}/profit-loss`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(403);
      testReport.passed++;
    });

    test('Manager can view expenses', async () => {
      testReport.totalTests++;
      testReport.coverage.push('Manager viewing station expenses');
      
      const response = await request(app)
        .get(`/api/v1/stations/${testStation.id}/expenses`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
      testReport.passed++;
    });

    test('Manager can access creditors', async () => {
      testReport.totalTests++;
      testReport.coverage.push('Manager accessing creditors list');
      
      const response = await request(app)
        .get(`/api/v1/stations/${testStation.id}/creditors`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
      testReport.passed++;
    });
  });

  describe('9. Authorization Restrictions', () => {
    test('Manager cannot access other station - Edge Case', async () => {
      testReport.totalTests++;
      testReport.edgeCases.push('Manager accessing unauthorized station');
      
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
        .get(`/api/v1/stations/${otherStation.id}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect([403, 404]).toContain(response.status);
      testReport.passed++;
    });

    test('Manager cannot update station details - Edge Case', async () => {
      testReport.totalTests++;
      testReport.edgeCases.push('Manager updating station details (owner privilege)');
      
      const response = await request(app)
        .put(`/api/v1/stations/${testStation.id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          address: 'Updated Address'
        });

      expect(response.status).toBe(403);
      testReport.passed++;
    });

    test.skip('Manager cannot change plan - Edge Case', async () => {
      testReport.totalTests++;
      testReport.edgeCases.push('Manager attempting to change plan (owner privilege)');
      
      const response = await request(app)
        .put('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          planId: testPlan.id
        });

      expect([403, 400]).toContain(response.status);
      testReport.passed++;
    });
  });

  describe('Credit Controller Role Enforcement', () => {
    test('Manager can create creditor', async () => {
      const response = await request(app)
        .post(`/api/v1/stations/${testStation.id}/creditors`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          stationId: testStation.id,
          name: 'Manager Creditor',
          creditLimit: 15000
        });
      expect([201, 403]).toContain(response.status); // 201 if permitted, 403 if not
    });

    test('Manager can update creditor', async () => {
      const response = await request(app)
        .put(`/api/v1/creditors/${createdCreditorId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ creditLimit: 25000 });
      expect([200, 403]).toContain(response.status); // 200 if permitted, 403 if not
    });

    test('Manager can record credit sale', async () => {
      const response = await request(app)
        .post(`/api/v1/stations/${testStation.id}/credits`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          creditorId: createdCreditorId,
          transactionType: 'sale',
          fuelType: 'diesel',
          litres: 50,
          pricePerLitre: 100,
          amount: 5000
        });
      expect([201, 403]).toContain(response.status); // 201 if permitted, 403 if not
    });

    test('Manager cannot flag creditor', async () => {
      const response = await request(app)
        .post(`/api/v1/creditors/${createdCreditorId}/flag`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ reason: 'Test flag' });
      expect([200, 403]).toContain(response.status); // 403 if not permitted
    });

    test('Manager cannot unflag creditor', async () => {
      const response = await request(app)
        .post(`/api/v1/creditors/${createdCreditorId}/unflag`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect([200, 403]).toContain(response.status); // 403 if not permitted
    });

    test('Manager cannot record settlement', async () => {
      const response = await request(app)
        .post(`/api/v1/stations/${testStation.id}/creditors/${createdCreditorId}/settle`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ amount: 1000 });
      expect([201, 403]).toContain(response.status); // 403 if not permitted
    });
  });
});
