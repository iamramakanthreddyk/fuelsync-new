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
  try {
    console.log('🚀 [SERVER] Initializing database...\n');
    
    // Step 1-5: Database initialization (with detailed logging)
    const db = await initializeDatabase();
    
    // Step 6: Start Express server AFTER database is ready
    console.log('🌍 [SERVER] Starting Express server...\n');
    
    const server = app.listen(PORT, '0.0.0.0', () => {
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
    process.on('SIGTERM', () => {
      console.log('\n⏹️  [SERVER] SIGTERM received, shutting down gracefully...');
      server.close(() => {
        console.log('✅ [SERVER] Server closed');
        process.exit(0);
      });
    });
    
    process.on('SIGINT', () => {
      console.log('\n⏹️  [SERVER] SIGINT received, shutting down gracefully...');
      server.close(() => {
        console.log('✅ [SERVER] Server closed');
        process.exit(0);
      });
    });
    
    // Periodic heartbeat (proves process is alive)
    setInterval(() => {
      console.log(`📍 [HEARTBEAT] ${new Date().toISOString()}`);
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
});

process.on('uncaughtException', (error) => {
  console.error('❌ [SERVER] Uncaught Exception:', error);
  // Only exit on startup errors, not runtime errors
  if (!process.env.SERVER_STARTED) {
    process.exit(1);
  }
});

// Start server
startServer().then(() => {
  process.env.SERVER_STARTED = 'true';
}).catch((error) => {
  console.error('❌ [SERVER] Failed to start:', error.message);
  process.exit(1);
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
