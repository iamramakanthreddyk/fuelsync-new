/**
 * FuelSync API Integration Tests
 * 
 * Comprehensive test suite that tests all APIs in sequence.
 * Uses Jest + Supertest for API testing.
 * 
 * Run: npm test
 */

const request = require('supertest');
const path = require('path');
const fs = require('fs');

// Setup test database path
const TEST_DB_PATH = path.join(__dirname, '..', 'data', 'test.db');

// Clean up test database before tests
beforeAll(async () => {
  // Remove test database if exists
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
  
  // Ensure data directory exists
  const dataDir = path.dirname(TEST_DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  // Set environment for test
  process.env.DATABASE_PATH = TEST_DB_PATH;
  process.env.DB_DIALECT = 'sqlite';
  process.env.JWT_SECRET = 'test-jwt-secret';
  
  // Initialize database
  const { syncDatabase, seedDefaultData } = require('../src/models');
  await syncDatabase({ force: true });
  await seedDefaultData();
});

// Get app after models are initialized
let app;
beforeAll(() => {
  app = require('../src/app');
});

// Clean up after all tests
afterAll(async () => {
  const sequelize = require('../src/models').sequelize;
  await sequelize.close();
  
  // Remove test database
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
});

// Test state - stores IDs and tokens across tests
const state = {
  adminToken: null,
  ownerToken: null,
  managerToken: null,
  employeeToken: null,
  ownerId: null,
  managerId: null,
  employeeId: null,
  stationId: null,
  pumpId: null,
  nozzleId: null,
  dieselNozzleId: null,
  creditorId: null,
  readingId: null,
  expenseId: null,
  ownerEmail: null,
  managerEmail: null,
  employeeEmail: null,
};

// ============================================
// AUTHENTICATION TESTS
// ============================================

describe('Authentication', () => {
  test('Login as super admin', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@fuelsync.com',
        password: 'admin123'
      });
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.role).toBe('super_admin');
    
    state.adminToken = res.body.data.token;
  });

  test('Get current user (me)', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${state.adminToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('admin@fuelsync.com');
  });

  test('Login with invalid credentials fails', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@fuelsync.com',
        password: 'wrongpassword'
      });
    
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('Access protected route without token fails', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me');
    
    expect(res.status).toBe(401);
  });
});

// ============================================
// USER MANAGEMENT TESTS
// ============================================

