/**
 * Health Check Utility (Issue #14 fix)
 * Provides comprehensive system health status
 */

const { sequelize } = require('../models');

/**
 * Check database connection
 */
exports.checkDatabase = async () => {
  try {
    await sequelize.authenticate();
    return {
      status: 'healthy',
      message: 'Database connected'
    };
  } catch (err) {
    console.error('[Health Check] Database error:', err.message);
    return {
      status: 'unhealthy',
      error: err.message
    };
  }
};

/**
 * Check memory usage
 */
exports.checkMemory = () => {
  const memUsage = process.memoryUsage();
  const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

  return {
    heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
    heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
    heapUsedPercent: `${heapUsedPercent.toFixed(2)}%`,
    external: `${(memUsage.external / 1024 / 1024).toFixed(2)} MB`,
    rss: `${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`,
    status: heapUsedPercent > 90 ? 'warning' : 'healthy'
  };
};

/**
 * Get system uptime
 */
exports.getUptime = () => {
  const uptimeSeconds = process.uptime();
  const days = Math.floor(uptimeSeconds / (24 * 60 * 60));
  const hours = Math.floor((uptimeSeconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((uptimeSeconds % (60 * 60)) / 60);

  return {
    seconds: uptimeSeconds,
    formatted: `${days}d ${hours}h ${minutes}m`,
    lastRestart: new Date(Date.now() - uptimeSeconds * 1000)
  };
};

/**
 * Comprehensive health check
 */
exports.getFullHealth = async () => {
  const [dbCheck, memory] = await Promise.all([
    exports.checkDatabase(),
    Promise.resolve(exports.checkMemory())
  ]);

  const uptime = exports.getUptime();

  const overallStatus = dbCheck.status === 'healthy' && memory.status !== 'warning'
    ? 'healthy'
    : 'warning';

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    service: {
      name: 'FuelSync Backend API',
      version: process.env.API_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version
    },
    uptime,
    database: dbCheck,
    memory,
    checks: {
      database: dbCheck.status === 'healthy' ? 'pass' : 'fail',
      memory: memory.status !== 'warning' ? 'pass' : 'warn'
    }
  };
};
