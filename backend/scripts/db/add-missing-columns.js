const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  logging: console.log
});

(async () => {
  try {
    console.log('Adding missing columns to database...\n');

    // Add all missing columns using raw SQL
    const queries = [
      { sql: `ALTER TABLE plans ADD COLUMN IF NOT EXISTS description VARCHAR(255);`, name: 'plans.description' },
      { sql: `ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_creditors INTEGER DEFAULT 10;`, name: 'plans.max_creditors' },
      { sql: `ALTER TABLE plans ADD COLUMN IF NOT EXISTS can_track_expenses BOOLEAN DEFAULT false;`, name: 'plans.can_track_expenses' },
      { sql: `ALTER TABLE plans ADD COLUMN IF NOT EXISTS price_yearly DECIMAL(10,2);`, name: 'plans.price_yearly' },
      { sql: `ALTER TABLE plans ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;`, name: 'plans.sort_order' },
      { sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;`, name: 'users.created_by' },
      { sql: `ALTER TABLE stations ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id) ON DELETE CASCADE;`, name: 'stations.owner_id' },
      { sql: `ALTER TABLE stations ADD COLUMN IF NOT EXISTS code VARCHAR(20);`, name: 'stations.code' },
      { sql: `ALTER TABLE stations ADD COLUMN IF NOT EXISTS require_shift_for_readings BOOLEAN DEFAULT false;`, name: 'stations.require_shift_for_readings' },
      { sql: `ALTER TABLE stations ADD COLUMN IF NOT EXISTS alert_on_missed_readings BOOLEAN DEFAULT true;`, name: 'stations.alert_on_missed_readings' },
      { sql: `ALTER TABLE stations ADD COLUMN IF NOT EXISTS missed_reading_threshold_days INTEGER DEFAULT 1;`, name: 'stations.missed_reading_threshold_days' },
    ];

    for (const query of queries) {
      try {
        await sequelize.query(query.sql);
        console.log(`✓ ${query.name}`);
      } catch (err) {
        if (err.message.includes('already exists')) {
          console.log(`⊘ ${query.name} already exists`);
        } else {
          console.error(`✗ ${query.name}: ${err.message}`);
        }
      }
    }

    console.log('\n✅ Database schema updated successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
