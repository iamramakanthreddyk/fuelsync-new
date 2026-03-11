require('dotenv').config();
const { Sequelize } = require('sequelize');
const path = require('path');

let db;

if (process.env.DB_DIALECT === 'postgres' || process.env.DATABASE_URL) {
  if (process.env.DATABASE_URL) {
    db = new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: { ssl: process.env.DB_FORCE_SSL ? { rejectUnauthorized: false } : false }
    });
  } else {
    db = new Sequelize({
      dialect: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME,
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      logging: false
    });
  }
} else {
  const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'fuelsync.db');
  db = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: false
  });
}

(async () => {
  try {
    const expenses = await db.query(`SELECT * FROM "Expenses" LIMIT 5`, { type: Sequelize.QueryTypes.SELECT });
    console.log('Sample expenses:', JSON.stringify(expenses, null, 2));
    await db.close();
  } catch (error) {
    console.error('Error:', error.message);
    await db.close().catch(() => {});
  }
})();
