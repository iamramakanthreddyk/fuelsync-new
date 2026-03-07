/**
 * Reading Repository
 * Data access layer for nozzle readings
 */

const { NozzleReading, Nozzle, Pump, Station, User, DailyTransaction, sequelize } = require('../models');
const { Op } = require('sequelize');

/**
 * Get all readings with optional filters
 * @param {Object} filters - { stationId, pumpId, nozzleId, startDate, endDate, offset, limit }
 * @param {Object} accessibleStationIds - For access control
 * @returns {Object} - { rows, count }
 */
exports.getReadingsWithFilters = async (filters) => {
  const { stationId, pumpId, nozzleId, startDate, endDate, offset = 0, limit = 50, accessibleStationIds, employeeId } = filters;

  const where = {};

  // Station filter (with access control)
  if (accessibleStationIds && accessibleStationIds.length > 0) {
    where.stationId = { [Op.in]: accessibleStationIds };
  } else if (stationId) {
    where.stationId = stationId;
  }

  // Nozzle filter
  if (nozzleId) {
    where.nozzleId = nozzleId;
  }

  // Req #1: Filter by effective employee (assigned_employee_id if set, else entered_by)
  // This ensures reports correctly attribute readings to the right person
  if (employeeId) {
    where[Op.or] = [
      { assignedEmployeeId: employeeId },           // manager entered on behalf of this employee
      { enteredBy: employeeId, assignedEmployeeId: null }  // employee entered themselves
    ];
  }

  // Date range filter
  if (startDate && endDate) {
    where.readingDate = { [Op.between]: [startDate, endDate] };
  } else if (startDate) {
    where.readingDate = { [Op.gte]: startDate };
  } else if (endDate) {
    where.readingDate = { [Op.lte]: endDate };
  }

  const include = [
    {
      model: Nozzle,
      as: 'nozzle',
      attributes: ['id', 'nozzleNumber', 'fuelType'],
      include: [{
        model: Pump,
        as: 'pump',
        attributes: ['id', 'name', 'pumpNumber'],
        where: pumpId ? { id: pumpId } : undefined
      }]
    },
    {
      model: User,
      as: 'enteredByUser',
      attributes: ['id', 'name', 'role']
    },
    {
      // Req #1: Include assigned employee info in reading responses
      model: User,
      as: 'assignedEmployee',
      attributes: ['id', 'name', 'role'],
      required: false
    },
    {
      model: require('../models').Creditor,
      as: 'creditor',
      attributes: ['id', 'name', 'businessName', 'currentBalance']
    },
    {
      model: DailyTransaction,
      as: 'transaction',
      attributes: ['id', 'transactionDate', 'status', 'createdBy', 'paymentBreakdown', 'paymentSubBreakdown'],
      required: false
    }
  ];

  const { count, rows } = await NozzleReading.findAndCountAll({
    where,
    include,
    offset: parseInt(offset),
    limit: parseInt(limit),
    order: [['readingDate', 'DESC'], ['createdAt', 'DESC']]
  });

  return { count, rows };
};

/**
 * Get readings for a specific date
 * @param {string} stationId - Station ID
 * @param {string} date - Date (YYYY-MM-DD)
 * @param {Array} accessibleStationIds - For access control
 * @returns {Array} - Readings for date
 */
exports.getReadingsForDate = async (stationId, date, accessibleStationIds = null) => {
  const where = { readingDate: date };

  if (accessibleStationIds) {
    where.stationId = { [Op.in]: accessibleStationIds };
  } else {
    where.stationId = stationId;
  }

  return await NozzleReading.findAll({
    where,
    include: [
      {
        model: Nozzle,
        as: 'nozzle',
        attributes: ['id', 'nozzleNumber', 'fuelType'],
        include: [{
          model: Pump,
          as: 'pump',
          attributes: ['id', 'name', 'pumpNumber']
        }]
      },
      {
        model: User,
        as: 'enteredByUser',
        attributes: ['id', 'name']
      }
    ],
    order: [['createdAt', 'DESC']]
  });
};

/**
 * Get all readings for a nozzle after a specific date
 * Used for recalculation after edit
 * @param {string} nozzleId - Nozzle ID
 * @param {string} fromDate - Start date (YYYY-MM-DD)
 * @returns {Array} - Readings
 */
