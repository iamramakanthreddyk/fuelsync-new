/**
 * TankRefill Model
 * Track fuel deliveries with backdating support
 * 
 * Design Philosophy:
 * - Allow entry of past refills (backdating for running businesses)
 * - Track supplier, cost, and invoice details
 * - Update tank level when refill is recorded
 * - Support adjustment entries for corrections
 */

const { DataTypes, Op } = require('sequelize');

module.exports = (sequelize) => {
  const TankRefill = sequelize.define('TankRefill', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    
    tankId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'tanks', key: 'id' }
    },
    
    stationId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'stations', key: 'id' },
      comment: 'Denormalized for faster queries'
    },
    
    // Refill details
    litres: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      validate: {
        notZero(value) {
          if (parseFloat(value) === 0) {
            throw new Error('Litres cannot be zero');
          }
        }
      },
      comment: 'Positive for refill, negative for adjustment/correction'
    },
    
    // Date with backdating support
    refillDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: 'Date of actual refill (can be backdated)'
    },
    
    refillTime: {
      type: DataTypes.TIME,
      allowNull: true,
      comment: 'Time of refill if known'
    },
    
    // Cost tracking
    costPerLitre: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    
    totalCost: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      comment: 'Calculated or entered total cost'
    },
    
    // Supplier details
    supplierName: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    
    invoiceNumber: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    
    invoiceDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    
    // Delivery details
    vehicleNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Tanker vehicle number'
    },
    
    driverName: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    
    driverPhone: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    
    // Tank readings for verification
    tankLevelBefore: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      comment: 'Tank level before refill (for verification)'
    },
    
    tankLevelAfter: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      comment: 'Tank level after refill'
    },
    
    // Entry type
    entryType: {
      type: DataTypes.ENUM('refill', 'adjustment', 'correction', 'initial'),
      defaultValue: 'refill',
      comment: 'Type of entry for auditing'
    },
    
    // Flags
    isBackdated: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'True if entry date is before creation date'
    },
    
    isVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'True if verified against invoice/delivery'
    },
    
    verifiedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' }
    },
    
    verifiedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    
    // Audit fields
    enteredBy: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' }
    },
    
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'tank_refills',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['tank_id'] },
      { fields: ['station_id'] },
      { fields: ['refill_date'] },
      { fields: ['station_id', 'refill_date'] },
      { fields: ['invoice_number'] }
    ],
    hooks: {
      beforeCreate: (refill) => {
        // Calculate total cost if not provided
        if (refill.costPerLitre && !refill.totalCost) {
          refill.totalCost = parseFloat(refill.litres) * parseFloat(refill.costPerLitre);
        }
        
        // Mark as backdated if refillDate is before today
        const today = new Date().toISOString().split('T')[0];
        refill.isBackdated = refill.refillDate < today;
      },
      
      afterCreate: async (refill, options) => {
        // Update tank level
        const Tank = sequelize.models.Tank;
        const tank = await Tank.findByPk(refill.tankId, { transaction: options.transaction });
        
        if (tank) {
          const litres = parseFloat(refill.litres);
          await tank.update({
            currentLevel: parseFloat(tank.currentLevel) + litres
          }, { transaction: options.transaction });
        }
      },
      
      afterDestroy: async (refill, options) => {
        // Reverse tank level change on delete
        const Tank = sequelize.models.Tank;
        const tank = await Tank.findByPk(refill.tankId, { transaction: options.transaction });
        
        if (tank) {
          const litres = parseFloat(refill.litres);
          await tank.update({
            currentLevel: parseFloat(tank.currentLevel) - litres
          }, { transaction: options.transaction });
        }
      }
    }
  });

  // ============================================
  // INSTANCE METHODS
  // ============================================

  /**
   * Verify this refill entry
   */
  TankRefill.prototype.verify = async function(userId) {
    await this.update({
      isVerified: true,
      verifiedBy: userId,
      verifiedAt: new Date()
    });
    return this;
  };

  // ============================================
  // CLASS METHODS
  // ============================================

  /**
   * Get refill history for a tank
   */
  TankRefill.getHistory = async function(tankId, options = {}) {
    const { startDate, endDate, page = 1, limit = 20 } = options;
    
    const where = { tankId };
    
    if (startDate && endDate) {
      where.refillDate = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      where.refillDate = { [Op.gte]: startDate };
    } else if (endDate) {
      where.refillDate = { [Op.lte]: endDate };
    }

    const offset = (page - 1) * limit;

    return this.findAndCountAll({
      where,
      include: [
        { model: sequelize.models.User, as: 'enteredByUser', attributes: ['id', 'name'] },
        { model: sequelize.models.Tank, as: 'tank', attributes: ['id', 'fuelType', 'name'] }
      ],
      order: [['refillDate', 'DESC'], ['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });
  };

  /**
   * Get total refills for a period
   */
  TankRefill.getSummary = async function(stationId, startDate, endDate) {
    const result = await this.findAll({
      where: {
        stationId,
        refillDate: { [Op.between]: [startDate, endDate] },
        entryType: 'refill'
      },
      attributes: [
        [sequelize.fn('SUM', sequelize.col('litres')), 'totalLitres'],
        [sequelize.fn('SUM', sequelize.col('totalCost')), 'totalCost'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      raw: true
    });

    return {
      totalLitres: parseFloat(result[0]?.totalLitres) || 0,
      totalCost: parseFloat(result[0]?.totalCost) || 0,
      count: parseInt(result[0]?.count) || 0
    };
  };

  /**
   * Get refills by fuel type
   */
  TankRefill.getByFuelType = async function(stationId, startDate, endDate) {
    const Tank = sequelize.models.Tank;
    
    return this.findAll({
      where: {
        stationId,
        refillDate: { [Op.between]: [startDate, endDate] },
        entryType: 'refill'
      },
      include: [{
        model: Tank,
        as: 'tank',
        attributes: ['fuelType']
      }],
      attributes: [
        [sequelize.fn('SUM', sequelize.col('litres')), 'totalLitres'],
        [sequelize.fn('SUM', sequelize.col('totalCost')), 'totalCost'],
        [sequelize.fn('COUNT', sequelize.col('TankRefill.id')), 'count']
      ],
      group: ['tank.fuelType'],
      raw: true
    });
  };

  return TankRefill;
};
