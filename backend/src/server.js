/**
 * FuelSync Server Entry Point
 * 
 * Initialization Sequence:
 * 1. Validate database connection (check DATABASE_URL env var)
 * 2. Check if schema exists (count tables)
 * 3. Run pending migrations (if any)
 * 4. Verify all required tables created
 * 5. Seed initial data if needed
 * 6. Start Express server
 * 
 * All steps have detailed logging for Railway debugging
 */

console.log('🚀 [SERVER] Node process starting...\n');

const app = require('./app');
const { initializeDatabase } = require('./database/init');

const PORT = process.env.PORT || 3001;

/**
 * Main entry point
 */
async function startServer() {
  let server = null;
  
  try {
    console.log('🚀 [SERVER] Initializing database...\n');
    
    // Step 1-5: Database initialization (with detailed logging)
    const db = await initializeDatabase();
    
    // Step 6: Start Express server AFTER database is ready
    console.log('🌍 [SERVER] Starting Express server...\n');
    
    server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🔥 FuelSync API Server STARTED                           ║
║                                                            ║
║   ✅ Database: Connected & Ready                           ║
║   ✅ Schema: Verified & Up-to-date                         ║
║   ✅ Migrations: Complete                                  ║
║   ✅ Server: Listening on port ${PORT}                     ║
║                                                            ║
║   Time: ${new Date().toISOString()}                        ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝

📋 Ready to accept requests!
Test health: GET http://localhost:${PORT}/health
API docs: GET http://localhost:${PORT}/api/v1
      `);
      
      process.env.SERVER_STARTED = 'true';
    });
    
    // Error handling
    server.on('error', (error) => {
      console.error('❌ [SERVER] Server error:', error.message);
      if (error.code === 'EADDRINUSE') {
        console.error(`   → Port ${PORT} is already in use`);
        console.error(`   → Try: netstat -ano | findstr :${PORT} (Windows)`);
        console.error(`   → Or: lsof -i :${PORT} (Mac/Linux)`);
      }
    });
    
    // Graceful shutdown
    const shutdownHandler = (signal) => {
      console.log(`\n⏹️  [SERVER] ${signal} received, shutting down gracefully...`);
      
      if (server) {
        server.close(() => {
          console.log('✅ [SERVER] Server closed');
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
      
      // Force exit after 10 seconds
      setTimeout(() => {
        console.error('❌ [SERVER] Forced shutdown after 10s');
        process.exit(1);
      }, 10000);
    };
    
    process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
    process.on('SIGINT', () => shutdownHandler('SIGINT'));
    
    // Periodic heartbeat (proves process is alive)
    setInterval(() => {
      if (process.env.SERVER_STARTED) {
        console.log(`📍 [HEARTBEAT] ${new Date().toISOString()}`);
      }
    }, 60000);
    
  } catch (error) {
    console.error('\n❌ [SERVER] Startup failed!');
    console.error(`Error: ${error.message}\n`);
    
    // Exit with failure code
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ [SERVER] Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  
  if (!process.env.SERVER_STARTED) {
    process.exit(1);
  }
});

process.on('uncaughtException', (error) => {
  console.error('❌ [SERVER] Uncaught Exception:', error);
  
  if (!process.env.SERVER_STARTED) {
    process.exit(1);
  }
});

// Start server
startServer().catch((error) => {
  console.error('❌ [SERVER] Failed to start:', error.message);
  process.exit(1);
});