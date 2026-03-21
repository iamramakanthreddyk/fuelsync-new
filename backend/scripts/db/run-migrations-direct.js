const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');

// Load DB config from env
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
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.js')).sort();

    const queryInterface = sequelize.getQueryInterface();

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      console.log(`Running migration: ${file}`);
      const migration = require(filePath);
      if (migration && typeof migration.up === 'function') {
        try {
          await migration.up(queryInterface, Sequelize);
          console.log(`✓ Applied ${file}`);
        } catch (err) {
          console.error(`✗ Error applying ${file}:`, err.message || err);
        }
      } else {
        console.log(`→ Skipping ${file} (no up function)`);
      }
    }

    console.log('Migrations run completed.');
    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error('Failed running migrations:', err.message || err);
    process.exit(1);
  }
}

run();
