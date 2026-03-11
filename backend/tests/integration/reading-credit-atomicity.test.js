const request = require('supertest');

// NOTE: Environment is set in tests/setup.js BEFORE this file loads
// Database: test.db (isolated from production)
console.log('🧪 [ATOMICITY TEST] Using database:', process.env.DATABASE_PATH);

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
    // First create a reading (NEW architecture: readings don't include payment breakdown)
    const readingResponse = await request(app)
      .post('/api/v1/readings')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        nozzleId: nozzle.id,
        readingDate: new Date().toISOString().split('T')[0],
        readingValue: 1500
      });

    expect([201, 200]).toContain(readingResponse.status);
    const readingId = readingResponse.body.data.id;

    // Then create a transaction with credit allocation
    const txnResponse = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        stationId: station.id,
        transactionDate: new Date().toISOString().split('T')[0],
        readingIds: [readingId],
        paymentBreakdown: {
          cash: 45000,
          online: 0,
          credit: 5000
        },
        creditAllocations: [
          {
            creditorId: creditor.id,
            amount: 5000
          }
        ]
      });

    expect([201, 200]).toContain(txnResponse.status);
    // verify credit transaction created
    const transactions = await CreditTransaction.findAll({ where: { creditorId: creditor.id } });
    expect(transactions.length).toBeGreaterThan(0);

    // verify creditor balance updated
    const updated = await Creditor.findByPk(creditor.id);
    expect(parseFloat(updated.currentBalance)).toBeGreaterThan(0);
  });

    test('fails with invalid creditor', async () => {
      // Create a reading first
      const readingResponse = await request(app)
        .post('/api/v1/readings')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          nozzleId: nozzle.id,
          readingDate: new Date().toISOString().split('T')[0],
          readingValue: 1600
        });
      
      const readingId = readingResponse.body.data.id;

      // Try to create transaction with invalid creditor ID
      const response = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          stationId: station.id,
          transactionDate: new Date().toISOString().split('T')[0],
          readingIds: [readingId],
          paymentBreakdown: {
            cash: 5000,
            online: 0,
            credit: 5000
          },
          creditAllocations: [
            {
              creditorId: 'invalid-creditor-id',
              amount: 5000
            }
          ]
        });
      expect([400, 404]).toContain(response.status);
    });

    test('blocks over-crediting beyond limit', async () => {
      // Create a reading with large amount
      const readingResponse = await request(app)
        .post('/api/v1/readings')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          nozzleId: nozzle.id,
          readingDate: new Date().toISOString().split('T')[0],
          readingValue: 1700
        });
      
      const readingId = readingResponse.body.data.id;
      const totalAmount = readingResponse.body.data.totalAmount;

      // Try to create transaction with credit exceeding limit
      const response = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          stationId: station.id,
          transactionDate: new Date().toISOString().split('T')[0],
          readingIds: [readingId],
          paymentBreakdown: {
            cash: 0,
            online: 0,
            credit: 20000 // exceeds creditor limit
          },
          creditAllocations: [
            {
              creditorId: creditor.id,
              amount: 20000 // exceeds limit
            }
          ]
        });
      expect([400, 403]).toContain(response.status);
    });

    test('blocks credit to inactive creditor', async () => {
      await creditor.update({ isActive: false });
      
      // Create a reading
      const readingResponse = await request(app)
        .post('/api/v1/readings')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          nozzleId: nozzle.id,
          readingDate: new Date().toISOString().split('T')[0],
          readingValue: 1800
        });
      
      const readingId = readingResponse.body.data.id;

      // Try to create transaction with credit to inactive creditor
      const response = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          stationId: station.id,
          transactionDate: new Date().toISOString().split('T')[0],
          readingIds: [readingId],
          paymentBreakdown: {
            cash: 0,
            online: 0,
            credit: 10000
          },
          creditAllocations: [
            {
              creditorId: creditor.id,
              amount: 10000
            }
          ]
        });
      expect([400, 403]).toContain(response.status);
      await creditor.update({ isActive: true }); // restore for other tests
    });

    test('blocks negative credit amount', async () => {
      // Create a reading
      const readingResponse = await request(app)
        .post('/api/v1/readings')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          nozzleId: nozzle.id,
          readingDate: new Date().toISOString().split('T')[0],
          readingValue: 1900
        });
      
      const readingId = readingResponse.body.data.id;

      // Try to create transaction with negative credit
      const response = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          stationId: station.id,
          transactionDate: new Date().toISOString().split('T')[0],
          readingIds: [readingId],
          paymentBreakdown: {
            cash: 10000,
            online: 0,
            credit: -500 // negative credit
          },
          creditAllocations: [
            {
              creditorId: creditor.id,
              amount: -500 // negative amount
            }
          ]
        });
      expect([400, 403]).toContain(response.status);
    });

    test('atomicity: reading and credit transaction must both succeed or both fail', async () => {
      // Create a reading first
      const readingResponse = await request(app)
        .post('/api/v1/readings')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          nozzleId: nozzle.id,
          readingDate: new Date().toISOString().split('T')[0],
          readingValue: 2000
        });

      expect([201, 200]).toContain(readingResponse.status);
      const readingId = readingResponse.body.data.id;

      // Try to create transaction with invalid credit (should fail, no transaction created)
      const response = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          stationId: station.id,
          transactionDate: new Date().toISOString().split('T')[0],
          readingIds: [readingId],
          paymentBreakdown: {
            cash: 0,
            online: 0,
            credit: 20000 // exceeds limit
          },
          creditAllocations: [
            {
              creditorId: creditor.id,
              amount: 20000 // exceeds limit
            }
          ]
        });
      expect([400, 403]).toContain(response.status);
      
      // Confirm no credit transaction created with this amount
      const transactions = await CreditTransaction.findAll({
        where: {
          creditorId: creditor.id,
          amount: 20000
        }
      });
      expect(transactions.length).toBe(0);
    });
});
