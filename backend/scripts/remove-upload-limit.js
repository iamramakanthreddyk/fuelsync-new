const { Sequelize } = require('sequelize');
const db = new Sequelize({
  dialect: 'postgres',
  host: 'metro.proxy.rlwy.net',
  port: 31559,
  database: 'railway',
  username: 'postgres',
  password: process.env.DB_PASSWORD,
  logging: false
});

(async () => {
  try {
    await db.query('ALTER TABLE plans DROP COLUMN IF EXISTS upload_limit;');
    console.log('✓ Removed upload_limit column from plans table');
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
})();
