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
    const syncSuccess = await syncDatabase({ force: false, alter: true });
    
    // Seed if sync was successful
    if (syncSuccess) {
      try {
        await seedEssentials();
      } catch (seedError) {
        console.warn('⚠️  Seeding error (non-critical):');
        console.warn(seedError.message.substring(0, 200));
        // Continue anyway - seeding is not critical
      }
    } else {
      console.warn('⚠️  Database sync failed, skipping seed');
    }
    
    // Start server regardless of database status
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
    console.error('❌ Startup error:', error.message);
    // Still start the server
    app.listen(PORT, () => {
      console.log(`⚠️  Server started on port ${PORT} (errors occurred)`);
    });
  }
};

// Handle uncaught exceptions - log but don't exit
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit - keep the container alive so Railway can restart it
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
  // Don't exit - keep the container alive so Railway can restart it
});

// Start the server
startServer();
