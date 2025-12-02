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
const stationRoutes = require('./routes/stations');
const readingRoutes = require('./routes/readings');
const dashboardRoutes = require('./routes/dashboard');
const creditRoutes = require('./routes/credits');
const expenseRoutes = require('./routes/expenses');
const tankRoutes = require('./routes/tanks');
const shiftRoutes = require('./routes/shifts');
const handoverRoutes = require('./routes/handovers');
const configRoutes = require('./routes/config');
const planRoutes = require('./routes/plans');
const activityLogRoutes = require('./routes/activityLogs');
const salesRoutes = require('./routes/sales');
const reportRoutes = require('./routes/reports');
const adminRoutes = require('./routes/admin');

// Import constants for API info
const { FUEL_TYPES, PAYMENT_METHODS, EXPENSE_CATEGORIES, USER_ROLES } = require('./config/constants');


// Create Express app
const app = express();
// Trust Railway/Heroku proxy for correct client IP and rate limiting
app.set('trust proxy', 1);

// ============================================
// MIDDLEWARE
// ============================================

// CORS - Must be before helmet to handle preflight requests
const isDevelopment = process.env.NODE_ENV !== 'production';

// Build CORS origins list
let corsOrigins = true; // Default to allow all in development

if (!isDevelopment) {
  // In production, only allow specific origins
  const envOrigins = (process.env.CORS_ORIGINS || 'https://fuelsync-new.vercel.app')
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0);
  
  corsOrigins = envOrigins.length > 0 ? envOrigins : ['https://fuelsync-new.vercel.app'];
}

console.log('🔓 CORS Enabled for:', isDevelopment ? 'ALL (development)' : corsOrigins);

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id'],
  maxAge: 86400 // 24 hours
}));

// Security headers - configure for development
app.use(helmet({
  crossOriginResourcePolicy: isDevelopment ? false : { policy: 'same-origin' },
  crossOriginOpenerPolicy: isDevelopment ? false : { policy: 'same-origin' }
}));

// Rate limiting - skip OPTIONS preflight requests
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 1000 : 100, // Higher limit in development
  message: { success: false, error: 'Too many requests, please try again later.' },
  skip: (req) => req.method === 'OPTIONS' // Don't rate limit preflight requests
});
app.use('/api/', limiter);

// Request logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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

// API routes
// NOTE: Order matters! More specific routes should come first
// Credit and expense routes have paths like /stations/:stationId/credits
// so they must be mounted BEFORE the generic /stations route
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1', creditRoutes);   // Credits under /api/v1/stations/:id/creditors - BEFORE stations
app.use('/api/v1', expenseRoutes);  // Expenses under /api/v1/stations/:id/expenses - BEFORE stations
app.use('/api/v1/stations', stationRoutes);
app.use('/api/v1/readings', readingRoutes);
app.use('/api/v1/sales', salesRoutes); // Sales data from readings
app.use('/api/v1/reports', reportRoutes); // Comprehensive reports
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/tanks', tankRoutes);   // Tanks management
app.use('/api/v1/shifts', shiftRoutes); // Shift management
app.use('/api/v1/handovers', handoverRoutes); // Cash handover management
app.use('/api/v1/config', configRoutes); // Configuration/dropdown endpoints
app.use('/api/v1/plans', planRoutes); // Subscription plans
app.use('/api/v1/activity-logs', activityLogRoutes); // Activity logging

// Admin-only endpoints (backup, migration, etc.)
app.use('/api/v1/admin', adminRoutes);

// API info with configuration options
app.get('/api/v1', (req, res) => {
  res.json({
    name: 'FuelSync API',
    version: '2.0.0',
    description: 'Fuel station management for Indian gas stations',
    endpoints: {
      auth: '/api/v1/auth',
      users: '/api/v1/users',
      stations: '/api/v1/stations',
      readings: '/api/v1/readings',
      dashboard: '/api/v1/dashboard',
      reports: '/api/v1/reports',
      credits: '/api/v1/stations/:stationId/creditors',
      expenses: '/api/v1/stations/:stationId/expenses',
      tanks: '/api/v1/tanks',
      shifts: '/api/v1/shifts'
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
