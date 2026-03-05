/**
 * Employee Shortfalls Service
 * Calculates and aggregates employee-wise shortfalls from settlements and readings
 */

const { Settlement, NozzleReading, User, sequelize } = require('../models');
const { Op } = require('sequelize');

/**
 * Calculate employee shortfalls for a given settlement
 * Distributes shortfall proportionally based on reading count per employee
 * @param {Object} settlement - Settlement record with readingIds
 * @returns {Object} employeeShortfalls object with {empId: {employeeName, shortfall, count}}
 */
exports.calculateSettlementShortfalls = async (settlement) => {
  try {
    if (!settlement || settlement.variance <= 0 || !settlement.readingIds || settlement.readingIds.length === 0) {
      return null; // No shortfall or no readings to distribute
    }

    const readingIds = Array.isArray(settlement.readingIds) ? settlement.readingIds : [];
    if (readingIds.length === 0) {
      return null;
    }

    // Fetch readings with employee info using sequelize query
    const NozzleReading = require('../models').NozzleReading;
    const User = require('../models').User;
    
    const readings = await NozzleReading.findAll({
      where: { id: { [require('sequelize').Op.in]: readingIds } },
      include: [
        { 
          model: User, 
          as: 'enteredByUser', 
          attributes: ['id', 'name'],
          required: false
        }
      ],
      attributes: ['id', 'enteredBy'],
      raw: false,
      subQuery: false
    });

    if (readings.length === 0) {
      return null;
    }

    // Group readings by employee
    const employeeReadingCounts = {};
    readings.forEach(reading => {
      const empId = reading.enteredBy;
      const empName = reading.enteredByUser?.name || 'Unknown';
      
      if (!employeeReadingCounts[empId]) {
        employeeReadingCounts[empId] = {
          count: 0,
          name: empName
        };
      }
      employeeReadingCounts[empId].count += 1;
    });

    // Calculate proportional shortfall per employee
    const totalReadings = readings.length;
    const totalShortfall = Math.abs(parseFloat(settlement.variance || 0));
    const employeeShortfalls = {};

    Object.entries(employeeReadingCounts).forEach(([empId, data]) => {
      const proportion = data.count / totalReadings;
      const shortfall = totalShortfall * proportion;
      
      employeeShortfalls[empId] = {
        employeeName: data.name,
        shortfall: parseFloat(shortfall.toFixed(2)),
        count: data.count
      };
    });

    return Object.keys(employeeShortfalls).length > 0 ? employeeShortfalls : null;
  } catch (error) {
    console.error('[EmployeeShortfallsService] Error calculating settlement shortfalls:', error);
    return null;
  }
};

/**
 * Get aggregated employee shortfalls for a date range
 * Groups shortfalls by employee across multiple settlements
 * @param {Object} options - {stationId, startDate, endDate}
 * @returns {Array} Array of employee shortfall summaries
 */
