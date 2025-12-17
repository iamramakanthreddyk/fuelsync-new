/**
 * CostOfGoods Model
 * Monthly cost of fuel purchased - for profit calculation
 */

const { DataTypes } = require('sequelize');
const { FUEL_TYPES } = require('../config/constants');

module.exports = (sequelize) => {
  const CostOfGoods = sequelize.define('CostOfGoods', {
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
    
    // Month for this record
    month: {
      type: DataTypes.STRING(7),  // YYYY-MM format
      allowNull: false
    },
    
    // Fuel type
    fuelType: {
      type: DataTypes.STRING(30),
      allowNull: false,
      field: 'fuel_type',
      validate: {
        isIn: [Object.values(FUEL_TYPES)]
      }
    },
    
    // Purchase details
    litresPurchased: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
      field: 'litres_purchased'
    },
    totalCost: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      field: 'total_cost'
    },
    avgCostPerLitre: {
      type: DataTypes.DECIMAL(8, 2),
      field: 'avg_cost_per_litre',
      comment: 'Calculated: totalCost / litresPurchased'
    },
    
    // Supplier info
    supplierName: {
      type: DataTypes.STRING(100),
      field: 'supplier_name'
    },
    invoiceNumbers: {
      type: DataTypes.JSONB,
      defaultValue: [],
      field: 'invoice_numbers',
      comment: 'Array of invoice numbers for this month'
    },
    
    notes: {
      type: DataTypes.TEXT
    },
    
    // Who entered
    enteredBy: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'entered_by',
      references: {
        model: 'users',
        key: 'id'
      }
    }
  }, {
    tableName: 'cost_of_goods',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['station_id'] },
      // { fields: ['month'] }, // Temporarily disabled until migration runs
      { fields: ['fuel_type'] },
      // { unique: true, fields: ['station_id', 'month', 'fuel_type'] } // Temporarily disabled until migration runs
    ],
    hooks: {
      beforeValidate: (cog) => {
        // Calculate avg cost per litre
        if (cog.totalCost && cog.litresPurchased && cog.litresPurchased > 0) {
          cog.avgCostPerLitre = (parseFloat(cog.totalCost) / parseFloat(cog.litresPurchased)).toFixed(2);
        }
      }
    }
  });

  CostOfGoods.associate = (models) => {
    CostOfGoods.belongsTo(models.Station, { foreignKey: 'stationId', as: 'station' });
    CostOfGoods.belongsTo(models.User, { foreignKey: 'enteredBy', as: 'enteredByUser' });
  };

  /**
   * Get total cost of goods for a month
   */
  CostOfGoods.getTotalForMonth = async function(stationId, month) {
    const result = await this.sum('totalCost', {
      where: { stationId, month }
    });
    return result || 0;
  };

  /**
   * Get cost breakdown by fuel type for a month
   */
  CostOfGoods.getBreakdownForMonth = async function(stationId, month) {
    return this.findAll({
      where: { stationId, month },
      attributes: ['fuelType', 'litresPurchased', 'totalCost', 'avgCostPerLitre']
    });
  };

  return CostOfGoods;
};
