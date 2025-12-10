const request = require('supertest');
let app; // required after DB sync to ensure tables exist
const { sequelize, User, Station, Nozzle, Pump, Creditor, CreditTransaction } = require('../../src/models');

describe('Reading -> Credit Atomicity', () => {
  let station, owner, manager, pump, nozzle, creditor, managerToken;

  beforeAll(async () => {
    await sequelize.sync({ force: true });

    // require app after syncing DB so model tables are present
    app = require('../../src/app');

    // create owner and station and manager
    owner = await User.create({ email: 'owner@atomic.test', password: 'owner123', name: 'Owner Atomic', role: 'owner' });
    station = await Station.create({ ownerId: owner.id, name: 'Atomic Station' });
    await owner.update({ stationId: station.id });

    manager = await User.create({ email: 'manager@atomic.test', password: 'manager123', name: 'Manager Atomic', role: 'manager', stationId: station.id });

    pump = await Pump.create({ stationId: station.id, name: 'P1', pumpNumber: 1 });
    nozzle = await Nozzle.create({ pumpId: pump.id, stationId: station.id, nozzleNumber: 1, fuelType: 'petrol', initialReading: 1000 });

    // create creditor
    creditor = await Creditor.create({ stationId: station.id, name: 'Atomic Creditor', creditLimit: 10000 });

    // login manager to get token
    const resp = await request(app).post('/api/v1/auth/login').send({ email: 'manager@atomic.test', password: 'manager123' });
    managerToken = resp.body.data.token;
  });

  test('creates CreditTransaction and updates creditor balance on reading with credit', async () => {
    const response = await request(app)
      .post('/api/v1/readings')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        nozzleId: nozzle.id,
        stationId: station.id,
        readingDate: new Date().toISOString().split('T')[0],
        readingValue: 1500,
        previousReading: 1000,
        litresSold: 500,
        pricePerLitre: 100,
        totalAmount: 50000,
        cashAmount: 45000,
        creditAmount: 5000,
        creditorId: creditor.id
      });

    expect([201, 200]).toContain(response.status);

    // verify credit transaction created
    const transactions = await CreditTransaction.findAll({ where: { creditorId: creditor.id } });
    expect(transactions.length).toBeGreaterThan(0);

    // verify creditor balance updated
    const updated = await Creditor.findByPk(creditor.id);
    expect(parseFloat(updated.currentBalance)).toBeGreaterThan(0);
  });

    test('fails with invalid creditor', async () => {
      const response = await request(app)
        .post('/api/v1/readings')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          nozzleId: nozzle.id,
          stationId: station.id,
          readingDate: new Date().toISOString().split('T')[0],
          readingValue: 1600,
          previousReading: 1500,
          litresSold: 100,
          pricePerLitre: 100,
          totalAmount: 10000,
          cashAmount: 5000,
          creditAmount: 5000,
          creditorId: 'invalid-id'
        });
      expect([400, 404]).toContain(response.status);
    });

    test('blocks over-crediting beyond limit', async () => {
      const response = await request(app)
        .post('/api/v1/readings')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          nozzleId: nozzle.id,
          stationId: station.id,
          readingDate: new Date().toISOString().split('T')[0],
          readingValue: 1700,
          previousReading: 1600,
          litresSold: 100,
          pricePerLitre: 100,
          totalAmount: 10000,
          cashAmount: 0,
          creditAmount: 20000, // exceeds limit
          creditorId: creditor.id
        });
      expect([400, 403]).toContain(response.status);
    });

    test('blocks credit to inactive creditor', async () => {
      await creditor.update({ isActive: false });
      const response = await request(app)
        .post('/api/v1/readings')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          nozzleId: nozzle.id,
          stationId: station.id,
          readingDate: new Date().toISOString().split('T')[0],
          readingValue: 1800,
          previousReading: 1700,
          litresSold: 100,
          pricePerLitre: 100,
          totalAmount: 10000,
          cashAmount: 0,
          creditAmount: 10000,
          creditorId: creditor.id
        });
      expect([400, 403]).toContain(response.status);
      await creditor.update({ isActive: true }); // restore for other tests
    });

    test('blocks negative credit amount', async () => {
      const response = await request(app)
        .post('/api/v1/readings')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          nozzleId: nozzle.id,
          stationId: station.id,
          readingDate: new Date().toISOString().split('T')[0],
          readingValue: 1900,
          previousReading: 1800,
          litresSold: 100,
          pricePerLitre: 100,
          totalAmount: 10000,
          cashAmount: 10000,
          creditAmount: -500,
          creditorId: creditor.id
        });
      expect([400, 403]).toContain(response.status);
    });

    test('atomicity: reading and credit transaction must both succeed or both fail', async () => {
      // Try to create reading with invalid credit (should fail, no reading or transaction created)
      const response = await request(app)
        .post('/api/v1/readings')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          nozzleId: nozzle.id,
          stationId: station.id,
          readingDate: new Date().toISOString().split('T')[0],
          readingValue: 2000,
          previousReading: 1900,
          litresSold: 100,
          pricePerLitre: 100,
          totalAmount: 10000,
          cashAmount: 0,
          creditAmount: 20000, // exceeds limit
          creditorId: creditor.id
        });
      expect([400, 403]).toContain(response.status);
      // Confirm no reading or credit transaction created for this readingValue
      const reading = await sequelize.models.NozzleReading.findOne({ where: { readingValue: 2000 } });
      expect(reading).toBeNull();
      const transactions = await CreditTransaction.findAll({ where: { creditorId: creditor.id, amount: 20000 } });
      expect(transactions.length).toBe(0);
    });
});
