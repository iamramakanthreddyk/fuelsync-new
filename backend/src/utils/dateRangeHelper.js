/**
 * Date Range Helper Utility
 * 
 * Centralized date filtering logic to avoid duplication
 * Used by: readingController, reportController, dashboardController, employeeSalesService, etc.
 * 
 * PROBLEM SOLVED:
 * - Date range logic repeated 15+ times across controllers/services
 * - Each had slightly different implementations
 * - Inconsistent default date calculations
 * - Hard to update date logic globally
 * 
 * SOLUTION:
 * - Single source for date range handling
 * - Consistent defaults and validation
 * - Easy to extend with timezone support
 */

const { Op } = require('sequelize');

/**
 * Parse start and end dates from query params
 * @param {string} [startDate] - ISO date string or Date
 * @param {string} [endDate] - ISO date string or Date
 * @param {number} [defaultDays=7] - Default lookback window in days
 * @returns {Object} { startDate, endDate }
 */
const getDateRange = (startDate, endDate, defaultDays = 7) => {
  try {
    const end = endDate ? new Date(endDate) : new Date();
    // Set end time to end of day
    end.setHours(23, 59, 59, 999);

    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - defaultDays * 24 * 60 * 60 * 1000);
    // Set start time to beginning of day
    start.setHours(0, 0, 0, 0);

    // Validation: end should not be before start
    if (end < start) {
      throw new Error('End date cannot be before start date');
    }

    return { startDate: start, endDate: end };
  } catch (error) {
    throw new Error(`Invalid date range: ${error.message}`);
  }
};

/**
 * Build Sequelize WHERE clause for date range filtering
 * @param {string} [startDate] - ISO date string
 * @param {string} [endDate] - ISO date string
 * @param {string} [fieldName='createdAt'] - Database field to filter on
 * @param {number} [defaultDays=7] - Default lookback in days
 * @returns {Object} Sequelize WHERE clause
 */
const buildDateRangeWhere = (startDate, endDate, fieldName = 'createdAt', defaultDays = 7) => {
  const { startDate: start, endDate: end } = getDateRange(startDate, endDate, defaultDays);

  return {
    [fieldName]: {
      [Op.gte]: start,
      [Op.lte]: end
    }
  };
};

/**
 * Build date range WHERE for multiple fields
 * @param {string} [startDate] - ISO date
 * @param {string} [endDate] - ISO date
 * @param {Array<string>} fieldNames - Fields to OR together
 * @param {number} [defaultDays=7] - Default lookback
 * @returns {Object} Sequelize WHERE with [Op.or]
 */
const buildMultiFieldDateRange = (startDate, endDate, fieldNames = ['createdAt'], defaultDays = 7) => {
  const { startDate: start, endDate: end } = getDateRange(startDate, endDate, defaultDays);

  return {
    [Op.or]: fieldNames.map(field => ({
      [field]: {
        [Op.gte]: start,
        [Op.lte]: end
      }
    }))
  };
};

/**
 * Format date for query string
 * @param {Date} date - Date object
 * @returns {string} YYYY-MM-DD format
 */
const formatDateForQuery = (date) => {
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
};

/**
 * Parse date from YYYY-MM-DD format
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @param {boolean} [endOfDay=false] - Set to end of day vs start
 * @returns {Date}
 */
const parseQueryDate = (dateString, endOfDay = false) => {
  const date = new Date(dateString);
  if (!dateString || isNaN(date.getTime())) {
    throw new Error(`Invalid date format: ${dateString}`);
  }

  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }

  return date;
};

/**
 * Get date range for common periods
 * @param {string} period - 'today', 'yesterday', 'thisWeek', 'lastWeek', 'thisMonth', 'lastMonth', 'thisYear'
 * @returns {Object} { startDate, endDate }
 */
const getDateRangeByPeriod = (period = 'thisWeek') => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const ranges = {
    today: {
      startDate: today,
      endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000)
    },
    yesterday: {
      startDate: new Date(today.getTime() - 24 * 60 * 60 * 1000),
      endDate: today
    },
    thisWeek: {
      startDate: new Date(today.getTime() - today.getDay() * 24 * 60 * 60 * 1000),
      endDate: new Date(today.getTime() + (7 - today.getDay()) * 24 * 60 * 60 * 1000)
    },
    lastWeek: {
      startDate: new Date(today.getTime() - (today.getDay() + 7) * 24 * 60 * 60 * 1000),
      endDate: new Date(today.getTime() - today.getDay() * 24 * 60 * 60 * 1000)
    },
    thisMonth: {
      startDate: new Date(today.getFullYear(), today.getMonth(), 1),
      endDate: new Date(today.getFullYear(), today.getMonth() + 1, 0)
    },
    lastMonth: {
      startDate: new Date(today.getFullYear(), today.getMonth() - 1, 1),
      endDate: new Date(today.getFullYear(), today.getMonth(), 0)
    },
    thisYear: {
      startDate: new Date(today.getFullYear(), 0, 1),
      endDate: new Date(today.getFullYear(), 11, 31)
    }
  };

  return ranges[period] || ranges.thisWeek;
};

/**
 * Check if two date ranges overlap
 * @param {Date} start1
 * @param {Date} end1
 * @param {Date} start2
 * @param {Date} end2
 * @returns {boolean}
 */
const dateRangesOverlap = (start1, end1, start2, end2) => {
  return start1 <= end2 && start2 <= end1;
};

/**
 * Calculate days between two dates
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {number}
 */
const getDaysBetween = (startDate, endDate) => {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((endDate - startDate) / msPerDay);
};

module.exports = {
  getDateRange,
  buildDateRangeWhere,
  buildMultiFieldDateRange,
  formatDateForQuery,
  parseQueryDate,
  getDateRangeByPeriod,
  dateRangesOverlap,
  getDaysBetween
};
