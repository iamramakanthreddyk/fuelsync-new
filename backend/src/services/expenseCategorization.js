/**
 * Expense Categorization Service (Issue #13 fix)
 * 
 * Automatically suggests expense categories based on keywords
 * Learns from user corrections to improve suggestions
 */

/**
 * Keyword mappings for expense categories
 */
const CATEGORY_KEYWORDS = {
  electricity: {
    keywords: ['electricity', 'power', 'current', 'bill', 'wattage', 'kwh', 'tariff', 
               'meter', 'supply', 'tata power', 'reliance', 'ups'],
    confidence: 1.0
  },
  rent: {
    keywords: ['rent', 'lease', 'premises', 'property', 'facility', 'building', 'landlord',
               'occupancy', 'deposit', 'property tax'],
    confidence: 1.0
  },
  maintenance: {
    keywords: ['maintenance', 'repair', 'repair', 'service', 'fix', 'replace', 'parts',
               'technician', 'plumber', 'electrician', 'contractor', 'maintenance contract',
               'upkeep', 'inspection', 'overhaul'],
    confidence: 1.0
  },
  salary: {
    keywords: ['salary', 'wages', 'payroll', 'emp', 'employee', 'staff', 'salary advance',
               'bonus', 'gratuity', 'pf', 'esi', 'labor'],
    confidence: 1.0
  },
  supplies: {
    keywords: ['supply', 'supplies', 'material', 'consume', 'paper', 'toner', 'stationery',
               'office', 'equipment', 'tools', 'inventory'],
    confidence: 0.8
  },
  transportation: {
    keywords: ['transport', 'fuel', 'vehicle', 'truck', 'delivery', 'shipping', 'logistic',
               'petrol', 'diesel', 'gas', 'parking', 'toll'],
    confidence: 0.9
  },
  taxes: {
    keywords: ['tax', 'gst', 'vat', 'return', 'duty', 'cess', 'excise', 'customs',
               'income tax', 'property tax', 'registration'],
    confidence: 1.0
  },
  insurance: {
    keywords: ['insurance', 'premium', 'policy', 'claim', 'coverage', 'indemnity',
               'liability', 'third party'],
    confidence: 1.0
  },
  miscellaneous: {
    keywords: [],
    confidence: 0.1
  }
};

/**
 * Suggest category for expense description
 */
exports.suggestCategory = (description) => {
  if (!description || typeof description !== 'string') {
    return {
      suggestedCategory: 'miscellaneous',
      confidence: 0,
      alternatives: [],
      requiresApproval: true
    };
  }

  const normalized = description.toLowerCase();
  const scoreMap = {};

  // Score each category
  for (const [category, config] of Object.entries(CATEGORY_KEYWORDS)) {
    let matchedCount = 0;
    const matched = [];

    for (const keyword of config.keywords) {
      if (normalized.includes(keyword)) {
        matchedCount++;
        matched.push(keyword);
      }
    }

    if (matchedCount > 0) {
      // Calculate confidence based on matched keywords
      const baseConfidence = matchedCount / Math.max(config.keywords.length, 1);
      scoreMap[category] = {
        score: baseConfidence * config.confidence,
        matched,
        matchCount: matchedCount
      };
    }
  }

  // Sort by score
  const sorted = Object.entries(scoreMap)
    .sort(([, a], [, b]) => b.score - a.score)
    .map(([category, data]) => ({
      category,
      confidence: data.score,
      matchedKeywords: data.matched
    }));

  // If no matches, default to miscellaneous
  if (sorted.length === 0) {
    return {
      suggestedCategory: 'miscellaneous',
      confidence: 0,
      alternatives: [],
      requiresApproval: true,
      message: 'No keywords matched. Please select category manually.'
    };
  }

  const [primary, ...alternatives] = sorted;

  return {
    suggestedCategory: primary.category,
    confidence: parseFloat((primary.confidence * 100).toFixed(0)),
    matchedKeywords: primary.matchedKeywords,
    alternatives: alternatives
      .filter(a => a.confidence > 0.3) // Only show reasonable alternatives
      .slice(0, 3),
    requiresApproval: primary.confidence < 0.7,
    message: primary.confidence >= 0.8
      ? `High confidence: ${primary.category}`
      : primary.confidence >= 0.5
        ? `Medium confidence: ${primary.category}. Please verify.`
        : `Low confidence: ${primary.category}. Please review alternatives.`
  };
};

