/**
 * Cash Handover Integration Tests
 * 
 * Tests the complete cash handover workflow:
 * - Shift ends → handover created
 * - Manager confirms → shift_collection confirmed
 * - Create employee_to_manager → validated and linked
 * - Manager confirms → employee_to_manager confirmed
 * - Create manager_to_owner → validated and linked
 * - Owner confirms → manager_to_owner confirmed
 * - Record bank deposit → linked and validated
 */

const request = require('supertest');
const app = require('../../src/app');
const { sequelize, User, Station, CashHandover, Shift } = require('../../src/models');

// Test data
let testStationId = '';
let testEmployeeId = '';
let testManagerId = '';
let testOwnerId = '';
let testShiftId = '';

// Store handover IDs for chain testing
const handoverIds = {
  shiftCollection: '',
  employeeToManager: '',
  managerToOwner: '',
  depositToBank: '',
};

describe('Cash Handover Integration Tests', () => {
  let managerToken, ownerToken, employeeToken;

  beforeAll(async () => {
    // Sync database
    await sequelize.sync({ force: true });

    // Create test users
    const employee = await User.create({
      email: 'employee@test.com',
      password: 'password123',
      name: 'Test Employee',
      role: 'employee',
      isActive: true,
    });
    testEmployeeId = employee.id;

    const manager = await User.create({
      email: 'manager@test.com',
      password: 'password123',
      name: 'Test Manager',
      role: 'manager',
      isActive: true,
    });
    testManagerId = manager.id;

    const owner = await User.create({
      email: 'owner@test.com',
      password: 'password123',
      name: 'Test Owner',
      role: 'owner',
      isActive: true,
    });
    testOwnerId = owner.id;

    // Create test station
    const station = await Station.create({
      name: 'Test Station',
      location: 'Test Location',
      managerId: testManagerId,
      ownerId: testOwnerId,
    });
    testStationId = station.id;

    // Login and get tokens
    const employeeLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'employee@test.com', password: 'password123' });
    employeeToken = employeeLoginRes.body.data?.token;

    const managerLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'manager@test.com', password: 'password123' });
    managerToken = managerLoginRes.body.data?.token;

    const ownerLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'owner@test.com', password: 'password123' });
    ownerToken = ownerLoginRes.body.data?.token;
  });

  describe('1. Shift Ends → shift_collection Handover Created', () => {
    it('should create a shift', async () => {
      const res = await request(app)
        .post('/api/v1/shifts/start')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          employeeId: testEmployeeId,
          stationId: testStationId,
          shiftType: 'full_day',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      testShiftId = res.body.data?.id;
      expect(testShiftId).toBeTruthy();
    });

    it('should end shift and auto-create shift_collection handover', async () => {
      const res = await request(app)
        .post(`/api/v1/shifts/${testShiftId}/end`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          cashCollected: 1500,
          endNotes: 'Daily collection complete',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data?.status).toBe('ended');
      expect(res.body.data?.cashCollected).toBe(1500);
    });

    it('should have created shift_collection handover automatically', async () => {
      const res = await request(app)
        .get('/api/v1/handovers/pending')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const shiftCollectionHandover = res.body.data?.find(
        (h) => h.handoverType === 'shift_collection'
      );

      expect(shiftCollectionHandover).toBeTruthy();
      expect(shiftCollectionHandover?.fromUserId).toBe(testEmployeeId);
      expect(shiftCollectionHandover?.toUserId).toBeTruthy();
      expect(shiftCollectionHandover?.status).toBe('pending');
      expect(shiftCollectionHandover?.expectedAmount).toBeGreaterThan(0);

      handoverIds.shiftCollection = shiftCollectionHandover?.id;
    });
  });

  describe('2. Manager Confirms shift_collection', () => {
    it('should confirm with acceptAsIs flag (quick confirm)', async () => {
      const res = await request(app)
        .post(`/api/v1/handovers/${handoverIds.shiftCollection}/confirm`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          acceptAsIs: true,
          notes: 'Amount confirmed by manager',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data?.status).toBe('confirmed');
      expect(res.body.data?.actualAmount).toBeGreaterThan(0);
    });

    it('should reject if neither actualAmount nor acceptAsIs provided', async () => {
      // Create another shift for this test
      const shiftRes = await request(app)
        .post('/api/v1/shifts/start')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          employeeId: testEmployeeId,
          stationId: testStationId,
          shiftType: 'morning',
        });
      const shiftId2 = shiftRes.body.data?.id;

      await request(app)
        .post(`/api/v1/shifts/${shiftId2}/end`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ cashCollected: 500 });

      const pendingRes = await request(app)
        .get('/api/v1/handovers/pending')
        .set('Authorization', `Bearer ${managerToken}`);

      const newHandover = pendingRes.body.data?.find(
        (h) => h.id !== handoverIds.shiftCollection
      );

      const res = await request(app)
        .post(`/api/v1/handovers/${newHandover?.id}/confirm`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ notes: 'No amount' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('3. Create employee_to_manager → Auto Validation & Linking', () => {
    it('should fail if trying to skip sequence', async () => {
      const res = await request(app)
        .post('/api/v1/handovers')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          stationId: testStationId,
          handoverType: 'manager_to_owner',
          fromUserId: testManagerId,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should auto-set toUserId and previousHandoverId', async () => {
      const res = await request(app)
        .post('/api/v1/handovers')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          stationId: testStationId,
          handoverType: 'employee_to_manager',
          fromUserId: testEmployeeId,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data?.toUserId).toBeTruthy();
      expect(res.body.data?.previousHandoverId).toBe(handoverIds.shiftCollection);
      expect(res.body.data?.status).toBe('pending');

      handoverIds.employeeToManager = res.body.data?.id;
    });
  });

  describe('4. Manager Confirms employee_to_manager', () => {
    it('should confirm with custom amount', async () => {
      const getRes = await request(app)
        .get(`/api/v1/handovers/${handoverIds.employeeToManager}`)
        .set('Authorization', `Bearer ${managerToken}`);

      const expectedAmount = getRes.body.data?.expectedAmount || 0;

      const res = await request(app)
        .post(`/api/v1/handovers/${handoverIds.employeeToManager}/confirm`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          actualAmount: expectedAmount,
          notes: 'Amount confirmed',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data?.status).toBe('confirmed');
    });
  });

  describe('5. Create manager_to_owner → Auto Validation & Linking', () => {
    it('should auto-set owner as toUserId and link to previous', async () => {
      const res = await request(app)
        .post('/api/v1/handovers')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          stationId: testStationId,
          handoverType: 'manager_to_owner',
          fromUserId: testManagerId,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data?.toUserId).toBe(testOwnerId);
      expect(res.body.data?.previousHandoverId).toBe(handoverIds.employeeToManager);
      expect(res.body.data?.status).toBe('pending');

      handoverIds.managerToOwner = res.body.data?.id;
    });
  });

  describe('6. Owner Confirms manager_to_owner', () => {
    it('should accept as is quickly', async () => {
      const res = await request(app)
        .post(`/api/v1/handovers/${handoverIds.managerToOwner}/confirm`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ acceptAsIs: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data?.status).toBe('confirmed');
    });
  });

  describe('7. Record Bank Deposit → Final Stage', () => {
    it('should link to manager_to_owner and validate amount', async () => {
      const getRes = await request(app)
        .get(`/api/v1/handovers/${handoverIds.managerToOwner}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      const confirmedAmount = getRes.body.data?.expectedAmount || 0;

      const res = await request(app)
        .post('/api/v1/handovers/bank-deposit')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          stationId: testStationId,
          amount: confirmedAmount,
          bankName: 'Test Bank',
          depositReference: 'DEP-001-2024',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data?.handoverType).toBe('deposit_to_bank');
      expect(res.body.data?.previousHandoverId).toBe(handoverIds.managerToOwner);
      expect(res.body.data?.status).toBe('confirmed');

      handoverIds.depositToBank = res.body.data?.id;
    });

    it('should reject bank deposit if amount differs significantly', async () => {
      const getRes = await request(app)
        .get(`/api/v1/handovers/${handoverIds.managerToOwner}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      const confirmedAmount = getRes.body.data?.expectedAmount || 0;

      const res = await request(app)
        .post('/api/v1/handovers/bank-deposit')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          stationId: testStationId,
          amount: confirmedAmount + 500,
          bankName: 'Test Bank',
          depositReference: 'DEP-002-2024',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('8. Variance Detection Accuracy', () => {
    it('should NOT dispute if variance is within 2% and < ₹100', async () => {
      const shiftRes = await request(app)
        .post('/api/v1/shifts/start')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          employeeId: testEmployeeId,
          stationId: testStationId,
          shiftType: 'night',
        });
      const shiftId = shiftRes.body.data?.id;

      await request(app)
        .post(`/api/v1/shifts/${shiftId}/end`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ cashCollected: 10000 });

      const pendingRes = await request(app)
        .get('/api/v1/handovers/pending')
        .set('Authorization', `Bearer ${managerToken}`);

      const handover = pendingRes.body.data?.find(
        (h) => h.handoverType === 'shift_collection' && h.expectedAmount === 10000
      );

      const res = await request(app)
        .post(`/api/v1/handovers/${handover?.id}/confirm`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ actualAmount: 10050 });

      expect(res.status).toBe(200);
      expect(res.body.data?.status).toBe('confirmed');
    });

    it('should dispute if variance > 2%', async () => {
      const shiftRes = await request(app)
        .post('/api/v1/shifts/start')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          employeeId: testEmployeeId,
          stationId: testStationId,
          shiftType: 'evening',
        });
      const shiftId = shiftRes.body.data?.id;

      await request(app)
        .post(`/api/v1/shifts/${shiftId}/end`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ cashCollected: 1000 });

      const pendingRes = await request(app)
        .get('/api/v1/handovers/pending')
        .set('Authorization', `Bearer ${managerToken}`);

      const handover = pendingRes.body.data?.find(
        (h) => h.handoverType === 'shift_collection' && h.expectedAmount === 1000
      );

      const res = await request(app)
        .post(`/api/v1/handovers/${handover?.id}/confirm`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ actualAmount: 970 });

      expect(res.status).toBe(200);
      expect(res.body.data?.status).toBe('disputed');
    });
  });

  describe('9. Complete Handover Chain', () => {
    it('should have complete chain from shift to bank deposit', async () => {
      expect(handoverIds.shiftCollection).toBeTruthy();
      expect(handoverIds.employeeToManager).toBeTruthy();
      expect(handoverIds.managerToOwner).toBeTruthy();
      expect(handoverIds.depositToBank).toBeTruthy();
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });
});
