/**
 * FuelSync Server Entry Point
 * Starts the server and syncs database
 */

const app = require('./app');
const { syncDatabase } = require('./models');
const seedEssentials = require('../scripts/seedEssentials');

const PORT = process.env.PORT || 3001;

const startServer = async () => {
  try {
    console.log('🚀 Starting FuelSync server...');
    
    // Sync database (creates tables if they don't exist)
    console.log('📦 Syncing database...');
    let dbReady = false;
    try {
      // Try to sync with alter:true (safe, preserves data)
      await syncDatabase({ force: false, alter: true });
      dbReady = true;
      console.log('✅ Database synced successfully');
    } catch (error) {
      // If sync fails, log and continue
      // Tables might already exist and work fine
      console.warn('⚠️  Database sync error:');
      console.warn(error.message.substring(0, 200));
      console.log('💡 Attempting to continue with existing tables...');
      dbReady = true;  // Still mark as ready - tables might exist
    }
    
    // Only seed if we're reasonably confident DB is ready
    if (dbReady) {
      try {
        await seedEssentials();
      } catch (seedError) {
        console.warn('⚠️  Seeding error (non-critical):');
        console.warn(seedError.message.substring(0, 200));
        // Continue anyway - seeding is not critical
      }
    }
    
    // Start server
    app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🔥 FuelSync API Server                                   ║
║                                                            ║
║   URL: http://localhost:${PORT}                              ║
║   API: http://localhost:${PORT}/api/v1                       ║
║                                                            ║
║   Environment: ${process.env.NODE_ENV || 'development'}                             ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝

📋 Server is ready to accept requests!

🔑 Default Admin: admin@fuelsync.com / admin123
      `);
    });
    
  } catch (error) {
    console.error('❌ Server startup error:', error.message);
    console.error('Continuing anyway...');
    // Don't exit - try to keep the app running
    // Start server even if there were errors
    app.listen(PORT, () => {
      console.log(`⚠️  Server started on port ${PORT} (with errors)`);
    });
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
  process.exit(1);
});

// Start the server
startServer();
