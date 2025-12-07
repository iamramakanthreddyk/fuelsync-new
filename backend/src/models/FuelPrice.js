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
      type: DataTypes.ENUM(...Object.values(FUEL_TYPES)),
      allowNull: false,
      field: 'fuel_type'
    },
    price: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      validate: {
        min: 0.01
      }
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
    updatedAt: false, // Only track creation
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

  return FuelPrice;
};