describe('User Management', () => {
  test('Create owner user', async () => {
    state.ownerEmail = `owner_${Date.now()}@test.com`;
    
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${state.adminToken}`)
      .send({
        email: state.ownerEmail,
        password: 'owner123',
        name: 'Test Owner',
        role: 'owner'
      });
    
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.role).toBe('owner');
    
    state.ownerId = res.body.data.id;
  });

  test('Login as owner', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: state.ownerEmail,
        password: 'owner123'
      });
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    
    state.ownerToken = res.body.data.token;
  });

  test('Get users list (as admin)', async () => {
    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${state.adminToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ============================================
// STATION TESTS
// ============================================

describe('Stations', () => {
  test('Create station (as owner)', async () => {
    const res = await request(app)
      .post('/api/v1/stations')
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .send({
        name: `Test Station ${Date.now()}`,
        address: '123 Test Road, Mumbai',
        phone: '9876543210'
      });
    
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    
    state.stationId = res.body.data.id;
  });

  test('Get stations list', async () => {
    const res = await request(app)
      .get('/api/v1/stations')
      .set('Authorization', `Bearer ${state.ownerToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  test('Get single station', async () => {
    const res = await request(app)
      .get(`/api/v1/stations/${state.stationId}`)
      .set('Authorization', `Bearer ${state.ownerToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(state.stationId);
  });

  test('Update station', async () => {
    const res = await request(app)
      .put(`/api/v1/stations/${state.stationId}`)
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .send({
        name: 'Updated Station Name'
      });
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ============================================
// PUMP TESTS
// ============================================

describe('Pumps', () => {
  test('Create pump', async () => {
    const res = await request(app)
      .post(`/api/v1/stations/${state.stationId}/pumps`)
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .send({
        pumpNumber: 1,
        name: 'Pump 1'
      });
    
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    
    state.pumpId = res.body.data.id;
  });

  test('Get pumps list', async () => {
    const res = await request(app)
      .get(`/api/v1/stations/${state.stationId}/pumps`)
      .set('Authorization', `Bearer ${state.ownerToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('Update pump', async () => {
    const res = await request(app)
      .put(`/api/v1/stations/pumps/${state.pumpId}`)
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .send({
        name: 'Updated Pump Name'
      });
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ============================================
// NOZZLE TESTS
// ============================================

describe('Nozzles', () => {
  test('Create petrol nozzle', async () => {
    const res = await request(app)
      .post(`/api/v1/stations/pumps/${state.pumpId}/nozzles`)
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .send({
        nozzleNumber: 1,
        fuelType: 'petrol',
        initialReading: 1000
      });
    
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    
    state.nozzleId = res.body.data.id;
  });

  test('Get nozzles list', async () => {
    const res = await request(app)
      .get(`/api/v1/stations/pumps/${state.pumpId}/nozzles`)
      .set('Authorization', `Bearer ${state.ownerToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('Create diesel nozzle', async () => {
    const res = await request(app)
      .post(`/api/v1/stations/pumps/${state.pumpId}/nozzles`)
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .send({
        nozzleNumber: 2,
        fuelType: 'diesel',
        initialReading: 2000
      });
    
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    
    state.dieselNozzleId = res.body.data.id;
  });
});

// ============================================
// FUEL PRICE TESTS
// ============================================

describe('Fuel Prices', () => {
  test('Set petrol price', async () => {
    const res = await request(app)
      .post(`/api/v1/stations/${state.stationId}/prices`)
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .send({
        fuelType: 'petrol',
        price: 95.50
      });
    
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  test('Set diesel price', async () => {
    const res = await request(app)
      .post(`/api/v1/stations/${state.stationId}/prices`)
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .send({
        fuelType: 'diesel',
        price: 87.25
      });
    
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  test('Get fuel prices', async () => {
    const res = await request(app)
      .get(`/api/v1/stations/${state.stationId}/prices`)
      .set('Authorization', `Bearer ${state.ownerToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.current).toBeDefined();
  });
});

// ============================================
// STAFF MANAGEMENT TESTS
// ============================================

describe('Staff Management', () => {
  test('Create manager for station', async () => {
    state.managerEmail = `manager_${Date.now()}@test.com`;
    
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .send({
        email: state.managerEmail,
        password: 'manager123',
        name: 'Test Manager',
        role: 'manager',
        stationId: state.stationId
      });
    
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    
    state.managerId = res.body.data.id;
  });

  test('Login as manager', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: state.managerEmail,
        password: 'manager123'
      });
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    
    state.managerToken = res.body.data.token;
  });

  test('Create employee for station', async () => {
    state.employeeEmail = `employee_${Date.now()}@test.com`;
    
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${state.managerToken}`)
      .send({
        email: state.employeeEmail,
        password: 'employee123',
        name: 'Test Employee',
        role: 'employee',
        stationId: state.stationId
      });
    
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    
    state.employeeId = res.body.data.id;
  });

  test('Login as employee', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: state.employeeEmail,
        password: 'employee123'
      });
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    
    state.employeeToken = res.body.data.token;
  });

  test('Get station staff', async () => {
    const res = await request(app)
      .get(`/api/v1/stations/${state.stationId}/staff`)
      .set('Authorization', `Bearer ${state.ownerToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ============================================
// NOZZLE READING TESTS
// ============================================

describe('Nozzle Readings', () => {
  test('Get previous reading for nozzle', async () => {
    const res = await request(app)
      .get(`/api/v1/readings/previous/${state.nozzleId}`)
      .set('Authorization', `Bearer ${state.employeeToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.previousReading).toBe(1000);
  });

  test('Submit first reading (initial reading creates baseline)', async () => {
    const today = new Date().toISOString().split('T')[0];
    
    // First reading is initial reading (litresSold will be 0)
    const res = await request(app)
      .post('/api/v1/readings')
      .set('Authorization', `Bearer ${state.employeeToken}`)
      .send({
        nozzleId: state.nozzleId,
        readingDate: today,
        readingValue: 1000  // Same as initial reading
      });
    
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isInitialReading).toBe(true);
    
    state.readingId = res.body.data.id;
  });

  test('Submit actual reading (calculates litres sold)', async () => {
    const today = new Date().toISOString().split('T')[0];
    
    const res = await request(app)
      .post('/api/v1/readings')
      .set('Authorization', `Bearer ${state.employeeToken}`)
      .send({
        nozzleId: state.nozzleId,
        readingDate: today,
        readingValue: 1050,
        cashAmount: 4000,
        onlineAmount: 775
      });
    
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.litresSold).toBe(50);
    expect(res.body.data.isInitialReading).toBe(false);
  });

  test('Get daily readings', async () => {
    const today = new Date().toISOString().split('T')[0];
    
    const res = await request(app)
      .get(`/api/v1/readings?startDate=${today}&endDate=${today}&stationId=${state.stationId}`)
      .set('Authorization', `Bearer ${state.managerToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('Submit another reading', async () => {
    const today = new Date().toISOString().split('T')[0];
    
    const res = await request(app)
      .post('/api/v1/readings')
      .set('Authorization', `Bearer ${state.employeeToken}`)
      .send({
        nozzleId: state.nozzleId,
        readingDate: today,
        readingValue: 1100,
        cashAmount: 3000,
        onlineAmount: 1775
      });
    
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  test('Reading cannot be less than previous', async () => {
    const today = new Date().toISOString().split('T')[0];
    
    const res = await request(app)
      .post('/api/v1/readings')
      .set('Authorization', `Bearer ${state.employeeToken}`)
      .send({
        nozzleId: state.nozzleId,
        readingDate: today,
        readingValue: 1000, // Less than current (1100)
        cashAmount: 0
      });
    
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ============================================
// CREDITOR TESTS
// ============================================

describe('Credit Management', () => {
  test('Create creditor', async () => {
    const res = await request(app)
      .post(`/api/v1/stations/${state.stationId}/creditors`)
      .set('Authorization', `Bearer ${state.managerToken}`)
      .send({
        name: 'ABC Transport',
        contactPerson: 'John Doe',
        phone: '9876543210',
        creditLimit: 50000
      });
    
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    
    state.creditorId = res.body.data.id;
  });

  test('Get creditors list', async () => {
    const res = await request(app)
      .get(`/api/v1/stations/${state.stationId}/creditors`)
      .set('Authorization', `Bearer ${state.managerToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('Add credit sale', async () => {
    const today = new Date().toISOString().split('T')[0];
    
    const res = await request(app)
      .post(`/api/v1/stations/${state.stationId}/credits`)
      .set('Authorization', `Bearer ${state.managerToken}`)
      .send({
        creditorId: state.creditorId,
        fuelType: 'diesel',
        litres: 100,
        pricePerLitre: 87.25,
        amount: 8725,
        transactionDate: today,
        vehicleNumber: 'MH12AB1234'
      });
    
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  test('Get creditor details with balance', async () => {
    // Note: Route is /creditors/:id not /stations/:stationId/creditors/:id
    const res = await request(app)
      .get(`/api/v1/creditors/${state.creditorId}`)
      .set('Authorization', `Bearer ${state.managerToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.currentBalance).toBeGreaterThan(0);
  });

  test('Settle credit (as owner)', async () => {
    const today = new Date().toISOString().split('T')[0];
    
    // Note: Only owner/super_admin can settle
    const res = await request(app)
      .post(`/api/v1/stations/${state.stationId}/creditors/${state.creditorId}/settle`)
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .send({
        amount: 5000,
        transactionDate: today,
        referenceNumber: 'CHQ123456'
      });
    
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });
});

// ============================================
// EXPENSE TESTS
// ============================================

describe('Expenses', () => {
  test('Add expense', async () => {
    const today = new Date().toISOString().split('T')[0];
    
    const res = await request(app)
      .post(`/api/v1/stations/${state.stationId}/expenses`)
      .set('Authorization', `Bearer ${state.managerToken}`)
      .send({
        category: 'salary',
        description: 'Staff salary - November',
        amount: 25000,
        expenseDate: today,
        paymentMethod: 'bank_transfer'
      });
    
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    
    state.expenseId = res.body.data.id;
  });

  test('Get expenses list', async () => {
    const res = await request(app)
      .get(`/api/v1/stations/${state.stationId}/expenses`)
      .set('Authorization', `Bearer ${state.managerToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('Add cost of goods (as owner)', async () => {
    const month = new Date().toISOString().slice(0, 7);
    
    // Note: Only owner/super_admin can add cost of goods
    const res = await request(app)
      .post(`/api/v1/stations/${state.stationId}/cost-of-goods`)
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .send({
        month: month,
        fuelType: 'petrol',
        litresPurchased: 5000,
        totalCost: 450000,
        supplierName: 'Indian Oil'
      });
    
    // API returns 200 for create/update (upsert behavior)
    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
  });
});

// ============================================
// DASHBOARD TESTS
// ============================================

describe('Dashboard', () => {
  test('Get dashboard summary', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${state.ownerToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('Get daily summary', async () => {
    const today = new Date().toISOString().split('T')[0];
    
    // Requires startDate and endDate
    const res = await request(app)
      .get(`/api/v1/dashboard/daily?startDate=${today}&endDate=${today}`)
      .set('Authorization', `Bearer ${state.ownerToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('Get fuel breakdown', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/fuel-breakdown')
      .set('Authorization', `Bearer ${state.ownerToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('Get pump performance', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/pump-performance')
      .set('Authorization', `Bearer ${state.ownerToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ============================================
// ACCESS CONTROL TESTS
// ============================================

describe('Access Control', () => {
  test('Employee cannot create station', async () => {
    const res = await request(app)
      .post('/api/v1/stations')
      .set('Authorization', `Bearer ${state.employeeToken}`)
      .send({
        name: 'Unauthorized Station',
        address: 'Test'
      });
    
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('Employee cannot create users', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${state.employeeToken}`)
      .send({
        email: 'test@test.com',
        password: 'test123',
        name: 'Test',
        role: 'employee'
      });
    
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('Manager cannot create owner', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${state.managerToken}`)
      .send({
        email: 'owner2@test.com',
        password: 'test123',
        name: 'Test Owner',
        role: 'owner'
      });
    
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('Cannot access other owner station', async () => {
    // Create another owner with their own station
    const createOwnerRes = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${state.adminToken}`)
      .send({
        email: `owner2_${Date.now()}@test.com`,
        password: 'owner123',
        name: 'Owner 2',
        role: 'owner'
      });
    
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: createOwnerRes.body.data.email,
        password: 'owner123'
      });
    
    // Try to access first owner's station
    const res = await request(app)
      .get(`/api/v1/stations/${state.stationId}`)
      .set('Authorization', `Bearer ${loginRes.body.data.token}`);
    
    // Should return 404 or 403
    expect([403, 404]).toContain(res.status);
  });
});
