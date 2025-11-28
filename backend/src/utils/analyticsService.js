/**
 * Analytics Service
 * Provides business intelligence and reporting capabilities
 */
const { sequelize } = require('../models');
const { Op } = require('sequelize');

/**
 * Get hourly sales metrics for a station
 * @param {string} stationId - Station ID
 * @param {Date} dateFrom - Start date
 * @param {Date} dateTo - End date
 * @returns {Promise<Array>} Hourly sales data
 */
async function getHourlySales(stationId, dateFrom, dateTo) {
  const query = `
    SELECT 
      EXTRACT(HOUR FROM "createdAt") AS hour,
      DATE("createdAt") AS date,
      SUM("litresSold") AS volume,
      SUM("totalAmount") AS revenue,
      COUNT(*) AS sales_count
    FROM "Readings"
    WHERE "stationId" = :stationId
      AND "createdAt" >= :dateFrom
      AND "createdAt" <= :dateTo
      AND "litresSold" > 0
    GROUP BY hour, date
    ORDER BY date, hour
  `;
  
  const results = await sequelize.query(query, {
    replacements: { stationId, dateFrom, dateTo },
    type: sequelize.QueryTypes.SELECT
  });
  
  return results.map(row => ({
    hour: parseInt(row.hour),
    date: row.date,
    volume: parseFloat(row.volume || 0),
    revenue: parseFloat(row.revenue || 0),
    salesCount: parseInt(row.sales_count || 0)
  }));
}

/**
 * Get peak sales hours for a station
 * @param {string} stationId - Station ID
 * @returns {Promise<Array>} Peak hours data
 */
async function getPeakHours(stationId) {
  const query = `
    SELECT 
      EXTRACT(HOUR FROM "createdAt") AS hour,
      SUM("litresSold") AS volume,
      SUM("totalAmount") AS revenue,
      COUNT(*) AS sales_count,
      CASE 
        WHEN EXTRACT(HOUR FROM "createdAt") < 12 THEN 'Morning'
        WHEN EXTRACT(HOUR FROM "createdAt") < 17 THEN 'Afternoon'
        ELSE 'Evening'
      END AS time_of_day
    FROM "Readings"
    WHERE "stationId" = :stationId
      AND "litresSold" > 0
    GROUP BY hour, time_of_day
    ORDER BY revenue DESC
    LIMIT 5
  `;
  
  const results = await sequelize.query(query, {
    replacements: { stationId },
    type: sequelize.QueryTypes.SELECT
  });
  
  return results.map(row => ({
    hour: parseInt(row.hour),
    timeRange: `${String(row.hour).padStart(2, '0')}:00 (${row.time_of_day})`,
    avgVolume: parseFloat(row.volume || 0),
    avgRevenue: parseFloat(row.revenue || 0),
    avgSalesCount: parseInt(row.sales_count || 0)
  }));
}

/**
 * Get fuel performance metrics
 * @param {string} stationId - Station ID
 * @param {Date} dateFrom - Start date
 * @param {Date} dateTo - End date
 * @returns {Promise<Array>} Fuel performance data
 */
async function getFuelPerformance(stationId, dateFrom, dateTo) {
  const query = `
    SELECT 
      n."fuelType",
      SUM(r."litresSold") AS volume,
      SUM(r."totalAmount") AS revenue,
      COUNT(*) AS sales_count,
      AVG(r."pricePerLitre") AS avg_price
    FROM "Readings" r
    JOIN "Nozzles" n ON r."nozzleId" = n.id
    WHERE r."stationId" = :stationId
      AND r."createdAt" >= :dateFrom
      AND r."createdAt" <= :dateTo
      AND r."litresSold" > 0
    GROUP BY n."fuelType"
    ORDER BY revenue DESC
  `;
  
  const results = await sequelize.query(query, {
    replacements: { stationId, dateFrom, dateTo },
    type: sequelize.QueryTypes.SELECT
  });
  
  return results.map(row => ({
    fuelType: row.fuelType || 'Unknown',
    volume: parseFloat(row.volume || 0),
    revenue: parseFloat(row.revenue || 0),
    salesCount: parseInt(row.sales_count || 0),
    averagePrice: parseFloat(row.avg_price || 0)
  }));
}

/**
 * Get daily sales summary
 * @param {string} stationId - Station ID
 * @param {Date} dateFrom - Start date
 * @param {Date} dateTo - End date
 * @returns {Promise<Array>} Daily sales data
 */
