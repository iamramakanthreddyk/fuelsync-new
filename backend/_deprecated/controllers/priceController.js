
const { FuelPrice, User } = require('../models');

// Get all fuel prices
exports.getFuelPrices = async (req, res) => {
  try {
    const prices = await FuelPrice.findAll({
      include: [{ 
        model: User, 
        as: 'updatedByUser',
        attributes: ['name']
      }],
      order: [['updatedAt', 'DESC']]
    });

    res.json({
      success: true,
      data: prices
    });
  } catch (error) {
    console.error('Error fetching fuel prices:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch fuel prices'
    });
  }
};

// Update fuel price (Owner and Super Admin only)
exports.updateFuelPrice = async (req, res) => {
  try {
    if (!['Owner', 'Super Admin'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. Only Owners and Super Admins can update prices.'
      });
    }

    const { fuelType, price } = req.body;

    // Validate input
    if (!fuelType || !price || price <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid fuel type or price'
      });
    }

    if (!['Petrol', 'Diesel'].includes(fuelType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid fuel type. Must be Petrol or Diesel.'
      });
    }

    // Update or create fuel price
    const [fuelPrice, created] = await FuelPrice.findOrCreate({
      where: { fuelType },
      defaults: {
        fuelType,
        price: parseFloat(price),
        updatedBy: req.userId
      }
    });

    if (!created) {
      await fuelPrice.update({
        price: parseFloat(price),
        updatedBy: req.userId
      });
    }

    const updatedPrice = await FuelPrice.findOne({
      where: { fuelType },
      include: [{ 
        model: User, 
        as: 'updatedByUser',
        attributes: ['name']
      }]
    });

    res.json({
      success: true,
      data: updatedPrice,
      message: `${fuelType} price updated successfully to ₹${price}`
    });
  } catch (error) {
    console.error('Error updating fuel price:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update fuel price'
    });
  }
};

// Get price history
exports.getPriceHistory = async (req, res) => {
  try {
    const { fuelType, limit = 10 } = req.query;

    let whereClause = {};
    if (fuelType) {
      whereClause.fuelType = fuelType;
    }

    // TODO: Implement price history table for tracking changes
    // For now, return only the current prices without fake previous/change values
    const prices = await FuelPrice.findAll({
      where: whereClause,
      include: [{ 
        model: User, 
        as: 'updatedByUser',
        attributes: ['name']
      }],
      limit: parseInt(limit),
      order: [['updatedAt', 'DESC']]
    });

    // Only return actual price data, no fake history
    const history = prices.map(price => ({
      id: price.id,
      fuelType: price.fuelType,
      price: price.price,
      updatedBy: price.updatedByUser?.name || 'Unknown',
      updatedAt: price.updatedAt
      // previousPrice, change, reason: to be implemented when real history is available
    }));

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error fetching price history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch price history'
    });
  }
};

// Get price comparison with nearby stations
exports.getPriceComparison = async (req, res) => {
  try {
    // TODO: Implement competitor price tracking with real data
    // For now, return only your station's prices
    const ourPrices = await FuelPrice.findAll();
    const petrolPrice = ourPrices.find(p => p.fuelType === 'Petrol')?.price || 105.50;
    const dieselPrice = ourPrices.find(p => p.fuelType === 'Diesel')?.price || 98.75;

    const comparison = [
      {
        stationName: 'Your Station',
        petrolPrice: petrolPrice,
        dieselPrice: dieselPrice,
        distance: 0,
        isOurStation: true
      }
      // Add real competitor data here when available
    ];

    res.json({
      success: true,
      data: comparison
    });
  } catch (error) {
    console.error('Error fetching price comparison:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch price comparison'
    });
  }
};
