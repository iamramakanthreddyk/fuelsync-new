/**
 * FuelSync Server Entry Point
 * Starts the server and syncs database
 */

console.log('🚀 [SERVER] Node process starting...');

const app = require('./app');
const { syncDatabase } = require('./models');
const seedEssentials = require('../scripts/seedEssentials');

const PORT = process.env.PORT || 3001;

console.log('🚀 [SERVER] Creating HTTP server on port', PORT);

// Start server immediately - don't wait for database
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🔥 FuelSync API Server READY                             ║
║                                                            ║
║   URL: http://localhost:${PORT}                              ║
║   Port: ${PORT}                                                  ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝

📋 Server is ready to accept requests!
  `);
});

// Initialize database in background (non-blocking)
(async () => {
  console.log('📝 [BACKGROUND] Starting database initialization...');
  
  // Set a hard timeout to prevent hanging
  const backgroundTimeout = setTimeout(() => {
    console.warn('⚠️  [BACKGROUND] Timeout after 30 seconds');
  }, 30000);
  
  try {
    console.log('📝 [BACKGROUND] Syncing database...');
    // IMPORTANT: Use force:false, alter:false to prevent recreating tables
    // Tables are fixed manually now - just validate connection
    const syncSuccess = await syncDatabase({ force: false, alter: false });
    console.log('📝 [BACKGROUND] Sync result:', syncSuccess);
    
    // Always try to seed - tables might exist even if sync "failed"
    console.log('📝 [BACKGROUND] Seeding essential data...');
    try {
      await seedEssentials();
      console.log('✅ [BACKGROUND] Seeding complete');
    } catch (seedError) {
      console.warn('⚠️  [SEED] Seeding failed:', seedError.message.substring(0, 100));
    }
  } catch (error) {
    console.error('❌ [BACKGROUND] Error:', error.message);
  } finally {
    clearTimeout(backgroundTimeout);
    console.log('✅ [BACKGROUND] Initialization complete');
  }
})().catch(error => {
  console.error('❌ [BACKGROUND] Caught error:', error);
});

server.on('error', (error) => {
  console.error('❌ [SERVER] Server error:', error.message);
  console.error(error.stack);
});

// Keep-alive: periodically log to show process is alive
setInterval(() => {
  console.log('📍 [KEEPALIVE]', new Date().toISOString());
}, 60000); // Every 60 seconds

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('⏹️  [SERVER] SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ [SERVER] Server closed');
    process.exit(0);
  });
});

// Handle errors without exiting
process.on('unhandledRejection', (reason) => {
  console.error('❌ [SERVER] Unhandled Rejection:', reason);
  // Don't exit - keep server running
});

process.on('uncaughtException', (error) => {
  console.error('❌ [SERVER] Uncaught Exception:', error);
  // Don't exit - keep server running
});