exports.getEmployeeShortfallsForDateRange = async (options) => {
  try {
    const { stationId, startDate, endDate } = options;

    if (!stationId || !startDate || !endDate) {
      throw new Error('stationId, startDate, and endDate are required');
    }

    // Fetch all settlements with shortfalls in date range
    const settlements = await Settlement.findAll({
      where: {
        stationId,
        date: { [require('sequelize').Op.between]: [startDate, endDate] },
        variance: { [require('sequelize').Op.gt]: 0 } // Only positive variance (shortfalls)
      },
      attributes: ['id', 'date', 'variance', 'readingIds'],
      raw: true
    });

    // Fetch all readings in date range with employee info
    const { Op } = require('sequelize');
    const readings = await NozzleReading.findAll({
      where: {
        stationId,
        readingDate: { [Op.between]: [startDate, endDate] }
      },
      include: [
        { 
          model: User, 
          as: 'enteredByUser', 
          attributes: ['id', 'name'],
          required: false
        }
      ],
      attributes: ['id', 'readingDate', 'enteredBy', 'settlementId'],
      raw: false,
      subQuery: false
    });

    if (readings.length === 0) {
      return [];
    }

    // Aggregate data by employee
    const employeeData = {};

    readings.forEach(reading => {
      const empId = reading.enteredBy;
      const empName = reading.enteredByUser?.name || 'Unknown';
      const readingDate = reading.readingDate;

      if (!employeeData[empId]) {
        employeeData[empId] = {
          employeeId: empId,
          employeeName: empName,
          totalShortfall: 0,
          daysWithShortfall: new Set(),
          shortfallSettlements: new Set(),
          readings: 0
        };
      }
      employeeData[empId].readings += 1;
    });

    // Calculate shortfalls for each settlement and distribute to employees
    settlements.forEach(settlement => {
      // Get readingIds - either from field or query from linked readings
      let settlementReadingIds = [];
      
      if (settlement.readingIds) {
        // readingIds field is populated
        settlementReadingIds = Array.isArray(settlement.readingIds) 
          ? settlement.readingIds 
          : (typeof settlement.readingIds === 'string' ? JSON.parse(settlement.readingIds || '[]') : []);
      }
      
      if (settlementReadingIds.length === 0) {
        // Backward compatibility: if readingIds is null/empty, find readings linked to this settlement
        const linkedReadings = readings.filter(r => r.settlementId === settlement.id);
        settlementReadingIds = linkedReadings.map(r => r.id);
      }

      if (settlementReadingIds.length === 0) {
        return;
      }

      // Find which employees submitted readings for this settlement
      const settlementReadings = readings.filter(r => 
        settlementReadingIds.includes(r.id)
      );

      if (settlementReadings.length === 0) {
        return;
      }

      // Group settlement readings by employee
      const empReadingCounts = {};
      const settlementDates = new Set();
      
      settlementReadings.forEach(reading => {
        const empId = reading.enteredBy;
        const readingDate = reading.readingDate;
        
        if (!empReadingCounts[empId]) {
          empReadingCounts[empId] = 0;
        }
        empReadingCounts[empId] += 1;
        settlementDates.add(readingDate);
      });

      // Distribute shortfall proportionally
      const totalReadings = settlementReadings.length;
      const totalShortfall = Math.abs(parseFloat(settlement.variance || 0));

      Object.entries(empReadingCounts).forEach(([empId, count]) => {
        if (employeeData[empId]) {
          const proportion = count / totalReadings;
          const shortfall = totalShortfall * proportion;
          employeeData[empId].totalShortfall += shortfall;
          employeeData[empId].shortfallSettlements.add(settlement.id);
          
          // Track dates with shortfalls
          settlementDates.forEach(date => {
            employeeData[empId].daysWithShortfall.add(date);
          });
        }
      });
    });

    // Format response
    const result = Object.values(employeeData)
      .filter(emp => emp.totalShortfall > 0) // Only include employees with shortfalls
      .map(emp => {
        const daysWithShortfall = emp.daysWithShortfall.size;
        const totalShortfall = parseFloat(emp.totalShortfall.toFixed(2));
        const averagePerDay = daysWithShortfall > 0 
          ? parseFloat((totalShortfall / daysWithShortfall).toFixed(2))
          : 0;

        const sortedDates = Array.from(emp.daysWithShortfall).sort();

        return {
          employeeId: emp.employeeId,
          employeeName: emp.employeeName,
          totalShortfall,
          daysWithShortfall,
          averagePerDay,
          settlementsCount: emp.shortfallSettlements.size,
          lastShortfallDate: sortedDates.length > 0 ? sortedDates[sortedDates.length - 1] : null,
          shortfallDates: sortedDates
        };
      })
      .sort((a, b) => b.totalShortfall - a.totalShortfall); // Sort by total shortfall desc

    return result;
  } catch (error) {
    console.error('[EmployeeShortfallsService] Error calculating employee shortfalls:', error);
    throw error;
  }
};

/**
 * Update settlement with calculated employee shortfalls
 * @param {String} settlementId - Settlement ID
 * @param {Object} transaction - Sequelize transaction
 * @returns {Object} Updated settlement with employeeShortfalls
 */
exports.updateSettlementShortfalls = async (settlementId, transaction) => {
  try {
    const settlement = await Settlement.findByPk(settlementId, {
      transaction
    });

    if (!settlement) {
      throw new Error(`Settlement ${settlementId} not found`);
    }

    // Skip if already calculated or no shortfall
    if (settlement.employeeShortfalls !== null || settlement.variance <= 0) {
      return settlement;
    }

    // Calculate shortfalls
    const shortfalls = await exports.calculateSettlementShortfalls(settlement);

    // Update settlement
    await settlement.update(
      { employeeShortfalls: shortfalls },
      { transaction }
    );

    return settlement;
  } catch (error) {
    console.error('[EmployeeShortfallsService] Error updating settlement shortfalls:', error);
    throw error;
  }
};
