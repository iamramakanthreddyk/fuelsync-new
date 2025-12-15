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
    // Get current enum values
    const enumVals = await db.query(`
      SELECT enumlabel FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enum_plans_name')
      ORDER BY enumsortorder
    `, { raw: true });
    
    console.log('Current enum values:', enumVals[0].map(e => e.enumlabel));
    
    // Add Enterprise if it doesn't exist
    const hasEnterprise = enumVals[0].some(e => e.enumlabel === 'Enterprise');
    if (!hasEnterprise) {
      await db.query(`ALTER TYPE enum_plans_name ADD VALUE IF NOT EXISTS 'Enterprise' AFTER 'Premium'`);
      console.log('✓ Added Enterprise to enum_plans_name');
    } else {
      console.log('✓ Enterprise already in enum');
    }
    
    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
})();
