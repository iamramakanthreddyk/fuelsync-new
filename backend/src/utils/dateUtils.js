/**
 * Standardized date utilities to ensure consistent timestamp handling
 */

/**
 * Converts any date input to a standard date format (YYYY-MM-DD)
 * @param {Date|string} date - Date object or string
 * @returns {string} Standardized date string in YYYY-MM-DD format
 */
function toStandardDate(date) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toISOString().split('T')[0];
}

/**
 * Converts any date input to a standard datetime format
 * @param {Date|string} date - Date object or string
 * @param {boolean} startOfDay - If true, returns start of day (00:00:00), otherwise end of day (23:59:59)
 * @returns {Date} Date object set to start or end of the specified day
 */
function toStandardDateTime(date, startOfDay = true) {
  const dateStr = toStandardDate(date);
  return new Date(`${dateStr}T${startOfDay ? '00:00:00' : '23:59:59'}.000Z`);
}

/**
 * Checks if two dates are the same day, ignoring time
 * @param {Date|string} date1 - First date
 * @param {Date|string} date2 - Second date
 * @returns {boolean} True if dates are the same day
 */
function isSameDay(date1, date2) {
  return toStandardDate(date1) === toStandardDate(date2);
}

/**
 * Get date range for common periods
 * @param {string} period - 'today', 'yesterday', 'week', 'month', 'year'
 * @returns {{start: Date, end: Date}}
 */
function getDateRange(period) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (period) {
    case 'today':
      return {
        start: toStandardDateTime(today, true),
        end: toStandardDateTime(today, false)
      };
    
    case 'yesterday':
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return {
        start: toStandardDateTime(yesterday, true),
        end: toStandardDateTime(yesterday, false)
      };
    
    case 'week':
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - 7);
      return {
        start: toStandardDateTime(weekStart, true),
        end: toStandardDateTime(today, false)
      };
    
    case 'month':
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return {
        start: toStandardDateTime(monthStart, true),
        end: toStandardDateTime(today, false)
      };
    
    case 'year':
      const yearStart = new Date(today.getFullYear(), 0, 1);
      return {
        start: toStandardDateTime(yearStart, true),
        end: toStandardDateTime(today, false)
      };
    
    default:
      return {
        start: toStandardDateTime(today, true),
        end: toStandardDateTime(today, false)
      };
  }
}

/**
 * Format date for display
 * @param {Date|string} date - Date to format
 * @param {string} format - 'short', 'medium', 'long'
 * @returns {string}
 */
function formatDate(date, format = 'medium') {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const options = {
    short: { month: 'short', day: 'numeric' },
    medium: { year: 'numeric', month: 'short', day: 'numeric' },
    long: { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }
  };
  
  return dateObj.toLocaleDateString('en-US', options[format] || options.medium);
}

module.exports = {
  toStandardDate,
  toStandardDateTime,
  isSameDay,
  getDateRange,
  formatDate
};
