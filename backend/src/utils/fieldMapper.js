/**
 * Field Mapper
 * Normalizes field names across all endpoints to a canonical form
 * Handles both snake_case and camelCase variations
 * 
 * Usage:
 *   const normalized = fieldMapper.normalizeRecord(salesRecord);
 *   const array = fieldMapper.normalizeArray(salesRecords);
 */

const CANONICAL_FIELD_MAPPING = {
  // Identifiers (always camelCase)
  stationId: ['stationId', 'station_id', 'sid'],
  nozzleId: ['nozzleId', 'nozzle_id', 'nid'],
  pumpId: ['pumpId', 'pump_id', 'pid'],
  userId: ['userId', 'user_id', 'uid'],
  creditorId: ['creditorId', 'creditor_id'],
  transactionId: ['transactionId', 'transaction_id', 'txnId'],
  shiftId: ['shiftId', 'shift_id'],
  expenseId: ['expenseId', 'expense_id'],

  // Quantities
  litres: ['litres', 'quantity', 'volume', 'delta_volume_l', 'liters'],
  amount: ['amount', 'totalAmount', 'total_amount', 'sales', 'revenue'],
  price: ['price', 'pricePerLitre', 'price_per_litre', 'unitPrice'],

  // Payment Breakdown
  payment: ['payment_breakdown', 'paymentBreakdown', 'payment', 'payment_breakDown'],

  // Dates
  date: ['date', 'readingDate', 'reading_date', 'transactionDate', 'transaction_date', 'createdDate'],
  createdAt: ['createdAt', 'created_at', 'createdDate'],
  updatedAt: ['updatedAt', 'updated_at', 'modifiedDate'],

  // Status/flags
  status: ['status', 'state'],
  isActive: ['isActive', 'is_active', 'active'],
  isSample: ['isSample', 'is_sample'],

  // Counts/Stats
  count: ['count', 'total', 'totalCount', 'totalQuantity', 'transaction_count'],
  readings: ['readings', 'entry_count', 'entryCount', 'readingCount'],

  // Names/Labels
  name: ['name', 'title'],
  label: ['label', 'text', 'description'],

  // User fields
  enteredBy: ['enteredBy', 'entered_by', 'enteredByUser'],
  enteredByUser: ['enteredByUser', 'entered_by_user'],

  // Nozzle/Pump fields
  fuelType: ['fuelType', 'fuel_type'],
  nozzleNumber: ['nozzleNumber', 'nozzle_number'],
  pumpNumber: ['pumpNumber', 'pump_number']
};

/**
 * Normalize a single record
 * Maps all variations of field names to canonical form
 */
function normalizeRecord(record) {
  if (!record || typeof record !== 'object') {
    return record;
  }

  const normalized = {};

  // Map canonical fields from alternatives
  for (const [canonical, aliases] of Object.entries(CANONICAL_FIELD_MAPPING)) {
    for (const alias of aliases) {
      if (alias in record) {
        normalized[canonical] = record[alias];
        break; // Use first found
      }
    }
  }

  // Keep any non-aliased fields as-is
  const allAliases = new Set(Object.values(CANONICAL_FIELD_MAPPING).flat());
  for (const [key, value] of Object.entries(record)) {
    if (!allAliases.has(key) && !(key in normalized)) {
      normalized[key] = value;
    }
  }

  return normalized;
}

/**
 * Normalize an array of records
 */
function normalizeArray(records) {
  if (!Array.isArray(records)) {
    return records;
  }
  return records.map(normalizeRecord);
}

/**
 * Normalize nested objects and arrays recursively
 */
function normalizeDeep(obj) {
  if (Array.isArray(obj)) {
    return obj.map(normalizeDeep);
  }

  if (obj !== null && typeof obj === 'object') {
    const normalized = normalizeRecord(obj);
    
    // Recursively normalize nested objects
    for (const [key, value] of Object.entries(normalized)) {
      if (value !== null && typeof value === 'object') {
        normalized[key] = normalizeDeep(value);
      }
    }
    
    return normalized;
  }

  return obj;
}

/**
 * Convert field name to snake_case (for database queries)
 */
function toSnakeCase(camelCase) {
  return camelCase
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

/**
 * Convert field name to camelCase (for API responses)
 */
function toCamelCase(snake_case) {
  return snake_case
    .replace(/_([a-z])/g, g => g[1].toUpperCase())
    .toLowerCase();
}

module.exports = {
  normalizeRecord,
  normalizeArray,
  normalizeDeep,
  toSnakeCase,
  toCamelCase,
  CANONICAL_FIELD_MAPPING
};
