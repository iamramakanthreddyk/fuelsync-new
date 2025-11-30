/**
 * FuelSync Server Entry Point
 * Starts the server and syncs database
 */

console.log('🚀 [SERVER] Node process starting...');

const app = require('./app');

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

server.on('error', (error) => {
  console.error('❌ [SERVER] Server error:', error.message);
  console.error(error.stack);
});

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
