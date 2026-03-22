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

const { createContextLogger } = require('./services/loggerService');
const logger = createContextLogger('Server');

logger.info('Node process starting...');

// Validate critical environment variables BEFORE loading app
logger.info('Validating environment variables...');
const hasJwtSecret = !!process.env.JWT_SECRET;

if (!hasJwtSecret) {
  logger.warn('JWT_SECRET not set - using hardcoded fallback (for production, set JWT_SECRET env var)');
} else {
  logger.info('JWT_SECRET is configured');
}

const app = require('./app');
const { initializeDatabase } = require('./database/init');

const PORT = process.env.PORT || 3001;

/**
 * Main entry point
 */
async function startServer() {
  let server = null;
  
  try {
    logger.info('Initializing database...');
    
    // Step 1-5: Database initialization (with detailed logging)
    const db = await initializeDatabase();
    
    // Step 6: Start Express server AFTER database is ready
    logger.info('Starting Express server...');
    
    server = app.listen(PORT, '0.0.0.0', () => {
      logger.info('FuelSync API Server STARTED', { port: PORT, database: 'Connected', schema: 'Verified', migrations: 'Complete' });
      logger.info('Ready to accept requests', { healthCheck: `/health`, apiDocs: `/api/v1` });
      process.env.SERVER_STARTED = 'true';
    });
    
    // Error handling
    server.on('error', (error) => {
      logger.error('Server error', error.message);
      if (error.code === 'EADDRINUSE') {
      logger.warn('Port already in use', { port: PORT });
      logger.info('Diagnostic commands', { windows: `netstat -ano | findstr :${PORT}`, unix: `lsof -i :${PORT}` });
      }
    });
    
    // Graceful shutdown
    const shutdownHandler = (signal) => {
      logger.info('Shutdown signal received', { signal });
      
      if (server) {
        server.close(() => {
          logger.info('Server closed successfully');
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
      
      // Force exit after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after 10s');
        process.exit(1);
      }, 10000);
    };
    
    process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
    process.on('SIGINT', () => shutdownHandler('SIGINT'));
    
    // Periodic heartbeat (proves process is alive)
    setInterval(() => {
      if (process.env.SERVER_STARTED) {
        logger.debug('Heartbeat', { timestamp: new Date().toISOString() });
      }
    }, 60000);
    
  } catch (error) {
    logger.error('Startup failed', { message: error.message });
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { promise: String(promise), reason });
  
  if (!process.env.SERVER_STARTED) {
    process.exit(1);
  }
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { message: error.message });
  
  if (!process.env.SERVER_STARTED) {
    process.exit(1);
  }
});

// Start server
startServer().catch((error) => {
  logger.error('Failed to start server', { message: error.message });
  process.exit(1);
});