async function getDailySales(stationId, dateFrom, dateTo) {
  const query = `
    SELECT 
      DATE("createdAt") AS date,
      SUM("litresSold") AS volume,
      SUM("totalAmount") AS revenue,
      COUNT(*) AS sales_count
    FROM "Readings"
    WHERE "stationId" = :stationId
      AND "createdAt" >= :dateFrom
      AND "createdAt" <= :dateTo
      AND "litresSold" > 0
    GROUP BY date
    ORDER BY date
  `;
  
  const results = await sequelize.query(query, {
    replacements: { stationId, dateFrom, dateTo },
    type: sequelize.QueryTypes.SELECT
  });
  
  return results.map(row => ({
    date: row.date,
    volume: parseFloat(row.volume || 0),
    revenue: parseFloat(row.revenue || 0),
    salesCount: parseInt(row.sales_count || 0)
  }));
}

/**
 * Get station overview metrics
 * @param {string} stationId - Station ID
 * @returns {Promise<Object>} Station metrics
 */
async function getStationOverview(stationId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // Today's sales
  const todayQuery = `
    SELECT 
      SUM("litresSold") AS volume,
      SUM("totalAmount") AS revenue,
      COUNT(*) AS sales_count
    FROM "Readings"
    WHERE "stationId" = :stationId
      AND "createdAt" >= :today
      AND "litresSold" > 0
  `;
  
  // Yesterday's sales
  const yesterdayQuery = `
    SELECT 
      SUM("litresSold") AS volume,
      SUM("totalAmount") AS revenue,
      COUNT(*) AS sales_count
    FROM "Readings"
    WHERE "stationId" = :stationId
      AND "createdAt" >= :yesterday
      AND "createdAt" < :today
      AND "litresSold" > 0
  `;
  
  const [todayResults, yesterdayResults] = await Promise.all([
    sequelize.query(todayQuery, {
      replacements: { stationId, today },
      type: sequelize.QueryTypes.SELECT
    }),
    sequelize.query(yesterdayQuery, {
      replacements: { stationId, yesterday, today },
      type: sequelize.QueryTypes.SELECT
    })
  ]);
  
  const todayData = todayResults[0] || {};
  const yesterdayData = yesterdayResults[0] || {};
  
  const todayRevenue = parseFloat(todayData.revenue || 0);
  const yesterdayRevenue = parseFloat(yesterdayData.revenue || 0);
  
  const revenueGrowth = yesterdayRevenue > 0 
    ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 
    : 0;
  
  return {
    today: {
      volume: parseFloat(todayData.volume || 0),
      revenue: todayRevenue,
      salesCount: parseInt(todayData.sales_count || 0)
    },
    yesterday: {
      volume: parseFloat(yesterdayData.volume || 0),
      revenue: yesterdayRevenue,
      salesCount: parseInt(yesterdayData.sales_count || 0)
    },
    growth: {
      revenue: parseFloat(revenueGrowth.toFixed(2)),
      volume: yesterdayData.volume > 0 
        ? (((todayData.volume - yesterdayData.volume) / yesterdayData.volume) * 100).toFixed(2)
        : 0
    }
  };
}

/**
 * Get top performing nozzles
 * @param {string} stationId - Station ID
 * @param {number} limit - Number of results
 * @returns {Promise<Array>} Top nozzles
 */
async function getTopNozzles(stationId, limit = 5) {
  const query = `
    SELECT 
      r."nozzleId",
      n."nozzleNumber",
      n."fuelType",
      p."pumpNumber",
      SUM(r."litresSold") AS volume,
      SUM(r."totalAmount") AS revenue,
      COUNT(*) AS sales_count
    FROM "Readings" r
    JOIN "Nozzles" n ON r."nozzleId" = n.id
    JOIN "Pumps" p ON n."pumpId" = p.id
    WHERE r."stationId" = :stationId
      AND r."litresSold" > 0
    GROUP BY r."nozzleId", n."nozzleNumber", n."fuelType", p."pumpNumber"
    ORDER BY revenue DESC
    LIMIT :limit
  `;
  
  const results = await sequelize.query(query, {
    replacements: { stationId, limit },
    type: sequelize.QueryTypes.SELECT
  });
  
  return results.map(row => ({
    nozzleId: row.nozzleId,
    nozzleNumber: row.nozzleNumber,
    fuelType: row.fuelType,
    pumpNumber: row.pumpNumber,
    volume: parseFloat(row.volume || 0),
    revenue: parseFloat(row.revenue || 0),
    salesCount: parseInt(row.sales_count || 0)
  }));
}

module.exports = {
  getHourlySales,
  getPeakHours,
  getFuelPerformance,
  getDailySales,
  getStationOverview,
  getTopNozzles
};
