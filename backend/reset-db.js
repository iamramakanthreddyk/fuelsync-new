#!/usr/bin/env node
/**
 * Reset Database - Delete corrupted SQLite database and rebuild
 * Run this when schema is out of sync
 * 
 * IMPORTANT: Stop the backend server first (Ctrl+C)
 */

const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'data/fuelsync.db');
const dbWalPath = path.join(__dirname, 'data/fuelsync.db-wal');
const dbShmPath = path.join(__dirname, 'data/fuelsync.db-shm');

console.log('🔧 Resetting FuelSync database...\n');
console.log('⚠️  IMPORTANT: Make sure backend is stopped first!\n');

let deleted = 0;

// Delete main database file
if (fs.existsSync(dbPath)) {
  try {
    fs.unlinkSync(dbPath);
    console.log('✅ Deleted:', dbPath);
    deleted++;
  } catch (err) {
    console.error('❌ Failed to delete main database:', err.message);
    console.error('   Make sure backend is stopped first!');
    process.exit(1);
  }
} else {
  console.log('ℹ️  Main database file does not exist');
}

// Delete WAL file (Write-Ahead Log)
if (fs.existsSync(dbWalPath)) {
  try {
    fs.unlinkSync(dbWalPath);
    console.log('✅ Deleted:', dbWalPath);
    deleted++;
  } catch (err) {
    console.warn('⚠️  Could not delete WAL file:', err.message);
  }
}

// Delete SHM file (Shared Memory)
if (fs.existsSync(dbShmPath)) {
  try {
    fs.unlinkSync(dbShmPath);
    console.log('✅ Deleted:', dbShmPath);
    deleted++;
  } catch (err) {
    console.warn('⚠️  Could not delete SHM file:', err.message);
  }
}

if (deleted > 0) {
  console.log(`\n✅ Deleted ${deleted} database file(s)`);
  console.log('\n📝 Next steps:');
  console.log('   1. Start the backend with: npm start');
  console.log('   2. The database will be recreated with proper schema');
  console.log('   3. Default data will be seeded automatically\n');
} else {
  console.log('ℹ️  No database files found to delete\n');
}

process.exit(0);
