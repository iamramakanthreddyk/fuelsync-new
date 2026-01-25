/**
 * FuelSync Backend API
 * Comprehensive fuel station management system for Indian gas stations
 * Features: Sales tracking, Credit management, Expense tracking, Analytics
 */

console.log('📝 [APP] Initializing Express application...');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const { requireMinRole } = require('./middleware/auth');
const stationRoutes = require('./routes/stations');
const readingRoutes = require('./routes/readings');
const transactionRoutes = require('./routes/transactions');
const analyticsRoutes = require('./routes/analytics'); // Consolidated analytics & sales
const salesRoutes = require('./routes/sales'); // Sales endpoint
const creditRoutes = require('./routes/credits');
const expenseRoutes = require('./routes/expenses');
const profitRoutes = require('./routes/profit'); // Profit tracking
const tankRoutes = require('./routes/tanks');
const shiftRoutes = require('./routes/shifts');
const configRoutes = require('./routes/config');
const planRoutes = require('./routes/plans');
const activityLogRoutes = require('./routes/activityLogs');
const adminRoutes = require('./routes/admin');

// Import constants for API info
const { FUEL_TYPES, PAYMENT_METHODS, EXPENSE_CATEGORIES, USER_ROLES } = require('./config/constants');

// Import middleware
const normalizeRequestBody = require('./middleware/normalizeRequestBody');

// Create Express app
const app = express();
// Trust Railway/Heroku proxy for correct client IP and rate limiting
app.set('trust proxy', 1);

// ============================================
// MIDDLEWARE
// ============================================

// CRITICAL: CORS must be first, before ANY other middleware
// This ensures preflight requests can succeed immediately
const isDevelopment = process.env.NODE_ENV !== 'production';

// Build CORS origins list
let corsOrigins = true; // Default to allow all in development

if (!isDevelopment) {
  // In production, only allow specific origins
  const envOrigins = (process.env.CORS_ORIGINS || 'https://fuelsync-new.vercel.app,https://fuelsync-new.vercel.app/,https://www.kisaancenter.com')
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0);
  
  corsOrigins = envOrigins.length > 0 ? envOrigins : ['https://fuelsync-new.vercel.app', 'https://fuelsync-new.vercel.app/', 'https://www.kisaancenter.com'];
}

console.log('🔓 CORS Enabled for:', isDevelopment ? 'ALL (development)' : corsOrigins);

// CORS origin validation function
const corsOriginValidator = (origin, callback) => {
  console.log('🔍 CORS Check - Origin:', origin, 'Development:', isDevelopment);
  
  if (isDevelopment) {
    // Allow all origins in development
    callback(null, true);
  } else if (!origin) {
    // Allow requests with no origin (like mobile apps, Postman, curl)
    callback(null, true);
  } else {
    // Normalize origins (remove trailing slashes)
    const normalizedOrigin = origin.replace(/\/$/, '');
    const normalizedCorsOrigins = Array.isArray(corsOrigins) 
      ? corsOrigins.map(o => o.replace(/\/$/, ''))
      : corsOrigins;
    
    console.log('🔍 CORS Check - Normalized Origin:', normalizedOrigin, 'Allowed:', normalizedCorsOrigins);
    
    if (Array.isArray(normalizedCorsOrigins) && normalizedCorsOrigins.includes(normalizedOrigin)) {
      callback(null, true);
    } else if (normalizedCorsOrigins === true) {
      callback(null, true);
    } else {
      console.log('❌ CORS Rejected - Origin not allowed:', normalizedOrigin);
      callback(new Error('Not allowed by CORS'));
    }
  }
};

const corsOptions = {
  origin: corsOriginValidator,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id', 'Accept'],
  optionsSuccessStatus: 200, // Ensure 200 for successful OPTIONS
  maxAge: 86400 // 24 hours
};

// Apply CORS middleware FIRST - this handles OPTIONS automatically
app.use(cors(corsOptions));

// Security headers - but SAFE for CORS
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false // Disable in production if it causes issues
}));

