/**
 * Check: Inspect approval status of owner-entered expenses
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');
const path = require('path');

let db;

// Support both SQLite and PostgreSQL
if (process.env.DB_DIALECT === 'postgres' || process.env.DATABASE_URL) {
  if (process.env.DATABASE_URL) {
    db = new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: {
        ssl: process.env.DB_FORCE_SSL ? { rejectUnauthorized: false } : false
      }
    });
  } else {
    db = new Sequelize({
      dialect: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME,
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      logging: false
    });
  }
} else {
  const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'fuelsync.db');
  db = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: false
  });
}

async function checkOwnerExpenses() {
  try {
    console.log('📊 Checking owner-entered expenses...\n');
    
    // Check all expenses where enteredBy = approvedBy
    const ownerExpenses = await db.query(`
      SELECT 
        id,
        "enteredBy",
        "approvedBy",
        "approvalStatus",
        "approvedAt",
        category,
        description,
        amount,
        "createdAt"
      FROM "Expenses"
      WHERE "enteredBy" = "approvedBy"
      ORDER BY "createdAt" DESC
      LIMIT 20
    `, { type: Sequelize.QueryTypes.SELECT });

    if (ownerExpenses.length === 0) {
      console.log('❌ No owner-entered expenses found');
      await db.close();
      return;
    }

    console.log(`Found ${ownerExpenses.length} owner-entered expense(s):\n`);
    ownerExpenses.forEach((e, idx) => {
      console.log(`${idx + 1}. ID: ${e.id}`);
      console.log(`   Category: ${e.category} | Amount: ₹${e.amount}`);
      console.log(`   Status: "${e.approvalStatus}"`);
      console.log(`   Approved At: ${e.approvedAt}`);
      console.log(`   Created At: ${e.createdAt}\n`);
    });

    // Summary by status
    const summary = await db.query(`
      SELECT "approvalStatus", COUNT(*) as count
      FROM "Expenses"
      WHERE "enteredBy" = "approvedBy"
      GROUP BY "approvalStatus"
    `, { type: Sequelize.QueryTypes.SELECT });

    console.log('\n📈 Summary of owner-entered expenses by status:');
    summary.forEach(s => {
      console.log(`   ${s.approvalStatus}: ${s.count}`);
    });

    await db.close();

  } catch (error) {
    console.error('❌ Error:', error.message);
    await db.close().catch(() => {});
    throw error;
  }
}

if (require.main === module) {
  checkOwnerExpenses()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = checkOwnerExpenses;
