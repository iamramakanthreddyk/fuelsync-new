
const app = require('./app');
const { sequelize } = require('./config/database');

const PORT = process.env.PORT || 5000;

// Database connection and server start
const startServer = async () => {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
    
    // Sync database models (use with caution in production)
    if (process.env.NODE_ENV !== 'production') {
      await sequelize.sync();
      console.log('✅ Database models synchronized.');
    }
    
    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 FuelSync API Server running on port ${PORT}`);
      console.log(`📖 API Documentation: http://localhost:${PORT}/api/v1/docs`);
      console.log(`🔍 Health Check: http://localhost:${PORT}/api/v1/health`);
    });
    
  } catch (error) {
    console.error('❌ Unable to start server:', error);
    process.exit(1);
  }
};

startServer();
