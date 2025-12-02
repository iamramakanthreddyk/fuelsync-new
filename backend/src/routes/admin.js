const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Use env variable for password (never hardcode in production)
const ADMIN_BACKUP_PASSWORD = process.env.ADMIN_BACKUP_PASSWORD;

// Middleware for password protection
function requirePassword(req, res, next) {
  const password = req.headers['x-backup-password'] || req.body.password;
  if (!password || !ADMIN_BACKUP_PASSWORD || password !== ADMIN_BACKUP_PASSWORD) {
    // Optionally log failed attempt here
    return res.status(401).json({ error: 'Unauthorized: Invalid password' });
  }
  next();
}

// Utility: Ensure tmp directory exists
function ensureTmpDir() {
  const tmpDir = path.resolve(__dirname, '../../tmp');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  return tmpDir;
}

// Utility: Basic audit log stub (expand as needed)
function auditLog(action, req, status = 'success', details = '') {
  // You can write to a file, DB, or external service here
  // For now, just log to console
  const user = req.user?.id || 'admin-api';
  console.log(`[AUDIT] [${new Date().toISOString()}] [${action}] [${user}] [${status}] ${details}`);
}

// POST /admin/backup - triggers a pg_dump and streams the file
router.post('/backup', requirePassword, async (req, res) => {
  // Only allow for PostgreSQL
  const dialect = (process.env.DB_DIALECT || '').toLowerCase();
  if (dialect !== 'postgres' && !process.env.DATABASE_URL) {
    auditLog('backup', req, 'fail', 'Not PostgreSQL');
    return res.status(400).json({ error: 'Backup only supported for PostgreSQL' });
  }

  // Compose pg_dump command
  const dbUrl = process.env.DATABASE_URL ||
    `postgresql://${encodeURIComponent(process.env.DB_USER)}:${encodeURIComponent(process.env.DB_PASSWORD)}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

  // Sanitize file name and path
  const tmpDir = ensureTmpDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dumpFile = path.join(tmpDir, `backup_${timestamp}.sql`);
  const outFile = `fuelsync-backup-${timestamp}.sql`;
  const cmd = `pg_dump --no-owner --no-privileges --format=plain --file="${dumpFile}" "${dbUrl}"`;

  exec(cmd, (err) => {
    if (err) {
      auditLog('backup', req, 'fail', err.message);
      return res.status(500).json({ error: 'Backup failed', details: err.message });
    }
    res.download(dumpFile, outFile, (err) => {
      fs.unlink(dumpFile, () => {}); // Clean up temp file
      if (err) {
        auditLog('backup', req, 'fail', 'Download error: ' + err.message);
        console.error('Download error:', err);
      } else {
        auditLog('backup', req, 'success', 'Backup downloaded');
      }
    });
  });
});

module.exports = router;