exports.getReadingsAfterDate = async (nozzleId, fromDate) => {
  return await NozzleReading.findAll({
    where: {
      nozzleId,
      readingDate: { [Op.gte]: fromDate }
    },
    order: [['readingDate', 'ASC'], ['createdAt', 'ASC']]
  });
};

/**
 * Get latest reading for a nozzle
 * @param {string} nozzleId - Nozzle ID
 * @returns {Object} - Reading or null
 */
exports.getLatestReadingForNozzle = async (nozzleId) => {
  return await NozzleReading.findOne({
    where: { nozzleId },
    order: [['readingDate', 'DESC'], ['createdAt', 'DESC']]
  });
};

/**
 * Get reading with all relations
 * @param {string} readingId - Reading ID
 * @returns {Object} - Reading with includes
 */
exports.getReadingWithRelations = async (readingId) => {
  return await NozzleReading.findByPk(readingId, {
    include: [
      {
        model: Nozzle,
        as: 'nozzle',
        include: [{ model: Pump, as: 'pump' }]
      },
      {
        model: User,
        as: 'enteredByUser',
        attributes: ['id', 'name']
      },
      {
        model: require('../models').Creditor,
        as: 'creditor',
        attributes: ['id', 'name', 'businessName', 'currentBalance']
      }
    ]
  });
};

/**
 * Get latest readings for multiple nozzles
 * @param {Array<string>} nozzleIds - Nozzle IDs
 * @returns {Object} - Map of nozzleId -> latest reading value
 */
exports.getLatestReadingsForNozzles = async (nozzleIds) => {
  const results = {};

  for (const id of nozzleIds) {
    const latest = await NozzleReading.findOne({
      where: { nozzleId: id },
      order: [['readingDate', 'DESC'], ['createdAt', 'DESC']],
      attributes: ['id', 'nozzleId', 'readingValue', 'readingDate', 'createdAt'],
      raw: true
    });

    results[id] = latest ? latest.readingValue : null;
  }

  return results;
};

/**
 * Get daily summary for a station
 * @param {string} stationId - Station ID
 * @param {string} date - Date (YYYY-MM-DD)
 * @returns {Object} - { totalSales, totalLitres, count }
 */
exports.getDailySummary = async (stationId, date) => {
  const readings = await NozzleReading.findAll({
    where: { stationId, readingDate: date }
  });

  const totalSales = readings.reduce((s, r) => s + parseFloat(r.totalAmount || 0), 0);
  const totalLitres = readings.reduce((s, r) => s + parseFloat(r.litresSold || 0), 0);

  return {
    date,
    totalSales: parseFloat(totalSales.toFixed(2)),
    totalLitres: parseFloat(totalLitres.toFixed(2)),
    count: readings.length
  };
};

/**
 * Calculate sale value for a reading
 * @param {Object} reading - Reading object
 * @returns {number} - sale value (litresSold * pricePerLitre)
 */
exports.calculateSaleValue = (reading) => {
  return (parseFloat(reading.litresSold) || 0) * (parseFloat(reading.pricePerLitre) || 0);
};

/**
 * Get unlinked readings with totals
 * @param {Array} readings - All readings
 * @returns {Object} - { unlinkedReadings, totals }
 */
exports.getUnlinkedReadingsWithTotals = (readings) => {
  const unlinked = readings.filter(r => !r.settlementId);

  const totals = unlinked.reduce((acc, r) => {
    const pb = r.transaction?.paymentBreakdown || {};
    acc.cash += parseFloat(pb.cash || 0);
    acc.online += parseFloat(pb.online || 0);
    acc.credit += parseFloat(pb.credit || 0);
    acc.litres += parseFloat(r.litresSold || 0);
    acc.value += parseFloat(r.saleValue || 0);
    return acc;
  }, { cash: 0, online: 0, credit: 0, litres: 0, value: 0 });

  return {
    unlinkedReadings: unlinked,
    totals: {
      cash: parseFloat(totals.cash.toFixed(2)),
      online: parseFloat(totals.online.toFixed(2)),
      credit: parseFloat(totals.credit.toFixed(2)),
      litres: parseFloat(totals.litres.toFixed(2)),
      value: parseFloat(totals.value.toFixed(2))
    }
  };
};
