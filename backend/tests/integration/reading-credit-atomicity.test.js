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
});
