
const { Sequelize } = require('sequelize');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

const sequelize = new Sequelize({
  database: process.env.DB_NAME || 'fuelsync_db',
  username: process.env.DB_USER || 'fueladmin',
  password: process.env.DB_PASSWORD || '',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  dialect: 'postgres',
  define: {
    underscored: true, // snake_case in DB
  },
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },
  logging: process.env.DB_LOGGING === 'true' || !isProduction ? console.log : false,
  pool: {
    max: 10,
    min: 2,
    acquire: 30000,
    idle: 10000,
  },
});

sequelize
  .authenticate()
  .then(() => {
    console.log('✅ Connected to PostgreSQL database via Sequelize');
  })
  .catch((err) => {
    console.error('❌ Unable to connect to the database:', err);
});

module.exports = { sequelize };
