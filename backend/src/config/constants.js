/**
 * FuelSync Configuration Constants
 * Centralized, expandable configuration for fuel types, payment methods, etc.
 * 
 * IMPORTANT: This is the single source of truth for all configurable options.
 * To add a new fuel type, payment method, or expense category, simply add it here.
 */

module.exports = {
  /**
   * Fuel Types - Easily expandable
   * Add new fuel types here and they'll be available throughout the system
   */
  FUEL_TYPES: {
    PETROL: 'petrol',
    DIESEL: 'diesel',
    PREMIUM_PETROL: 'premium_petrol',  // Speed, Power, etc.
    PREMIUM_DIESEL: 'premium_diesel',
    CNG: 'cng',
    LPG: 'lpg',
    EV_CHARGING: 'ev_charging',  // Electric vehicle charging
  },

  /**
   * Get fuel type display name (for UI)
   */
  FUEL_TYPE_LABELS: {
    petrol: 'Petrol',
    diesel: 'Diesel',
    premium_petrol: 'Premium Petrol',
    premium_diesel: 'Premium Diesel',
    cng: 'CNG',
    lpg: 'LPG',
    ev_charging: 'EV Charging',
  },

  /**
   * Payment Methods - Top-level categories
   */
  PAYMENT_METHODS: {
    CASH: 'cash',
    UPI: 'upi',         // Google Pay, PhonePe, Paytm, etc.
    CARD: 'card',       // Debit / Credit card
    OIL_COMPANY: 'oil_company',  // HP Pay, IOCL Card, BPCL SmartFleet, etc.
    CREDIT: 'credit',  // On credit to creditor
  },

  PAYMENT_METHOD_LABELS: {
    cash: 'Cash',
    upi: 'UPI / Online',
    card: 'Card',
    oil_company: 'Oil Company Card',
    credit: 'Credit',
  },

  /**
   * UPI Sub-types (under "online" / "upi" category)
   * These are the most common UPI apps used at fuel stations in India
   */
  UPI_SUB_TYPES: {
    GPAY: 'gpay',
    PHONEPE: 'phonepe',
    PAYTM: 'paytm',
    AMAZON_PAY: 'amazon_pay',
    CRED: 'cred',
    BHIM: 'bhim',
    OTHER_UPI: 'other_upi',
  },

  UPI_SUB_TYPE_LABELS: {
    gpay: 'Google Pay',
    phonepe: 'PhonePe',
    paytm: 'Paytm',
    amazon_pay: 'Amazon Pay',
    cred: 'CRED',
    bhim: 'BHIM UPI',
    other_upi: 'Other UPI',
  },

  /**
   * Card Sub-types
   */
  CARD_SUB_TYPES: {
    DEBIT_CARD: 'debit_card',
    CREDIT_CARD: 'credit_card',
  },

  CARD_SUB_TYPE_LABELS: {
    debit_card: 'Debit Card',
    credit_card: 'Credit Card',
  },

  /**
   * Oil Company Card Sub-types
   * Fuel company-specific payment cards / loyalty programs
   */
  OIL_COMPANY_SUB_TYPES: {
    HP_PAY: 'hp_pay',            // Hindustan Petroleum
    IOCL_CARD: 'iocl_card',      // Indian Oil
    BPCL_SMARTFLEET: 'bpcl_smartfleet',  // Bharat Petroleum
    ESSAR_FLEET: 'essar_fleet',
    RELIANCE_FLEET: 'reliance_fleet',
    OTHER_OIL_COMPANY: 'other_oil_company',
  },

  OIL_COMPANY_SUB_TYPE_LABELS: {
    hp_pay: 'HP Pay',
    iocl_card: 'IOCL Card',
    bpcl_smartfleet: 'BPCL SmartFleet',
    essar_fleet: 'Essar Fleet Card',
    reliance_fleet: 'Reliance Fleet Card',
    other_oil_company: 'Other Oil Company Card',
  },

  /**
   * Default empty payment sub-breakdown structure.
   * Used when creating a new DailyTransaction with granular payment info.
   */
  DEFAULT_PAYMENT_SUB_BREAKDOWN: {
    cash: 0,
    upi: {
      gpay: 0,
      phonepe: 0,
      paytm: 0,
      amazon_pay: 0,
      cred: 0,
      bhim: 0,
      other_upi: 0,
    },
    card: {
      debit_card: 0,
      credit_card: 0,
    },
    oil_company: {
      hp_pay: 0,
      iocl_card: 0,
      bpcl_smartfleet: 0,
      essar_fleet: 0,
      reliance_fleet: 0,
      other_oil_company: 0,
    },
    credit: 0,  // creditor credit, tracked separately in creditAllocations
  },

  /**
   * Collapse a payment_sub_breakdown into the legacy { cash, online, credit } shape.
   * Used for backward-compatible reporting and settlement validation.
   */
  collapsePaymentBreakdown(subBreakdown) {
    if (!subBreakdown) return { cash: 0, online: 0, credit: 0 };
    const upiTotal = Object.values(subBreakdown.upi || {}).reduce((a, b) => a + (b || 0), 0);
    const cardTotal = Object.values(subBreakdown.card || {}).reduce((a, b) => a + (b || 0), 0);
    const oilTotal = Object.values(subBreakdown.oil_company || {}).reduce((a, b) => a + (b || 0), 0);
    return {
      cash: subBreakdown.cash || 0,
      online: upiTotal + cardTotal + oilTotal,
      credit: subBreakdown.credit || 0,
    };
  },

  /**
   * Expense Categories - For tracking station operational expenses
   * Organized by frequency and type
   */
  EXPENSE_CATEGORIES: {
    // Monthly / Fixed
    SALARY: 'salary',
    ELECTRICITY: 'electricity',
    RENT: 'rent',
    INSURANCE: 'insurance',
    LOAN_EMI: 'loan_emi',
    // Daily / Variable
    CLEANING: 'cleaning',
    GENERATOR_FUEL: 'generator_fuel',
    DRINKING_WATER: 'drinking_water',
    // One-time / Irregular
    MAINTENANCE: 'maintenance',
    EQUIPMENT_PURCHASE: 'equipment_purchase',
    // Overhead
    TAXES: 'taxes',
    TRANSPORTATION: 'transportation',
    SUPPLIES: 'supplies',
    MISCELLANEOUS: 'miscellaneous',
  },

  EXPENSE_CATEGORY_LABELS: {
    salary: 'Staff Salary',
    electricity: 'Electricity Bill',
    rent: 'Rent',
    insurance: 'Insurance',
    loan_emi: 'Loan / EMI',
    cleaning: 'Cleaning & Sanitation',
    generator_fuel: 'Generator Fuel',
    drinking_water: 'Drinking Water',
    maintenance: 'Maintenance & Repairs',
    equipment_purchase: 'Equipment Purchase',
    taxes: 'Taxes & Duties',
    transportation: 'Transportation',
    supplies: 'Office / Store Supplies',
    miscellaneous: 'Miscellaneous',
  },

  /**
   * Expense Frequency - Groups expenses for daily vs monthly summaries
   */
  EXPENSE_FREQUENCY: {
    DAILY: 'daily',
    WEEKLY: 'weekly',
    MONTHLY: 'monthly',
    ONE_TIME: 'one_time',
  },

  /**
   * Default category → frequency mapping (for UX pre-fill)
   */
  EXPENSE_CATEGORY_FREQUENCY_MAP: {
    salary: 'monthly',
    electricity: 'monthly',
    rent: 'monthly',
    insurance: 'monthly',
    loan_emi: 'monthly',
    cleaning: 'daily',
    generator_fuel: 'daily',
    drinking_water: 'daily',
    maintenance: 'one_time',
    equipment_purchase: 'one_time',
    taxes: 'monthly',
    transportation: 'one_time',
    supplies: 'weekly',
    miscellaneous: 'one_time',
  },

  /**
   * Expense Approval Status
   */
  EXPENSE_APPROVAL_STATUS: {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    AUTO_APPROVED: 'auto_approved',  // Manager/Owner entry - auto approved
  },

  /**
   * User Roles - Access control
   */
  USER_ROLES: {
    SUPER_ADMIN: 'super_admin',
    OWNER: 'owner',
    MANAGER: 'manager',
    EMPLOYEE: 'employee'
  },

  /**
   * Role Hierarchy (higher number = more access)
   */
  ROLE_HIERARCHY: {
    super_admin: 100,
    owner: 75,
    manager: 50,
    employee: 25
  },

  /**
   * Role Permissions
   * Define what each role can do
   */
  ROLE_PERMISSIONS: {
    super_admin: {
      canManagePlans: true,
      canManageAllStations: true,
      canManageAllUsers: true,
      canViewAllData: true,
      canExport: true
    },
    owner: {
      canCreateStation: true,
      canManageStation: true,
      canManageEmployees: true,
      canSetPrices: true,
      canViewAnalytics: true,
      canManageCreditors: true,
      canViewCredits: true,
      canSettleCredits: true,
      canEnterExpenses: true,
      canViewFinancials: true,
      canExport: true  // Based on plan
    },
    manager: {
      canSetPrices: true,
      canViewAnalytics: true,
      canManageCreditors: true,
      canViewCredits: true,
      canEnterCredits: true,
      canEnterExpenses: true,
      canEditReadings: true,
      canDeleteReadings: true
    },
    employee: {
      canEnterReadings: true,
      canViewOwnReadings: true,
      canEnterCredits: true  // Can select creditor during sale
    }
  },

  /**
   * Pump Status Options
   */
  PUMP_STATUS: {
    ACTIVE: 'active',
    REPAIR: 'repair',
    INACTIVE: 'inactive'
  },

  /**
   * Credit Status - For tracking credit sales
   */
  CREDIT_STATUS: {
    PENDING: 'pending',
    PARTIAL: 'partial',
    SETTLED: 'settled'
  },

  /**
   * Default Plan Limits (used when creating new plans)
   */
  DEFAULT_PLAN_LIMITS: {
    free: {
      maxStations: 1,
      maxPumpsPerStation: 2,
      maxNozzlesPerPump: 4,
      maxEmployees: 2,
      maxCreditors: 10,
      backdatedDays: 3,
      analyticsDays: 7,
      canExport: false,
      canTrackExpenses: false,
      priceMonthly: 0
    },
    basic: {
      maxStations: 3,
      maxPumpsPerStation: 6,
      maxNozzlesPerPump: 4,
      maxEmployees: 10,
      maxCreditors: 50,
      backdatedDays: 7,
      analyticsDays: 30,
      canExport: false,
      canTrackExpenses: true,
      priceMonthly: 499
    },
    premium: {
      maxStations: 100,
      maxPumpsPerStation: 20,
      maxNozzlesPerPump: 8,
      maxEmployees: 100,
      maxCreditors: 500,
      backdatedDays: 30,
      analyticsDays: 365,
      canExport: true,
      canTrackExpenses: true,
      priceMonthly: 1999
    }
  },

  /**
   * Grace Period for Downgrades
   * When user downgrades, they get this many days to reduce usage
   * During grace period, they can VIEW all data but cannot ADD new items over limit
   */
  DOWNGRADE_GRACE_DAYS: 30,

  /**
   * Validation Constants
   */
  VALIDATION: {
    MIN_PASSWORD_LENGTH: 6,
    MAX_PASSWORD_LENGTH: 128,
    MAX_NAME_LENGTH: 100,
    MAX_NOTES_LENGTH: 500,
    PHONE_REGEX: /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/,
    // Indian phone format (10 digits starting with 6-9)
    INDIA_PHONE_REGEX: /^[6-9]\d{9}$/,
    // UUID v4 format
    UUID_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    // Date format (YYYY-MM-DD)
    DATE_REGEX: /^\d{4}-\d{2}-\d{2}$/,
    // Time format (HH:mm)
    TIME_REGEX: /^\d{2}:\d{2}$/,
    // GST Number format
    GST_REGEX: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
  },

  /**
   * Password Requirements
   * These are the enforced rules for passwords
   */
  PASSWORD_REQUIREMENTS: {
    minLength: 6,
    maxLength: 128,
    requireUppercase: false,  // Not required by default
    requireLowercase: false,  // Not required by default
    requireNumbers: false,    // Not required by default
    requireSpecial: false     // Not required by default
  },

  /**
   * Pagination Defaults
   */
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100
  },

  /**
   * Date/Time Formats (for API documentation)
   * Frontend should use these exact formats
   */
  DATE_FORMATS: {
    // For date-only fields: readingDate, effectiveFrom, expenseDate
    DATE_ONLY: 'YYYY-MM-DD',           // "2025-11-27"
    // For timestamp fields: createdAt, updatedAt
    ISO_DATETIME: 'ISO 8601',          // "2025-11-27T14:30:00.000Z"
    // For time-only fields: startTime, endTime
    TIME_ONLY: 'HH:mm',                // "14:30"
    TIME_WITH_SECONDS: 'HH:mm:ss',     // "14:30:00"
    // Display formats (for UI reference, not API)
    DISPLAY_DATE: 'DD MMM YYYY',       // "27 Nov 2025"
    DISPLAY_DATETIME: 'DD MMM YYYY, hh:mm A', // "27 Nov 2025, 02:30 PM"
    DISPLAY_TIME: 'hh:mm A'            // "02:30 PM"
  },

  /**
   * Currency Settings (Indian Rupee)
   */
  CURRENCY: {
    CODE: 'INR',
    SYMBOL: '₹',
    DECIMAL_PLACES: 2,
    THOUSAND_SEPARATOR: ',',
    DECIMAL_SEPARATOR: '.'
  },

  /**
   * Helper function to get all values of a config object
   */
  getValues: (configObject) => Object.values(configObject),

  /**
   * Helper function to validate if a value exists in config
   */
  isValidValue: (configObject, value) => Object.values(configObject).includes(value),

  /**
   * Helper to check if user has permission
   */
  hasPermission: (role, permission) => {
    const permissions = module.exports.ROLE_PERMISSIONS[role];
    return permissions ? permissions[permission] === true : false;
  },

  /**
   * Helper to check if role1 has higher/equal access than role2
   */
  hasHigherOrEqualRole: (role1, role2) => {
    const h = module.exports.ROLE_HIERARCHY;
    return (h[role1] || 0) >= (h[role2] || 0);
  },

  /**
   * Standardized Error Codes
   * Use these codes in error responses for frontend to handle specific cases
   */
  ERROR_CODES: {
    // Authentication
    AUTH_INVALID_CREDENTIALS: 'auth_invalid_credentials',
    AUTH_TOKEN_EXPIRED: 'auth_token_expired',
    AUTH_TOKEN_INVALID: 'auth_token_invalid',
    AUTH_UNAUTHORIZED: 'auth_unauthorized',
    
    // Validation
    VALIDATION_FAILED: 'validation_failed',
    INVALID_UUID: 'invalid_uuid',
    INVALID_DATE_FORMAT: 'invalid_date_format',
    
    // Resource errors
    NOT_FOUND: 'not_found',
    ALREADY_EXISTS: 'already_exists',
    
    // Business logic
    CREDIT_LIMIT_EXCEEDED: 'credit_limit_exceeded',
    SHIFT_REQUIRED: 'shift_required',
    SHIFT_ALREADY_ACTIVE: 'shift_already_active',
    READING_MUST_INCREASE: 'reading_must_increase',
    PRICE_NOT_SET: 'price_not_set',
    NOZZLE_INACTIVE: 'nozzle_inactive',
    TANK_INSUFFICIENT: 'tank_insufficient',
    
    // Plan limits
    PLAN_LIMIT_STATIONS: 'plan_limit_stations',
    PLAN_LIMIT_PUMPS: 'plan_limit_pumps',
    PLAN_LIMIT_NOZZLES: 'plan_limit_nozzles',
    PLAN_LIMIT_EMPLOYEES: 'plan_limit_employees',
    PLAN_LIMIT_CREDITORS: 'plan_limit_creditors',
    
    // Access control
    ACCESS_DENIED: 'access_denied',
    ROLE_INSUFFICIENT: 'role_insufficient',
    STATION_ACCESS_DENIED: 'station_access_denied',
    
    // Cash handover
    HANDOVER_NOT_PENDING: 'handover_not_pending',
    HANDOVER_DISPUTED: 'handover_disputed',
    
    // Generic
    INTERNAL_ERROR: 'internal_error',
    DATABASE_ERROR: 'database_error'
  }
};
