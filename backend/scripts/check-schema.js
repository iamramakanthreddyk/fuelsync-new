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
    // Check station table columns
    const columns = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'stations' ORDER BY column_name`, { raw: true });
    console.log('Station columns:', columns[0].map(c => c.column_name));
    
    // Add missing columns
    const missingCols = [
      'ALTER TABLE stations ADD COLUMN IF NOT EXISTS address VARCHAR(255);',
      'ALTER TABLE stations ADD COLUMN IF NOT EXISTS phone VARCHAR(20);',
      'ALTER TABLE stations ADD COLUMN IF NOT EXISTS email VARCHAR(100);'
    ];
    
    for (const sql of missingCols) {
      await db.query(sql);
    }
    console.log('✓ Added missing station columns');
    
    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
})();
