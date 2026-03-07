/**
 * Expense Categories Service
 * Manages expense categories and frequency suggestions
 */

const EXPENSE_CATEGORIES = {
  salary: 'Salary',
  electricity: 'Electricity',
  rent: 'Rent / Lease',
  insurance: 'Insurance',
  loan_emi: 'Loan EMI',
  cleaning: 'Cleaning',
  generator_fuel: 'Generator Fuel',
  drinking_water: 'Drinking Water',
  maintenance: 'Maintenance / Repair',
  equipment_purchase: 'Equipment Purchase',
  taxes: 'Taxes & Govt Fees',
  transportation: 'Transportation',
  supplies: 'Supplies',
  miscellaneous: 'Miscellaneous'
};

const SUGGESTED_FREQUENCY = {
  salary: 'monthly',
  electricity: 'monthly',
  rent: 'monthly',
  insurance: 'monthly',
  loan_emi: 'monthly',
  generator_fuel: 'monthly',
  drinking_water: 'monthly',
  cleaning: 'weekly',
  maintenance: 'one_time',
  equipment_purchase: 'one_time',
  taxes: 'one_time',
  transportation: 'one_time',
  supplies: 'one_time',
  miscellaneous: 'one_time'
};

class ExpenseCategoriesService {
  /**
   * Get all categories with labels
   */
  getCategories() {
    return Object.entries(EXPENSE_CATEGORIES).map(([id, label]) => ({
      id,
      label
    }));
  }

  /**
   * Get category label
   */
  getLabel(categoryId) {
    return EXPENSE_CATEGORIES[categoryId] || categoryId;
  }

  /**
   * Suggest frequency for category
   */
  suggestFrequency(categoryId) {
    return SUGGESTED_FREQUENCY[categoryId] || 'one_time';
  }

  /**
   * Validate category exists
   */
  isValidCategory(categoryId) {
    return categoryId in EXPENSE_CATEGORIES;
  }

  /**
   * Get all valid frequency values
   */
  getFrequencies() {
    return [
      { id: 'daily', label: 'Daily' },
      { id: 'weekly', label: 'Weekly' },
      { id: 'monthly', label: 'Monthly' },
      { id: 'one_time', label: 'One Time' }
    ];
  }
}

module.exports = new ExpenseCategoriesService();
