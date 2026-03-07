/**
 * Payment Methods Controller
 * HTTP handlers for payment types and Req #2: Online sub-types
 */

const { paymentMethodsService } = require('./index');

exports.listPaymentMethods = async (req, res) => {
  try {
    const methods = paymentMethodsService.getAvailablePaymentMethods();

    res.json({
      success: true,
      data: methods
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: { message: error.message }
    });
  }
};

/**
 * Req #2: Validate payment breakdown
 */
exports.validatePaymentBreakdown = async (req, res) => {
  try {
    const { breakdown, totalAmount } = req.body;

    const validation = paymentMethodsService.validatePaymentSubBreakdown(
      breakdown,
      totalAmount
    );

    res.json({
      success: true,
      data: validation
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: { message: error.message }
    });
  }
};

module.exports = exports;
