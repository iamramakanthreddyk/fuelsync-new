/**
 * Cash Handover Model Unit Tests
 * 
 * Tests individual methods:
 * - confirm() with variance detection
 * - validateSequence() prevents skipping stages
 * - createFromShift() auto-creates with correct values
 */

const { sequelize, CashHandover, User, Station, Shift } = require('../../src/models');

describe('CashHandover Model Unit Tests', () => {
  let testStation, testEmployee, testManager, testOwner, testShift;

  beforeAll(async () => {
    // Sync database
    await sequelize.sync({ force: true });

    // Create test data
    testEmployee = await User.create({
      email: 'emp@test.com',
      password: 'pass123',
      name: 'Employee',
      role: 'employee',
    });

    testManager = await User.create({
      email: 'mgr@test.com',
      password: 'pass123',
      name: 'Manager',
      role: 'manager',
    });

    testOwner = await User.create({
      email: 'own@test.com',
      password: 'pass123',
      name: 'Owner',
      role: 'owner',
    });

    testStation = await Station.create({
      name: 'Test Station',
      location: 'Test Location',
      managerId: testManager.id,
      ownerId: testOwner.id,
    });

    testShift = await Shift.create({
      stationId: testStation.id,
      employeeId: testEmployee.id,
      shiftDate: new Date(),
      shiftType: 'full_day',
      startTime: '08:00',
      status: 'active',
      expectedCash: 5000,
    });
  });

  describe('confirm() - Variance Detection', () => {
    let handover;

    beforeEach(async () => {
      handover = await CashHandover.create({
        stationId: testStation.id,
        handoverType: 'shift_collection',
        fromUserId: testEmployee.id,
        toUserId: testManager.id,
        expectedAmount: 5000,
        handoverDate: new Date(),
      });
    });

    it('should confirm with exact amount match', async () => {
      const result = await handover.confirm(5000, testManager.id, 'Exact match');

      expect(result.status).toBe('confirmed');
      expect(result.actualAmount).toBe(5000);
      expect(result.difference).toBe(0);
    });

    it('should confirm with ±0.5% variance (within tolerance)', async () => {
      const result = await handover.confirm(5025, testManager.id, 'Minor variance');

      expect(result.status).toBe('confirmed');
      expect(result.actualAmount).toBe(5025);
      expect(Math.abs(result.difference)).toBe(25);
    });

    it('should dispute if variance > 2%', async () => {
      const result = await handover.confirm(4875, testManager.id, '>2% variance');

      expect(result.status).toBe('disputed');
      expect(Math.abs(result.difference)).toBe(125);
      expect(result.disputeNotes).toBeTruthy();
    });

    it('should dispute if difference > ₹100', async () => {
      const result = await handover.confirm(4800, testManager.id, '>₹100 difference');

      expect(result.status).toBe('disputed');
      expect(Math.abs(result.difference)).toBeGreaterThan(100);
    });

    it('should set confirmedBy and confirmedAt', async () => {
      const result = await handover.confirm(5000, testManager.id, 'Confirmation');

      expect(result.confirmedBy).toBe(testManager.id);
      expect(result.confirmedAt).toBeTruthy();
      expect(result.confirmedAt).toBeInstanceOf(Date);
    });
  });

  describe('validateSequence() - Stage Validation', () => {
    it('should allow creating shift_collection (first stage)', async () => {
      expect(
        await CashHandover.validateSequence(
          'shift_collection',
          testEmployee.id,
          testStation.id
        )
      ).toBeUndefined(); // No error
    });

    it('should reject employee_to_manager if no confirmed shift_collection', async () => {
      // Create but don't confirm shift_collection
      await CashHandover.create({
        stationId: testStation.id,
        handoverType: 'shift_collection',
        fromUserId: testEmployee.id,
        toUserId: testManager.id,
        expectedAmount: 1000,
        handoverDate: new Date(),
        status: 'pending', // Not confirmed
      });

      expect(async () => {
        await CashHandover.validateSequence(
          'employee_to_manager',
          testEmployee.id,
          testStation.id
        );
      }).rejects.toThrow();
    });

    it('should allow employee_to_manager if shift_collection is confirmed', async () => {
      // Create and confirm shift_collection
      const shiftColl = await CashHandover.create({
        stationId: testStation.id,
        handoverType: 'shift_collection',
        fromUserId: testEmployee.id,
        toUserId: testManager.id,
        expectedAmount: 2000,
        handoverDate: new Date(),
        status: 'confirmed',
        confirmedAt: new Date(),
      });

      expect(
        await CashHandover.validateSequence(
          'employee_to_manager',
          testEmployee.id,
          testStation.id
        )
      ).toBeUndefined(); // No error
    });

    it('should reject manager_to_owner if employee_to_manager not confirmed', async () => {
      expect(async () => {
        await CashHandover.validateSequence(
          'manager_to_owner',
          testManager.id,
          testStation.id
        );
      }).rejects.toThrow();
    });

    it('should allow deposit_to_bank only if manager_to_owner confirmed', async () => {
      // Create and confirm the full chain
      const em = await CashHandover.create({
        stationId: testStation.id,
        handoverType: 'employee_to_manager',
        fromUserId: testEmployee.id,
        toUserId: testManager.id,
        expectedAmount: 3000,
        status: 'confirmed',
        confirmedAt: new Date(),
        handoverDate: new Date(),
      });

      const mo = await CashHandover.create({
        stationId: testStation.id,
        handoverType: 'manager_to_owner',
        fromUserId: testManager.id,
        toUserId: testOwner.id,
        expectedAmount: 3000,
        status: 'confirmed',
        confirmedAt: new Date(),
        handoverDate: new Date(),
        previousHandoverId: em.id,
      });

      expect(
        await CashHandover.validateSequence(
          'deposit_to_bank',
          testOwner.id,
          testStation.id
        )
      ).toBeUndefined(); // No error
    });
  });

  describe('createFromShift() - Auto Creation', () => {
    it('should create with correct fields from shift', async () => {
      const result = await CashHandover.createFromShift(testShift);

      expect(result.stationId).toBe(testStation.id);
      expect(result.handoverType).toBe('shift_collection');
      expect(result.fromUserId).toBe(testEmployee.id);
      expect(result.toUserId).toBe(testManager.id); // Manager auto-assigned
      expect(result.expectedAmount).toBe(testShift.expectedCash);
      expect(result.status).toBe('pending');
      expect(result.handoverDate).toBeTruthy();
    });

    it('should handle null station manager gracefully', async () => {
      // Create station without manager
      const stationNoMgr = await Station.create({
        name: 'No Manager Station',
        location: 'Location',
      });

      const shift = await Shift.create({
        stationId: stationNoMgr.id,
        employeeId: testEmployee.id,
        shiftDate: new Date(),
        shiftType: 'full_day',
        startTime: '08:00',
        status: 'active',
        expectedCash: 2000,
      });

      const result = await CashHandover.createFromShift(shift);

      expect(result.stationId).toBe(stationNoMgr.id);
      expect(result.handoverType).toBe('shift_collection');
      // toUserId might be null or handled specially - depends on implementation
    });

    it('should calculate expectedAmount from shift.expectedCash', async () => {
      const shift2 = await Shift.create({
        stationId: testStation.id,
        employeeId: testEmployee.id,
        shiftDate: new Date(),
        shiftType: 'morning',
        startTime: '06:00',
        expectedCash: 7500,
        status: 'active',
      });

      const result = await CashHandover.createFromShift(shift2);

      expect(result.expectedAmount).toBe(7500);
    });
  });

  describe('Handover Chain Linking', () => {
    it('should link handovers via previousHandoverId', async () => {
      // Create chain
      const h1 = await CashHandover.create({
        stationId: testStation.id,
        handoverType: 'shift_collection',
        expectedAmount: 1500,
        status: 'confirmed',
        handoverDate: new Date(),
      });

      const h2 = await CashHandover.create({
        stationId: testStation.id,
        handoverType: 'employee_to_manager',
        expectedAmount: 1500,
        previousHandoverId: h1.id,
        handoverDate: new Date(),
      });

      expect(h2.previousHandoverId).toBe(h1.id);

      // Retrieve and verify link
      const retrieved = await CashHandover.findByPk(h2.id);
      expect(retrieved.previousHandoverId).toBe(h1.id);
    });

    it('should retrieve full chain with include', async () => {
      const h1 = await CashHandover.create({
        stationId: testStation.id,
        handoverType: 'shift_collection',
        expectedAmount: 2000,
        handoverDate: new Date(),
      });

      const h2 = await CashHandover.create({
        stationId: testStation.id,
        handoverType: 'employee_to_manager',
        expectedAmount: 2000,
        previousHandoverId: h1.id,
        handoverDate: new Date(),
      });

      // Query with previous included
      const result = await CashHandover.findByPk(h2.id, {
        include: [{ association: 'previousHandover' }],
      });

      expect(result.previousHandover).toBeTruthy();
      expect(result.previousHandover.id).toBe(h1.id);
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });
});