/**
 * Bulk categorize expenses
 */
exports.suggestBulkCategories = (expenses) => {
  // expenses: [{ id, description }, ...]

  return expenses.map((expense, idx) => ({
    index: idx,
    id: expense.id,
    description: expense.description,
    suggestion: this.suggestCategory(expense.description)
  }));
};

/**
 * Learn from user corrections
 * Track when user corrects a suggestion to improve future suggestions
 */
const learningHistory = new Map();

exports.recordCorrection = (description, suggestedCategory, actualCategory) => {
  if (!learningHistory.has(actualCategory)) {
    learningHistory.set(actualCategory, []);
  }

  learningHistory.get(actualCategory).push({
    description,
    suggestedCategory,
    actualCategory,
    timestamp: new Date(),
    keywords: description.toLowerCase().split(/\s+/)
  });

  // Keep only last 1000 corrections per category
  const history = learningHistory.get(actualCategory);
  if (history.length > 1000) {
    learningHistory.set(actualCategory, history.slice(-1000));
  }
};

/**
 * Get suggestion accuracy
 */
exports.getSuggestionAccuracy = () => {
  const stats = {};

  for (const [category, history] of learningHistory.entries()) {
    const correct = history.filter(h => h.suggestedCategory === h.actualCategory).length;
    const accuracy = (correct / history.length) * 100;

    stats[category] = {
      total: history.length,
      correct,
      accuracy: parseFloat(accuracy.toFixed(2)),
      lastLearned: history[history.length - 1]?.timestamp
    };
  }

  return stats;
};

/**
 * Get common keywords per category (from learning)
 */
exports.getCommonKeywords = (category) => {
  if (!learningHistory.has(category)) {
    return CATEGORY_KEYWORDS[category]?.keywords || [];
  }

  const history = learningHistory.get(category);
  const keywordFrequency = {};

  history.forEach(item => {
    item.keywords.forEach(keyword => {
      if (keyword.length > 2) { // Ignore short words
        keywordFrequency[keyword] = (keywordFrequency[keyword] || 0) + 1;
      }
    });
  });

  // Return top 20 keywords
  return Object.entries(keywordFrequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20)
    .map(([keyword, count]) => ({ keyword, frequency: count }));
};

/**
 * Validate category
 */
exports.validateCategory = (category) => {
  const validCategories = Object.keys(CATEGORY_KEYWORDS);

  if (!validCategories.includes(category)) {
    return {
      isValid: false,
      error: `Invalid category: ${category}`,
      validCategories,
      suggestion: 'Please select from valid categories'
    };
  }

  return {
    isValid: true,
    category,
    keywords: CATEGORY_KEYWORDS[category].keywords
  };
};

/**
 * Get all available categories
 */
exports.getAllCategories = () => {
  return Object.entries(CATEGORY_KEYWORDS).map(([category, config]) => ({
    category,
    keywords: config.keywords,
    description: this.getCategoryDescription(category)
  }));
};

/**
 * Get human-readable category description
 */
exports.getCategoryDescription = (category) => {
  const descriptions = {
    electricity: 'Electricity bills, power supply charges',
    rent: 'Rent or lease payments for premises',
    maintenance: 'Maintenance, repairs, and servicing',
    salary: 'Employee salaries, wages, and benefits',
    supplies: 'Office supplies, consumables, materials',
    transportation: 'Fuel, delivery, shipping, logistics',
    taxes: 'Government taxes, duties, registration fees',
    insurance: 'Insurance premiums and coverage',
    miscellaneous: 'Other expenses not fitting above categories'
  };

  return descriptions[category] || 'Expense category';
};
