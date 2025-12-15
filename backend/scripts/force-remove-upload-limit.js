const { Sequelize } = require('sequelize');
const db = new Sequelize({
  dialect: 'postgres',
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  logging: false
});

(async () => {
  try {
    await db.query('ALTER TABLE plans ALTER COLUMN upload_limit DROP NOT NULL;');
    await db.query('ALTER TABLE plans DROP COLUMN IF EXISTS upload_limit;');
    console.log('✓ Force removed upload_limit column from plans table');
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
