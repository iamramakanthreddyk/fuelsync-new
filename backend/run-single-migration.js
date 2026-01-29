const path = require('path');
const { Sequelize } = require('sequelize');

// Usage: node run-single-migration.js <migration-filename.js>
const migrationFile = process.argv[2] || '20260129-add-enhanced-plan-limits.js';

const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  logging: console.log,
});

async function run() {
  try {
    const migrationsDir = path.join(__dirname, 'migrations');
    const filePath = path.join(migrationsDir, migrationFile);
    console.log(`Running single migration: ${migrationFile}`);

    const migration = require(filePath);
    const queryInterface = sequelize.getQueryInterface();

    if (!migration || typeof migration.up !== 'function') {
      console.error('Migration not found or has no up function:', filePath);
      process.exit(1);
    }

    try {
      await migration.up(queryInterface, Sequelize);
      console.log(`✓ Migration applied: ${migrationFile}`);
    } catch (err) {
      console.error(`✗ Error applying migration ${migrationFile}:`, err && err.message ? err.message : err);
      // Re-throw to exit with non-zero status
      throw err;
    }

    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error('Failed to run migration:', err && err.message ? err.message : err);
    try { await sequelize.close(); } catch (_) {}
    process.exit(1);
  }
}

run();
