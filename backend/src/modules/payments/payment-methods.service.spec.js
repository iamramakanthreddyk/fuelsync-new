/**
 * Payment Methods Service Tests
 * Tests for Req #2: Online payment sub-types
 */

describe('PaymentMethodsService', () => {
  let paymentService;

  beforeEach(() => {
    jest.clearAllMocks();
    paymentService = require('../payment-methods.service');
  });

  describe('getAvailablePaymentMethods', () => {
    it('should return all payment methods and subtypes (Req #2)', () => {
      const methods = paymentService.getAvailablePaymentMethods();

      expect(methods).toHaveProperty('paymentMethods');
      expect(methods).toHaveProperty('subtypes');
      expect(methods.paymentMethods.length).toBeGreaterThan(0);
    });

    it('should include UPI subtypes (Req #2)', () => {
      const methods = paymentService.getAvailablePaymentMethods();
      const upiItems = methods.subtypes.upi.items;

      expect(upiItems).toContainEqual(
        expect.objectContaining({ id: 'gpay', label: 'Google Pay' })
      );
      expect(upiItems).toContainEqual(
        expect.objectContaining({ id: 'phonepe', label: 'PhonePe' })
      );
    });

    it('should include Oil Company subtypes (Req #2)', () => {
      const methods = paymentService.getAvailablePaymentMethods();
      const oilItems = methods.subtypes.oil_company.items;

      expect(oilItems).toContainEqual(
        expect.objectContaining({ id: 'hp_pay', label: 'HP Pay' })
      );
      expect(oilItems).toContainEqual(
        expect.objectContaining({ id: 'iocl_card', label: 'IOCL Card' })
      );
    });
  });

  describe('validatePaymentSubBreakdown', () => {
    it('should validate UPI breakdown (Req #2)', () => {
      const breakdown = {
        upi: { gpay: 500, phonepe: 300 },
        card: { debit_card: 200 },
        cash: 0,
        credit: 0
      };

      const result = paymentService.validatePaymentSubBreakdown(breakdown, 1000);

      expect(result.valid).toBe(true);
      expect(result.calculatedTotal).toBe(1000);
    });

    it('should reject invalid UPI subtype', () => {
      const breakdown = {
        upi: { invalid_upi: 500 }
      };

      const result = paymentService.validatePaymentSubBreakdown(breakdown, 500);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should derive simple breakdown from sub-breakdown (Req #2)', () => {
      const subBreakdown = {
        cash: 1000,
        upi: { gpay: 500, phonepe: 300 },
        card: { debit_card: 200 },
        oil_company: { hp_pay: 100 },
        credit: 500
      };

      const simple = paymentService.deriveSimpleBreakdown(subBreakdown);

      expect(simple.cash).toBe(1000);
      expect(simple.online).toBe(1100); // UPI + Card + Oil Company
      expect(simple.credit).toBe(500);
    });
  });
});
