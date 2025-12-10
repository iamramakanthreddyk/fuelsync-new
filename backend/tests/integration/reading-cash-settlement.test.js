const request = require('supertest');
let app;
const { sequelize, User, Station, Nozzle, Pump } = require('../../src/models');

describe('Reading + Settlement Integration', () => {
  let station, owner, manager, pump, nozzle, managerToken;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    app = require('../../src/app');

    owner = await User.create({ email: 'owner@settle.test', password: 'owner123', name: 'Owner Settle', role: 'owner' });
    station = await Station.create({ ownerId: owner.id, name: 'Settle Station' });
    await owner.update({ stationId: station.id });

    manager = await User.create({ email: 'manager@settle.test', password: 'manager123', name: 'Manager Settle', role: 'manager', stationId: station.id });
    pump = await Pump.create({ stationId: station.id, name: 'P1', pumpNumber: 1 });
    nozzle = await Nozzle.create({ pumpId: pump.id, stationId: station.id, nozzleNumber: 1, fuelType: 'petrol', initialReading: 100 });

    // login manager to get token
    const resp = await request(app).post('/api/v1/auth/login').send({ email: 'manager@settle.test', password: 'manager123' });
    managerToken = resp.body.data.token;
  });

  test('can enter cash reading and settle', async () => {
    // Enter a cash reading
    const readingResp = await request(app)
      .post('/api/v1/readings')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        nozzleId: nozzle.id,
        stationId: station.id,
        readingDate: new Date().toISOString().split('T')[0],
        readingValue: 200,
        cashAmount: 10000
      });
    expect([201, 200]).toContain(readingResp.status);
    expect(readingResp.body.data.cashAmount).toBe(10000);
    // Now settle
    const settleResp = await request(app)
      .post(`/api/v1/stations/${station.id}/settlements`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ date: new Date().toISOString().split('T')[0] });
    expect([201, 200]).toContain(settleResp.status);
    expect(settleResp.body.success).toBe(true);
    // Check readings are linked to settlement
    const readingsResp = await request(app)
      .get(`/api/v1/stations/${station.id}/readings?date=${new Date().toISOString().split('T')[0]}`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(readingsResp.body.data.linked.readings.length).toBeGreaterThan(0);
    expect(readingsResp.body.data.linked.readings[0].settlementId).toBeTruthy();
  });
});
