const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  logging: false,
});

(async () => {
  try {
    console.log('Ensuring plan columns exist...');

    const queries = [
      `ALTER TABLE plans ADD COLUMN IF NOT EXISTS sales_reports_days INTEGER DEFAULT 30;`,
      `ALTER TABLE plans ADD COLUMN IF NOT EXISTS profit_reports_days INTEGER DEFAULT 30;`,
      `ALTER TABLE plans ADD COLUMN IF NOT EXISTS analytics_data_days INTEGER DEFAULT 90;`,
      `ALTER TABLE plans ADD COLUMN IF NOT EXISTS audit_logs_days INTEGER DEFAULT 30;`,
      `ALTER TABLE plans ADD COLUMN IF NOT EXISTS transaction_history_days INTEGER DEFAULT 90;`,
    ];

    for (const sql of queries) {
      try {
        await sequelize.query(sql);
        console.log(`✓ Executed: ${sql}`);
      } catch (err) {
        console.error(`✗ Failed: ${sql}`);
        console.error(err.message || err);
      }
    }

    console.log('Done.');
    process.exit(0);
  } catch (err) {
    console.error('Error ensuring plan columns:', err.message || err);
    process.exit(1);
  }
})();
