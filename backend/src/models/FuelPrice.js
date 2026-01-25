/**
 * FuelPrice Model
 * Historical fuel prices per station
 */

const { DataTypes } = require('sequelize');
const { FUEL_TYPES } = require('../config/constants');

module.exports = (sequelize) => {
  const FuelPrice = sequelize.define('FuelPrice', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    stationId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'station_id',
      references: {
        model: 'stations',
        key: 'id'
      }
    },
    fuelType: {
      type: DataTypes.STRING(30),
      allowNull: false,
      field: 'fuel_type',
      validate: {
        isIn: [Object.values(FUEL_TYPES)]
      }
    },
    price: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      validate: {
        min: 0.01
      }
    },
    costPrice: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
      field: 'cost_price',
      validate: {
        min: 0.01
      },
      comment: 'Purchase/cost price per litre for profit calculation'
    },
    effectiveFrom: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'effective_from'
    },
    updatedBy: {
      type: DataTypes.UUID,
      field: 'updated_by',
      references: {
        model: 'users',
        key: 'id'
      }
    }
  }, {
    tableName: 'fuel_prices',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['station_id', 'fuel_type', 'effective_from']
      }
    ]
  });

  FuelPrice.associate = (models) => {
    FuelPrice.belongsTo(models.Station, { foreignKey: 'stationId', as: 'station' });
    FuelPrice.belongsTo(models.User, { foreignKey: 'updatedBy', as: 'updatedByUser' });
  };

  /**
   * Get the price for a fuel type on a specific date
   */
  FuelPrice.getPriceForDate = async function(stationId, fuelType, date) {
    const price = await this.findOne({
      where: {
        stationId,
        fuelType,
        effectiveFrom: {
          [sequelize.Sequelize.Op.lte]: date
        }
      },
      order: [['effectiveFrom', 'DESC']]
    });
    return price ? parseFloat(price.price) : null;
  };

  /**
   * Calculate profit per litre for a fuel type on a specific date
   */
  FuelPrice.getProfitForDate = async function(stationId, fuelType, date) {
    const price = await this.findOne({
      where: {
        stationId,
        fuelType,
        effectiveFrom: {
          [sequelize.Sequelize.Op.lte]: date
        }
      },
      order: [['effectiveFrom', 'DESC']]
    });
    
    if (!price) return null;
    
    const sellingPrice = parseFloat(price.price);
    const costPrice = price.costPrice ? parseFloat(price.costPrice) : null;
    
    return {
      sellingPrice,
      costPrice,
      profitPerLitre: costPrice ? sellingPrice - costPrice : null,
      profitMarginPercent: costPrice ? (((sellingPrice - costPrice) / sellingPrice) * 100).toFixed(2) : null
    };
  };

  return FuelPrice;
};
