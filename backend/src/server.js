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
    // Production: Force sync schema changes (needed for UUID migration)
    // This will drop and recreate tables to fix type mismatches
    // After successful deployment, we can revert to alter:true
    const isProduction = process.env.NODE_ENV === 'production';
    const shouldForce = isProduction;  // Always force in production for schema fixes
    
    if (shouldForce) {
      console.log('⚠️  Recreating database schema to fix type mismatches...');
    }
    
    await syncDatabase({ force: shouldForce, alter: false });
    
    // Seed essential data (plans, admin user)
    await seedEssentials();
    
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

📋 Available Endpoints:
   POST   /api/v1/auth/login
   POST   /api/v1/auth/register
   GET    /api/v1/auth/me
   
   GET    /api/v1/stations
   POST   /api/v1/stations
   GET    /api/v1/stations/:id
   GET    /api/v1/stations/:id/pumps
   POST   /api/v1/stations/:id/pumps
   GET    /api/v1/stations/:id/prices
   POST   /api/v1/stations/:id/prices
   
   GET    /api/v1/readings
   POST   /api/v1/readings
   GET    /api/v1/readings/previous/:nozzleId
   
   GET    /api/v1/dashboard/summary
   GET    /api/v1/dashboard/daily
   GET    /api/v1/dashboard/fuel-breakdown
   GET    /api/v1/dashboard/pump-performance

🔑 Default Admin: admin@fuelsync.com / admin123
      `);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
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
