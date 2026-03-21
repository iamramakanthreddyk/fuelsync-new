const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
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
    // Remove the migration record so it runs again
    await sequelize.query(`
      DELETE FROM "SequelizeMeta" 
      WHERE "name" = '20251215-add-missing-schema-columns.js';
    `);
    
    console.log('✓ Migration record removed - will re-run on next start');
    process.exit(0);
  } catch (err) {
    console.error('✗ Error:', err.message);
    process.exit(1);
  }
})();
