/**
 * Payment Methods Service
 * Req #2: Manages payment types and subtypes (UPI, Card, Oil Company)
 * Provides lookup, validation, and breakdown services
 */

const {
  UPI_SUBTYPES,
  CARD_SUBTYPES,
  OIL_COMPANY_SUBTYPES
} = require('./dto/payment-method.dto.ts');

class PaymentMethodsService {
  /**
   * Get all available payment methods and subtypes
   */
  getAvailablePaymentMethods() {
    return {
      paymentMethods: [
        { id: 'cash', type: 'cash', method: 'cash', label: 'Cash' },
        { id: 'upi', type: 'online', method: 'upi', label: 'UPI' },
        { id: 'card', type: 'online', method: 'card', label: 'Debit / Credit Card' },
        { id: 'oil_company', type: 'online', method: 'oil_company', label: 'Oil Company Card' },
        { id: 'credit', type: 'credit', method: 'credit', label: 'Credit' }
      ],
      subtypes: {
        upi: {
          category: 'upi',
          items: Object.entries(UPI_SUBTYPES).map(([id, label]) => ({ id, label }))
        },
        card: {
          category: 'card',
          items: Object.entries(CARD_SUBTYPES).map(([id, label]) => ({ id, label }))
        },
        oil_company: {
          category: 'oil_company',
          items: Object.entries(OIL_COMPANY_SUBTYPES).map(([id, label]) => ({ id, label }))
        }
      }
    };
  }

  /**
   * Validate payment sub-breakdown (Req #2)
   * Ensures all sub-types are valid and amounts sum correctly
   */
  validatePaymentSubBreakdown(breakdown, totalAmount) {
    if (!breakdown) return { valid: true };

    let total = 0;
    const errors = [];

    // Validate UPI sub-types
    if (breakdown.upi) {
      Object.entries(breakdown.upi).forEach(([subtype, amount]) => {
        if (!UPI_SUBTYPES[subtype]) {
          errors.push(`Invalid UPI subtype: ${subtype}`);
        }
        if (typeof amount !== 'number' || amount < 0) {
          errors.push(`Invalid UPI amount for ${subtype}: ${amount}`);
        }
        total += amount;
      });
    }

    // Validate Card sub-types
    if (breakdown.card) {
      Object.entries(breakdown.card).forEach(([subtype, amount]) => {
        if (!CARD_SUBTYPES[subtype]) {
          errors.push(`Invalid Card subtype: ${subtype}`);
        }
        if (typeof amount !== 'number' || amount < 0) {
          errors.push(`Invalid Card amount for ${subtype}: ${amount}`);
        }
        total += amount;
      });
    }

    // Validate Oil Company sub-types
    if (breakdown.oil_company) {
      Object.entries(breakdown.oil_company).forEach(([subtype, amount]) => {
        if (!OIL_COMPANY_SUBTYPES[subtype]) {
          errors.push(`Invalid Oil Company subtype: ${subtype}`);
        }
        if (typeof amount !== 'number' || amount < 0) {
          errors.push(`Invalid Oil Company amount for ${subtype}: ${amount}`);
        }
        total += amount;
      });
    }

    // Add cash and credit to total
    if (breakdown.cash) {
      const cash = typeof breakdown.cash === 'number' ? breakdown.cash : 0;
      if (cash < 0) {
        errors.push(`Invalid cash amount: ${cash}`);
      }
      total += cash;
    }

    if (breakdown.credit) {
      const credit = typeof breakdown.credit === 'number' ? breakdown.credit : 0;
      if (credit < 0) {
        errors.push(`Invalid credit amount: ${credit}`);
      }
      total += credit;
    }

    // Check if total matches (with 0.01 tolerance for decimals)
    const tolerance = 0.01;
    if (Math.abs(total - totalAmount) > tolerance) {
      errors.push(
        `Payment breakdown total (${total}) does not match total amount (${totalAmount})`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      calculatedTotal: total
    };
  }

  /**
   * Derive simple payment breakdown from sub-breakdown (Req #2)
   * Collapses detailed sub-types into main categories for reporting
   */
  deriveSimpleBreakdown(paymentSubBreakdown) {
    if (!paymentSubBreakdown) {
      return { cash: 0, online: 0, credit: 0 };
    }

    let cash = paymentSubBreakdown.cash || 0;
    let online = 0;
    let credit = paymentSubBreakdown.credit || 0;

    // Sum all online sub-types
    if (paymentSubBreakdown.upi) {
      online += Object.values(paymentSubBreakdown.upi).reduce((sum, v) => sum + (v || 0), 0);
    }

    if (paymentSubBreakdown.card) {
      online += Object.values(paymentSubBreakdown.card).reduce((sum, v) => sum + (v || 0), 0);
    }

    if (paymentSubBreakdown.oil_company) {
      online += Object.values(paymentSubBreakdown.oil_company).reduce((sum, v) => sum + (v || 0), 0);
    }

    return {
      cash: parseFloat(cash.toFixed(2)),
      online: parseFloat(online.toFixed(2)),
      credit: parseFloat(credit.toFixed(2))
    };
  }

  /**
   * Get UPI sub-type label
   */
  getUpiLabel(subtype) {
    return UPI_SUBTYPES[subtype] || subtype;
  }

  /**
   * Get Card sub-type label
   */
  getCardLabel(subtype) {
    return CARD_SUBTYPES[subtype] || subtype;
  }

  /**
   * Get Oil Company sub-type label
   */
  getOilCompanyLabel(subtype) {
    return OIL_COMPANY_SUBTYPES[subtype] || subtype;
  }
}

module.exports = new PaymentMethodsService();
