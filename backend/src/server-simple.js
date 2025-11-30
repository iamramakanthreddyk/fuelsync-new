/**
 * FuelSync Server - Minimal Version for Testing
 * This is a bare-bones server to test if the issue is in the startup logic
 */

console.log('🚀 [STARTUP] Starting minimal FuelSync server...');
console.log('🚀 [STARTUP] Node.js version:', process.version);
console.log('🚀 [STARTUP] Environment:', process.env.NODE_ENV || 'development');


const PORT = process.env.PORT;
if (!PORT) {
  throw new Error('PORT environment variable is required!');
}
console.log('🚀 [STARTUP] PORT env:', process.env.PORT);

// Create express app
console.log('🚀 [STARTUP] Importing express...');
const express = require('express');
const app = express();

console.log('🚀 [STARTUP] Setting up middleware...');

// Minimal CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-tenant-id');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Simple echo endpoint
app.post('/api/v1/auth/login', (req, res) => {
  res.json({ 
    success: false, 
    error: 'Database not initialized',
    message: 'Server is running but database connection failed'
  });
});


console.log('🚀 [STARTUP] Starting server on port', PORT);
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ MINIMAL SERVER READY on port ${PORT}`);
  console.log('✅ Access at: http://localhost:' + PORT + '/health');
});

server.on('error', (error) => {
  console.error('❌ Server error:', error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
});