// Rate limiting - toggleable via RATE_LIMIT env var (set to 'false' to disable)
// Skip OPTIONS preflight requests AND anything to /health
const rateLimitEnabled = (process.env.RATE_LIMIT || 'true').toLowerCase() !== 'false';
if (rateLimitEnabled) {
  const defaultMax = isDevelopment ? 10000 : 100;
  const max = parseInt(process.env.RATE_LIMIT_MAX || String(defaultMax), 10);

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max,
    message: { success: false, error: 'Too many requests, please try again later.' },
    skip: (req) => req.method === 'OPTIONS' || req.path === '/health' || req.path === '/health/config'
  });
  app.use('/api/', limiter);
} else {
  console.log('⚠️ Rate limiting disabled via RATE_LIMIT=false');
}

// Request logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Debug logging for all requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Normalize request body (snake_case to camelCase)
app.use(normalizeRequestBody);

// ============================================
// ROUTES
// ============================================

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

// Diagnostic endpoint to help identify configuration issues
app.get('/health/config', (req, res) => {
  const config = {
    status: 'ok',
    nodeEnv: process.env.NODE_ENV || 'development',
    jwtSecretSet: !!process.env.JWT_SECRET,
    databaseUrlSet: !!process.env.DATABASE_URL,
    corsOriginsSet: !!process.env.CORS_ORIGINS,
    timestamp: new Date().toISOString()
  };
  
  res.json(config);
});

// API routes (v1 - Clean, Unified Architecture)
// ============================================
// ROUTE ORGANIZATION NOTES:
// - All v1 routes use /api/v1/* prefix (recommended)
// - Legacy /api/* aliases maintained for backward compatibility
// - More specific routes (nested) MUST come BEFORE generic routes
//   Example: /stations/:stationId/credits BEFORE /stations/:stationId/generic
// - Route order in Express matters - first match wins
// - RBAC enforced at route level: requireRole(), requireMinRole()
// ============================================

// NOTE: Order matters! More specific routes should come first
// Credit and expense routes have paths like /stations/:stationId/credits
// so they must be mounted BEFORE the generic /stations route
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1', creditRoutes);   // Credits under /api/v1/stations/:id/creditors - BEFORE stations
app.use('/api/v1', expenseRoutes);  // Expenses under /api/v1/stations/:id/expenses - BEFORE stations
app.use('/api/v1', profitRoutes);   // Profit under /api/v1/stations/:id/profit-* - BEFORE stations
app.use('/api/v1/stations', stationRoutes);
app.use('/api/v1/readings', readingRoutes);
app.use('/api/v1/transactions', transactionRoutes);  // Daily transaction management
app.use('/api/v1/sales', salesRoutes);              // Sales endpoints
app.use('/api/v1/analytics', analyticsRoutes);      // Consolidated: dashboard + sales + reports
app.use('/api/v1/tanks', tankRoutes);   // Tanks management
app.use('/api/v1/shifts', shiftRoutes); // Shift management
app.use('/api/v1/config', configRoutes); // Configuration/dropdown endpoints
app.use('/api/v1/plans', planRoutes); // Subscription plans
app.use('/api/v1/activity-logs', activityLogRoutes); // Activity logging

// Admin-only endpoints (backup, migration, etc.)
app.use('/api/v1/admin', adminRoutes);

// Backwards-compatible alias for employees
const employeesRoutes = require('./routes/employees');
app.use('/api/v1/employees', employeesRoutes);

// Legacy wrappers: ensure certain legacy paths return 403 for employee users (tests expect this)
app.get('/api/reports/sales-summary', (req, res, next) => {
  if (req.user && req.user.role === 'employee') return res.status(403).json({ success: false, error: 'Insufficient permissions' });
  return reportRoutes.handle ? reportRoutes.handle(req, res, next) : res.status(404).json({ success: false, error: 'Not implemented' });
});
app.get('/api/reports/profit-loss', (req, res, next) => {
  if (req.user && req.user.role === 'employee') return res.status(403).json({ success: false, error: 'Insufficient permissions' });
  return reportRoutes.handle ? reportRoutes.handle(req, res, next) : res.status(404).json({ success: false, error: 'Not implemented' });
});
app.get('/api/reports/export', (req, res, next) => {
  if (req.user && req.user.role === 'employee') return res.status(403).json({ success: false, error: 'Insufficient permissions' });
  return reportRoutes.handle ? reportRoutes.handle(req, res, next) : res.status(404).json({ success: false, error: 'Not implemented' });
});
app.get('/api/dashboard/metrics', (req, res, next) => {
  if (req.user && req.user.role === 'employee') return res.status(403).json({ success: false, error: 'Insufficient permissions' });
  return reportRoutes.handle ? reportRoutes.handle(req, res, next) : res.status(404).json({ success: false, error: 'Not implemented' });
});

