/**
 * Cleanup Script
 * Moves old code to _deprecated folder for reference
 * Run with: node scripts/cleanup.js
 * 
 * This script preserves old files in _deprecated/ instead of deleting them
 * so you can reference them if needed during migration.
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const deprecatedDir = path.join(rootDir, '_deprecated');

// Items to move to deprecated (relative to backend/)
const itemsToMove = [
  // Old root-level entry points (replaced by src/)
  'app.js',
  'server.js',
  'pass.js',
  
  // Old directories (replaced by src/ structure)
  'controllers',
  'models',
  'routes',
  'middleware',
  'services',
  'config',
  'utils',
  
  // Old scripts (keeping cleanup.js)
  'scripts/migrate.js',
  'scripts/setup-db.js',
  'scripts/seed.js',
  
  // Old tests (if any)
  'tests'
];

// Files/folders to keep
const keepItems = [
  'src',           // New clean code
  'database',      // SQL schema reference  
  'docs',          // API documentation
  'scripts/cleanup.js',  // This script
  'package.json',
  'package-lock.json',
  'node_modules',
  '.env',
  '.env.example',
  'README.md',
  'REQUIREMENTS.md',
  '.gitignore'
];

console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🧹 FuelSync Cleanup Script                               ║
║                                                            ║
║   This script moves old files to _deprecated/ folder       ║
║   The new clean code is in src/ directory                  ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`);

// Create deprecated directory
if (!fs.existsSync(deprecatedDir)) {
  fs.mkdirSync(deprecatedDir, { recursive: true });
  console.log('✅ Created _deprecated/ directory\n');
}

// Helper function to move recursively
const moveRecursive = (source, dest) => {
  if (!fs.existsSync(source)) return false;
  
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  
  try {
    fs.renameSync(source, dest);
    return true;
  } catch (error) {
    // If rename fails (cross-device), copy and delete
    if (fs.statSync(source).isDirectory()) {
      fs.cpSync(source, dest, { recursive: true });
      fs.rmSync(source, { recursive: true });
    } else {
      fs.copyFileSync(source, dest);
      fs.unlinkSync(source);
    }
    return true;
  }
};

console.log('Moving old files to _deprecated/...\n');

let movedCount = 0;
let skippedCount = 0;

itemsToMove.forEach(item => {
  const sourcePath = path.join(rootDir, item);
  const destPath = path.join(deprecatedDir, item);
  
  if (fs.existsSync(sourcePath)) {
    try {
      moveRecursive(sourcePath, destPath);
      console.log(`  ✅ Moved: ${item}`);
      movedCount++;
    } catch (error) {
      console.error(`  ❌ Failed: ${item} - ${error.message}`);
    }
  } else {
    console.log(`  ⏭️  Skipped: ${item} (not found)`);
    skippedCount++;
  }
});

console.log(`
═══════════════════════════════════════════════════════════════
Summary: Moved ${movedCount} items, Skipped ${skippedCount} items
═══════════════════════════════════════════════════════════════

🎉 Cleanup complete!

📁 New project structure:

backend/
├── src/                    ✅ NEW Clean code
│   ├── app.js             Express application
│   ├── server.js          Entry point (auto-sync DB)
│   ├── config/
│   │   ├── constants.js   Expandable fuel types, payment methods
│   │   └── database.js    Sequelize configuration
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── readingController.js
│   │   ├── dashboardController.js
│   │   ├── stationController.js
│   │   ├── creditController.js     NEW: Credit management
│   │   └── expenseController.js    NEW: Expense & P/L tracking
│   ├── middleware/
│   │   └── auth.js        JWT + role verification
│   ├── models/
│   │   ├── index.js       Auto-sync + associations
│   │   ├── Plan.js
│   │   ├── Station.js
│   │   ├── User.js
│   │   ├── Pump.js
│   │   ├── Nozzle.js
│   │   ├── FuelPrice.js
│   │   ├── NozzleReading.js
│   │   ├── Creditor.js         NEW: Creditor management
│   │   ├── CreditTransaction.js NEW: Credit sales & settlements
│   │   ├── Expense.js          NEW: Daily expenses
│   │   └── CostOfGoods.js      NEW: Monthly purchase costs
│   └── routes/
│       ├── auth.js
│       ├── readings.js
│       ├── dashboard.js
│       ├── stations.js
│       ├── credits.js          NEW: Credit routes
│       └── expenses.js         NEW: Expense routes
├── database/              SQL schema reference
├── docs/                  API documentation
├── _deprecated/           OLD code (safe to delete later)
├── package.json          Updated for src/
├── .env                  Environment config
├── README.md             Updated documentation
└── REQUIREMENTS.md       Complete requirements

🚀 To start the server:

   cd backend
   npm install
   npm run dev

📝 The server will auto-create all database tables on startup!
`);

// Verify src/ exists and has the required files
const requiredFiles = [
  'src/app.js',
  'src/server.js',
  'src/models/index.js',
  'src/config/constants.js'
];

console.log('Verifying new structure...');
let allPresent = true;
requiredFiles.forEach(file => {
  const filePath = path.join(rootDir, file);
  if (fs.existsSync(filePath)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ Missing: ${file}`);
    allPresent = false;
  }
});

if (allPresent) {
  console.log('\n✅ All required files are present. Ready to run!\n');
} else {
  console.log('\n⚠️  Some files are missing. Please check the src/ directory.\n');
}
