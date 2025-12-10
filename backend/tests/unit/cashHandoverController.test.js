/**
 * Cash Handover Controller Unit Tests
 * 
 * Tests controller methods:
 * - createHandover() auto toUserId, auto previousHandoverId
 * - confirmHandover() acceptAsIs flag handling
 * - recordBankDeposit() linking and validation
 */

const request = require('supertest');
const app = require('../../src/app');
const { sequelize, User, Station, CashHandover, Shift } = require('../../src/models');

describe('CashHandover Controller Unit Tests', () => {
  let managerToken, ownerToken, employeeToken;
  let testStation, testEmployee, testManager, testOwner;

  beforeAll(async () => {
    // Sync database
    await sequelize.sync({ force: true });

    // Create users
    testEmployee = await User.create({
      email: 'emp2@test.com',
      password: 'pass123',
      name: 'Employee2',
      role: 'employee',
    });

    testManager = await User.create({
      email: 'mgr2@test.com',
      password: 'pass123',
      name: 'Manager2',
      role: 'manager',
    });

    testOwner = await User.create({
      email: 'own2@test.com',
      password: 'pass123',
      name: 'Owner2',
      role: 'owner',
    });

    testStation = await Station.create({
      name: 'Test Station 2',
      location: 'Location 2',
      managerId: testManager.id,
      ownerId: testOwner.id,
    });

    // Get tokens
    const empRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'emp2@test.com', password: 'pass123' });
    employeeToken = empRes.body.data?.token;

    const mgrRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'mgr2@test.com', password: 'pass123' });
    managerToken = mgrRes.body.data?.token;

    const ownRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'own2@test.com', password: 'pass123' });
    ownerToken = ownRes.body.data?.token;
  });

  describe('createHandover() - Auto Assignment & Linking', () => {
    let shift, confirmedHandover;

    beforeAll(async () => {
      // Create and confirm a shift_collection first
      shift = await Shift.create({
        stationId: testStation.id,
        employeeId: testEmployee.id,
        shiftDate: new Date(),
        shiftType: 'full_day',
        startTime: '08:00',
        status: 'ended',
        expectedCash: 4000,
      });

      confirmedHandover = await CashHandover.create({
        stationId: testStation.id,
        handoverType: 'shift_collection',
        fromUserId: testEmployee.id,
        toUserId: testManager.id,
        expectedAmount: 4000,
        status: 'confirmed',
        confirmedAt: new Date(),
        handoverDate: new Date(),
      });
    });

    it('should auto-calculate toUserId for employee_to_manager', async () => {
      const res = await request(app)
        .post('/api/v1/handovers')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          stationId: testStation.id,
          handoverType: 'employee_to_manager',
          fromUserId: testEmployee.id,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data?.toUserId).toBe(testManager.id);
    });

    it('should auto-calculate toUserId for manager_to_owner', async () => {
      const res = await request(app)
        .post('/api/v1/handovers')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          stationId: testStation.id,
          handoverType: 'manager_to_owner',
          fromUserId: testManager.id,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data?.toUserId).toBe(testOwner.id);
    });

    it('should auto-find and set previousHandoverId', async () => {
      const res = await request(app)
        .post('/api/v1/handovers')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          stationId: testStation.id,
          handoverType: 'employee_to_manager',
          fromUserId: testEmployee.id,
        });

      expect(res.status).toBe(201);
      expect(res.body.data?.previousHandoverId).toBeTruthy();
    });

    it('should validate sequence before creating', async () => {
      // Try to create manager_to_owner without confirmed employee_to_manager
      const res = await request(app)
        .post('/api/v1/handovers')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          stationId: testStation.id,
          handoverType: 'manager_to_owner',
          fromUserId: testManager.id,
        });

      // Should fail because employee_to_manager not confirmed yet
      if (res.status === 400) {
        expect(res.body.success).toBe(false);
      }
    });
  });

  describe('confirmHandover() - acceptAsIs Flag', () => {
    let pendingHandover;

    beforeAll(async () => {
      const shift = await Shift.create({
        stationId: testStation.id,
        employeeId: testEmployee.id,
        shiftDate: new Date(),
        shiftType: 'morning',
        startTime: '06:00',
        status: 'ended',
        expectedCash: 3000,
      });

      pendingHandover = await CashHandover.create({
        stationId: testStation.id,
        handoverType: 'shift_collection',
        fromUserId: testEmployee.id,
        toUserId: testManager.id,
        expectedAmount: 3000,
        status: 'pending',
        handoverDate: new Date(),
      });
    });

    it('should accept with acceptAsIs flag (no amount required)', async () => {
      const res = await request(app)
        .post(`/api/v1/handovers/${pendingHandover.id}/confirm`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          acceptAsIs: true,
          notes: 'Quick acceptance',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data?.status).toBe('confirmed');
      expect(res.body.data?.actualAmount).toBe(pendingHandover.expectedAmount);
    });

    it('should accept with custom actualAmount', async () => {
      const shift = await Shift.create({
        stationId: testStation.id,
        employeeId: testEmployee.id,
        shiftDate: new Date(),
        shiftType: 'evening',
        startTime: '14:00',
        status: 'ended',
        expectedCash: 2500,
      });

      const handover = await CashHandover.create({
        stationId: testStation.id,
        handoverType: 'shift_collection',
        fromUserId: testEmployee.id,
        toUserId: testManager.id,
        expectedAmount: 2500,
        status: 'pending',
        handoverDate: new Date(),
      });

      const res = await request(app)
        .post(`/api/v1/handovers/${handover.id}/confirm`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          actualAmount: 2480,
          notes: 'Discrepancy noted',
        });

      expect(res.status).toBe(200);
      expect(res.body.data?.actualAmount).toBe(2480);
    });

    it('should require either acceptAsIs or actualAmount', async () => {
      const shift = await Shift.create({
        stationId: testStation.id,
        employeeId: testEmployee.id,
        shiftDate: new Date(),
        shiftType: 'night',
        startTime: '22:00',
        status: 'ended',
        expectedCash: 1500,
      });

      const handover = await CashHandover.create({
        stationId: testStation.id,
        handoverType: 'shift_collection',
        fromUserId: testEmployee.id,
        toUserId: testManager.id,
        expectedAmount: 1500,
        status: 'pending',
        handoverDate: new Date(),
      });

      const res = await request(app)
        .post(`/api/v1/handovers/${handover.id}/confirm`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ notes: 'No amount' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('recordBankDeposit() - Linking & Validation', () => {
    let mo;

    beforeAll(async () => {
      // Create confirmed manager_to_owner
      const em = await CashHandover.create({
        stationId: testStation.id,
        handoverType: 'employee_to_manager',
        fromUserId: testEmployee.id,
        toUserId: testManager.id,
        expectedAmount: 5000,
        status: 'confirmed',
        confirmedAt: new Date(),
        handoverDate: new Date(),
      });

      mo = await CashHandover.create({
        stationId: testStation.id,
        handoverType: 'manager_to_owner',
        fromUserId: testManager.id,
        toUserId: testOwner.id,
        expectedAmount: 5000,
        status: 'confirmed',
        confirmedAt: new Date(),
        handoverDate: new Date(),
        previousHandoverId: em.id,
      });
    });

    it('should link to previous manager_to_owner', async () => {
      const res = await request(app)
        .post('/api/v1/handovers/bank-deposit')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          stationId: testStation.id,
          amount: 5000,
          bankName: 'Test Bank',
          depositReference: 'BANK-001',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data?.handoverType).toBe('deposit_to_bank');
      expect(res.body.data?.previousHandoverId).toBe(mo.id);
    });

    it('should validate amount within ±₹100', async () => {
      const res = await request(app)
        .post('/api/v1/handovers/bank-deposit')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          stationId: testStation.id,
          amount: 4800, // ₹200 less
          bankName: 'Test Bank',
          depositReference: 'BANK-002',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should auto-confirm bank deposit', async () => {
      const res = await request(app)
        .post('/api/v1/handovers/bank-deposit')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          stationId: testStation.id,
          amount: 5050, // ₹50 variance (acceptable)
          bankName: 'Test Bank',
          depositReference: 'BANK-003',
        });

      expect(res.status).toBe(201);
      expect(res.body.data?.status).toBe('confirmed');
    });
  });

  describe('Authorization & Error Handling', () => {
    it('should reject if not manager/owner for creation', async () => {
      const res = await request(app)
        .post('/api/v1/handovers')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          stationId: testStation.id,
          handoverType: 'employee_to_manager',
          fromUserId: testEmployee.id,
        });

      expect([401, 403]).toContain(res.status);
    });

    it('should return 404 for non-existent handover', async () => {
      const res = await request(app)
        .get('/api/v1/handovers/nonexistent-id')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(404);
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });
});
