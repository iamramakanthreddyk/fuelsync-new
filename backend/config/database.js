require('dotenv').config();

// Determine if SSL is required (for Railway and other hosted services)
const getDialectOptions = (host) => {
  if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
    return {
      ssl: {
        require: true,
        rejectUnauthorized: false  // Allow self-signed certificates
      }
    };
  }
  return {};
};

const dbHost = process.env.DB_HOST || 'localhost';

module.exports = {
  development: {
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'fuel_sync',
    host: dbHost,
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false,
    dialectOptions: getDialectOptions(dbHost)
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: false,
    dialectOptions: getDialectOptions(process.env.DB_HOST)
