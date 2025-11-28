
const { Sale, OCRReading, Station, User, Pump, Nozzle } = require('../models');
const { Op } = require('sequelize');

/**
 * Service for multi-tenant sales business logic
 */
class MultiTenantSalesService {
  /**
   * Derive allowed station IDs for a user, or null for superadmin
   */
  static async getAllowedStationIds(user) {
    if (!user) return [];
    if (user.role === 'superadmin') {
      return null; // all stations
    } else if (user.role === 'owner') {
      const stations = await Station.findAll({ where: { owner_id: user.id }, attributes: ['id'] });
      return stations.map(s => s.id);
    } else {
      // Employee: only own station
      return user.stationId ? [user.stationId] : [];
    }
  }

  /**
   * Filter query object for sales API from query params and access
   */
  static buildSalesWhereClause({ allowedStationIds, query }) {
    const {
      station_id,
      from,
      to,
      fuel_type,
      nozzle_id,
      pump_id,
    } = query;

    const queryStationId = parseInt(station_id);

    let where = {};
    if (allowedStationIds) {
      where.stationId = queryStationId;
    } else if (queryStationId) {
      where.stationId = queryStationId;
    }
    if (from) {
      where.saleDate = where.saleDate || {};
      where.saleDate[Op.gte] = from;
    }
    if (to) {
      where.saleDate = where.saleDate || {};
      where.saleDate[Op.lte] = to;
    }
    if (fuel_type) {
      where.fuelType = fuel_type.toUpperCase();
    }
    if (nozzle_id) {
      where.nozzleId = nozzle_id;
    }
    if (pump_id) {
      where.pumpId = pump_id;
    }
    return where;
  }

  /**
   * Query sales list (paginated)
   */
  static async listSalesPaginated({ user, query }) {
    const {
      limit = 20,
      offset = 0,
      station_id
    } = query;

    const allowedStationIds = await this.getAllowedStationIds(user);

    // Only allow querying permitted stations
    const queryStationId = parseInt(station_id);
    if (
      allowedStationIds &&
      (isNaN(queryStationId) || !allowedStationIds.includes(queryStationId))
    ) {
      throw new Error("Not allowed to access this station's data");
    }

    const where = this.buildSalesWhereClause({ allowedStationIds, query });

    // Count & Fetch sales, include Pump and OCRReading
    const [total_count, sales] = await Promise.all([
      Sale.count({ where }),
      Sale.findAll({
        where,
        include: [
          {
            model: OCRReading,
            as: 'reading',
            attributes: ['source'],
          },
          {
            model: Pump,
            as: 'pump',
            attributes: ['pumpSno', 'name'],
          }
        ],
        order: [['saleDate', 'DESC'], ['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      })
    ]);

    // Compose result list with "source"
    return {
      sales: sales.map(sale => {
        let source = null;
        if (sale.reading && sale.reading.source) {
          source = sale.reading.source;
        } else if (sale.isManualEntry) {
          source = "manual";
        } else {
          source = "ocr";
        }
        return {
          id: sale.id,
          station_id: sale.stationId,
          pump_id: sale.pumpId,
          nozzle_id: sale.nozzleId,
          fuel_type: sale.fuelType,
          price_per_litre: sale.pricePerLitre,
          delta_volume_l: sale.litresSold,
          total_amount: sale.totalAmount,
          sale_date: sale.saleDate,
          shift: sale.shift,
          source,
          created_at: sale.createdAt,
          pump: sale.pump ? { pump_sno: sale.pump.pumpSno, name: sale.pump.name } : null
        };
      }),
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total_count
      }
    };
  }

  /**
   * Query summary info (totals, by source, by fuel_type)
   */
  static async getSalesSummary({ user, query }) {
    const allowedStationIds = await this.getAllowedStationIds(user);

    const { station_id } = query;
    const queryStationId = parseInt(station_id);
    if (
      allowedStationIds &&
      (isNaN(queryStationId) || !allowedStationIds.includes(queryStationId))
    ) {
      throw new Error("Not allowed to access this station's data");
    }

    const where = this.buildSalesWhereClause({ allowedStationIds, query });

    const sales = await Sale.findAll({
      where,
      include: [
        {
          model: OCRReading,
          as: 'reading',
          attributes: ['source'],
        }
      ]
    });

    // Calculate summary
    let total_sales = 0;
    let count_by_source = {};
    let volume_by_fuel_type = {};

    for (const sale of sales) {
      total_sales += parseFloat(sale.totalAmount);
      let source = sale.reading && sale.reading.source ? sale.reading.source : (sale.isManualEntry ? "manual" : "ocr");
      count_by_source[source] = (count_by_source[source] || 0) + 1;
      let fuelKey = (sale.fuelType || '').toUpperCase();
      volume_by_fuel_type[fuelKey] = (volume_by_fuel_type[fuelKey] || 0) + parseFloat(sale.litresSold);
    }

    return {
      total_sales,
      count_by_source,
      volume_by_fuel_type,
      total_count: sales.length
    };
  }
}

module.exports = MultiTenantSalesService;
