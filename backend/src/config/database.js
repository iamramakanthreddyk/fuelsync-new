/**
 * Database Configuration
 * Supports: SQLite (development) and PostgreSQL (production)
 * 
 * Set DB_DIALECT=postgres in .env to use PostgreSQL
 * Default: SQLite (zero setup, data in ./data/fuelsync.db)
 */

const { Sequelize } = require('sequelize');
const path = require('path');

// Determine dialect from environment
const getDialect = () => process.env.DB_DIALECT || 'sqlite';

// Build PostgreSQL connection URL
const getPostgresUrl = () => {
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || 5432;
  const database = process.env.DB_NAME || 'fuelsync';
  const username = process.env.DB_USER || 'postgres';
  const password = process.env.DB_PASSWORD || 'postgres';
  
  return `postgres://${username}:${password}@${host}:${port}/${database}`;
};

// SQLite storage path
const getSqlitePath = () => {
  const dataDir = path.join(__dirname, '../../data');
  return path.join(dataDir, 'fuelsync.db');
};

// Common options
const commonOptions = {
  timestamps: true,
  underscored: true,
};

// Sequelize configuration based on environment
const config = {
  development: {
    sqlite: {
      dialect: 'sqlite',
      storage: getSqlitePath(),
      logging: console.log,
      define: commonOptions,
    },
    postgres: {
      url: process.env.DATABASE_URL || getPostgresUrl(),
      dialect: 'postgres',
      logging: console.log,
      pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
      define: commonOptions,
    }
  },
  test: {
    sqlite: {
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
      define: commonOptions,
    },
    postgres: {
      url: process.env.DATABASE_URL || getPostgresUrl(),
      dialect: 'postgres',
      logging: false,
      pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
      define: commonOptions,
    }
  },
  production: {
    postgres: {
      url: process.env.DATABASE_URL,
      dialect: 'postgres',
      logging: false,
      dialectOptions: {
        ssl: { require: true, rejectUnauthorized: false }
      },
      pool: { max: 20, min: 5, acquire: 60000, idle: 30000 },
      define: commonOptions,
    }
  }
};

// Get current environment and dialect
const env = process.env.NODE_ENV || 'development';
const dialect = getDialect();
const dbConfig = config[env]?.[dialect] || config[env]?.sqlite || config.development.sqlite;

// Create data directory for SQLite
if (dbConfig.dialect === 'sqlite' && dbConfig.storage !== ':memory:') {
  const fs = require('fs');
  const dataDir = path.dirname(dbConfig.storage);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// Create Sequelize instance
let sequelize;
if (dbConfig.dialect === 'sqlite') {
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbConfig.storage,
    logging: dbConfig.logging,
    define: dbConfig.define,
  });
  console.log(`📁 Using SQLite: ${dbConfig.storage}`);
} else {
  sequelize = new Sequelize(dbConfig.url, {
    dialect: dbConfig.dialect,
    logging: dbConfig.logging,
    pool: dbConfig.pool,
    define: dbConfig.define,
    dialectOptions: dbConfig.dialectOptions || {}
  });
  console.log(`🐘 Using PostgreSQL: ${dbConfig.url.replace(/:[^:@]+@/, ':***@')}`);
}

module.exports = { sequelize, config };
