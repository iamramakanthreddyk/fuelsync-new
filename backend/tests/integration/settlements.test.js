const request = require('supertest');
const app = require('../../src/app');
const { sequelize, User, Plan, Station } = require('../../src/models');
const bcrypt = require('bcryptjs');

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

    // create manager user
    managerUser = await User.create({
      email: 'manager@test.com',
      password: await bcrypt.hash('password', 8),
      name: 'Manager',
      role: 'manager',
      planId: plan.id
    });

    // create station
    station = await Station.create({ name: 'Test Station', ownerId: managerUser.id });

    // login to get token
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'manager@test.com', password: 'password' });

    managerToken = loginRes.body?.data?.token || loginRes.body?.token;
  });

  test('POST and GET settlements', async () => {
    const date = new Date().toISOString().split('T')[0];
    const payload = {
      date,
      actualCash: 1000,
      expectedCash: 900,
      variance: -100,
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

    const getRes = await request(app)
      .get(`/api/v1/stations/${station.id}/settlements?limit=5`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body).toHaveProperty('success', true);
    expect(Array.isArray(getRes.body.data)).toBe(true);
    // At least one settlement should be returned
    expect(getRes.body.data.length).toBeGreaterThanOrEqual(1);
  });
});
