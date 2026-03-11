/**
 * Fix: Update approval status for owner-entered expenses
 * 
 * Problem: Expenses entered by owners have approvedBy and approvedAt populated,
 * but approvalStatus is still "pending" instead of "auto_approved"
 * 
 * Solution: Set approvalStatus to "auto_approved" where:
 * - enteredBy = approvedBy (owner entered and approved)
 * - approvalStatus = "pending" (mismatch)
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');
const path = require('path');

let db;

// Support both SQLite and PostgreSQL
if (process.env.DB_DIALECT === 'postgres' || process.env.DATABASE_URL) {
  if (process.env.DATABASE_URL) {
    // Production: Use DATABASE_URL
    db = new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: {
        ssl: process.env.DB_FORCE_SSL ? { rejectUnauthorized: false } : false
      }
    });
  } else {
    // Development PostgreSQL
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
  // SQLite (default)
  const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'fuelsync.db');
  db = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: false
  });
}

async function fixOwnerExpenses() {
  try {
    console.log('🔍 Finding owner-entered expenses with incorrect status...\n');
    
    // Find expenses where:
    // 1. enteredBy = approvedBy (owner approved their own entry)
    // 2. approvalStatus = 'pending' (but should be 'auto_approved')
    // 3. approvedAt is not null (approval already happened)
    const expenses = await db.query(`
      SELECT 
        id,
        "enteredBy",
        "approvedBy",
        "approvalStatus",
        "approvedAt",
        category,
        description,
        amount
      FROM "Expenses"
      WHERE "enteredBy" = "approvedBy"
      AND "approvalStatus" = 'pending'
      AND "approvedAt" IS NOT NULL
    `, { type: Sequelize.QueryTypes.SELECT });

    if (expenses.length === 0) {
      console.log('✅ No mismatches found. All owner expenses have correct status.');
      await db.close();
      return;
    }

    console.log(`📋 Found ${expenses.length} expense(s) to fix:\n`);
    expenses.forEach((e, idx) => {
      console.log(`  ${idx + 1}. ID: ${e.id}`);
      console.log(`     Category: ${e.category}, Amount: ₹${e.amount}`);
      console.log(`     Entered & Approved by: ${e.enteredBy}`);
      console.log(`     Current: ${e.approvalStatus} → Should be: auto_approved\n`);
    });

    // Fix: Update status to auto_approved
    const [, rowsAffected] = await db.query(`
      UPDATE "Expenses"
      SET "approvalStatus" = 'auto_approved'
      WHERE "enteredBy" = "approvedBy"
      AND "approvalStatus" = 'pending'
      AND "approvedAt" IS NOT NULL
    `);

    console.log(`\n✅ Updated ${rowsAffected} expense(s) to 'auto_approved' status\n`);

    // Verify
    const verify = await db.query(`
      SELECT COUNT(*) as count FROM "Expenses"
      WHERE "enteredBy" = "approvedBy"
      AND "approvalStatus" = 'auto_approved'
      AND "approvedAt" IS NOT NULL
    `, { type: Sequelize.QueryTypes.SELECT });

    // Handle both SQLite and PostgreSQL response formats
    const verifyCount = Array.isArray(verify[0]) ? (verify[0][0]?.count || verify[0][0]) : verify[0]?.count;
    console.log(`✅ Verification: ${verifyCount} auto-approved expenses now have correct status`);

    await db.close();

  } catch (error) {
    console.error('❌ Error fixing expenses:');
    console.error('Message:', error.message);
    if (error.code) console.error('Code:', error.code);
    console.error('Stack:', error.stack);
    await db.close().catch(() => {});
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  fixOwnerExpenses()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = fixOwnerExpenses;
