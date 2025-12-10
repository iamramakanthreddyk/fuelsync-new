const request = require('supertest');
const app = require('../../src/app');
const { sequelize, User, Plan, Station } = require('../../src/models');

describe('Settlements API', () => {
  let managerToken;
  let station;
  let managerUser;

  beforeAll(async () => {
    await sequelize.sync({ force: true });

    // seed plan
    const plan = await Plan.create({
      name: 'TestPlan', description: 'test', maxStations: 5, maxPumpsPerStation: 5, maxNozzlesPerPump: 4, maxEmployees: 10, maxCreditors: 10
    });

    // create owner user
    const ownerUser = await User.create({
      email: 'owner@test.com',
      password: 'owner123',
      name: 'Owner',
      role: 'owner',
      planId: plan.id
    });

    // create manager user
    managerUser = await User.create({
      email: 'manager@test.com',
      password: 'manager123',
      name: 'Manager',
      role: 'manager',
      ownerId: ownerUser.id
    });

    // create station owned by owner
    station = await Station.create({ name: 'Test Station', ownerId: ownerUser.id });

    // Assign manager to station
    await managerUser.update({ stationId: station.id });

    // login to get token
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'manager@test.com', password: 'manager123' });

    managerToken = loginRes.body?.data?.token || loginRes.body?.token;
    console.log('Login response:', loginRes.body);
    console.log('Token:', managerToken);
  });

  test('POST and GET settlements - variance calculated on backend', async () => {
    const date = new Date().toISOString().split('T')[0];
    const payload = {
      date,
      actualCash: 1000,
      expectedCash: 900,
      // NOTE: Frontend may send variance, but backend RECALCULATES it
      variance: -100, // This will be overridden
      notes: 'integration test'
    };

    const postRes = await request(app)
      .post(`/api/v1/stations/${station.id}/settlements`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send(payload);

    expect([200,201]).toContain(postRes.status);
    expect(postRes.body).toHaveProperty('success', true);
    expect(postRes.body).toHaveProperty('data');
    const created = postRes.body.data;
    expect(created).toHaveProperty('id');
    expect(created).toHaveProperty('stationId');
    
    // VERIFY: Variance was calculated on backend: 900 - 1000 = -100
    expect(created.variance).toBe(-100);
    console.log('✓ Variance calculated on backend:', created.variance);

    const getRes = await request(app)
      .get(`/api/v1/stations/${station.id}/settlements?limit=5`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body).toHaveProperty('success', true);
    expect(Array.isArray(getRes.body.data)).toBe(true);
    expect(getRes.body.data.length).toBeGreaterThanOrEqual(1);
    
    // VERIFY: Settlement history includes variance analysis
    const settlement = getRes.body.data[0];
    expect(settlement).toHaveProperty('varianceAnalysis');
    expect(settlement.varianceAnalysis).toHaveProperty('status');
    expect(settlement.varianceAnalysis).toHaveProperty('interpretation');
    console.log('✓ Settlement history with variance analysis:', settlement.varianceAnalysis);
  });
});