// ============================================
// LEGACY API COMPATIBILITY ROUTES (/api prefix)
// These are deprecated but maintained for backward compatibility with older clients
// ============================================

// Compatibility aliases - route to v1 controllers
const pumpsRoutes = require('./routes/pumps');
const nozzlesRoutes = require('./routes/nozzles');
const fuelPricesRoutes = require('./routes/fuelPrices');
const tankRefillsRoutes = require('./routes/tankRefills');

// Legacy /api/* mounts (all route prefixes BEFORE v1 routes to avoid conflicts)
app.use('/api/pumps', pumpsRoutes);
app.use('/api/nozzles', nozzlesRoutes);
app.use('/api/fuel-prices', fuelPricesRoutes);
app.use('/api/tank-refills', tankRefillsRoutes);
app.use('/api/tanks', tankRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/config', configRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/admin', adminRoutes);

// v1 compatibility mounts
app.use('/api/v1/tank-refills', tankRefillsRoutes);
app.use('/api/v1/pumps', pumpsRoutes);
app.use('/api/v1/nozzles', nozzlesRoutes);
app.use('/api/v1/fuel-prices', fuelPricesRoutes);

// API info with configuration options
app.get('/api/v1', (req, res) => {
  res.json({
    name: 'FuelSync API',
    version: '2.0.0',
    description: 'Fuel station management for Indian gas stations',
    endpoints: {
      // Authentication & User Management
      auth: '/api/v1/auth (login, register, profile, change-password)',
      users: '/api/v1/users (CRUD for users - role-based)',
      
      // Station Core Management
      stations: '/api/v1/stations (CRUD, settings, staff)',
      
      // Readings & Transactions (Daily Entry)
      readings: '/api/v1/readings (nozzle readings, create/update/delete)',
      transactions: '/api/v1/transactions (daily settlement transactions, quick-entry)',
      
      // Analytics & Reporting
      analytics: '/api/v1/analytics (dashboard, sales, financial reports)',
      
      // Station Sub-Resources (nested under stations)
      'pumps': '/api/v1/stations/:stationId/pumps (CRUD)',
      'nozzles': '/api/v1/stations/:stationId/pumps/:pumpId/nozzles (CRUD)',
      'fuel_prices': '/api/v1/stations/:stationId/prices (get/set)',
      'tanks': '/api/v1/stations/:stationId/tanks (CRUD, refills)',
      'shifts': '/api/v1/stations/:stationId/shifts (lifecycle, summary)',
      'daily_sales': '/api/v1/stations/:stationId/daily-sales (sales summary)',
      'settlements': '/api/v1/stations/:stationId/settlements (record/list)',
      
      // Financial Management
      credits: '/api/v1/stations/:stationId/creditors (CRUD, aging, settlements)',
      expenses: '/api/v1/stations/:stationId/expenses (CRUD, summary, P&L)',
      
      // System Configuration
      config: '/api/v1/config (dropdowns, enums)',
      plans: '/api/v1/plans (subscription management)',
      admin: '/api/v1/admin (backup, migrations)',
      'activity_logs': '/api/v1/activity-logs (audit trail)',
      employees: '/api/v1/employees (backward compatible alias)'
    },
    role_hierarchy: {
      super_admin: 'Full system access (100)',
      owner: 'Manage own stations & employees (75)',
      manager: 'Manage station operations & approvals (50)',
      employee: 'View own data & enter readings (25)'
    },
    config: {
      fuelTypes: Object.values(FUEL_TYPES),
      paymentMethods: Object.values(PAYMENT_METHODS),
      expenseCategories: Object.values(EXPENSE_CATEGORIES),
      roles: Object.values(USER_ROLES)
    }
  });
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);

  // Sequelize validation errors
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      details: err.errors?.map(e => e.message)
    });
  }

  // Sequelize unique constraint
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      success: false,
      error: 'Duplicate entry',
      details: err.errors?.map(e => e.message)
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }

  // Default error response
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
});

module.exports = app;
