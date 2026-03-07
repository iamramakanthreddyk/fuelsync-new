/**
 * Readings Service
 * Req #1: Support assignedEmployeeId for manager/owner entering on behalf of employees
 * Handles reading creation, retrieval, with employee attribution
 */

const { NozzleReading, User, Nozzle, Station } = require('../../models');
const { Op } = require('sequelize');

class ReadingsService {
  /**
   * Create a new reading
   * If assignedEmployeeId is provided, this reading is attributed to that employee
   * Otherwise, it's attributed to the entering user
   */
  async createReading(data) {
    const {
      nozzleId,
      stationId,
      readingDate,
      readingValue,
      previousReading,
      fuelType,
      pricePerLitre,
      totalAmount,
      paymentMethod,
      assignedEmployeeId, // Req #1
      paymentSubBreakdown, // Req #2
      enteredBy,
      notes
    } = data;

    // Validate nozzle exists and belongs to station
    const nozzle = await Nozzle.findOne({
      where: { id: nozzleId, stationId }
    });
    if (!nozzle) {
      throw new Error('Nozzle not found in this station');
    }

    // If assignedEmployeeId provided, validate employee exists
    let effectiveAssignedEmployeeId = null;
    if (assignedEmployeeId) {
      const employee = await User.findByPk(assignedEmployeeId);
      if (!employee || employee.role !== 'employee') {
        throw new Error('Assigned employee not found or invalid role');
      }
      effectiveAssignedEmployeeId = assignedEmployeeId;
    }

    // Calculate litres sold
    const litresSold = previousReading
      ? readingValue - previousReading
      : readingValue;

    // Create reading
    const reading = await NozzleReading.create({
      nozzleId,
      stationId,
      enteredBy,
      assignedEmployeeId: effectiveAssignedEmployeeId,
      readingDate,
      readingValue,
      previousReading,
      litresSold,
      fuelType,
      pricePerLitre,
      totalAmount,
      paymentMethod,
      paymentSubBreakdown, // Req #2
      notes
    });

    return this.getReadingWithDetails(reading.id);
  }

  /**
   * Get reading with full details including employee info
   */
  async getReadingWithDetails(readingId) {
    const reading = await NozzleReading.findByPk(readingId, {
      include: [
        { model: User, as: 'EnteredByUser', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'AssignedEmployeeUser', attributes: ['id', 'name', 'email'] }
      ]
    });

    if (!reading) {
      throw new Error('Reading not found');
    }

    return {
      ...reading.toJSON(),
      effectiveEmployee: reading.assignedEmployeeId || reading.enteredBy,
      wasEnteredOnBehalf: !!reading.assignedEmployeeId
    };
  }

  /**
   * List readings with optional filtering by employee
   * Req #1: Can filter by assignedEmployeeId or enteredBy (reading belongs to this employee)
   */
  async listReadings(filter) {
    const {
      stationId,
      startDate,
      endDate,
      nozzleId,
      employeeId, // Req #1: if provided, show readings for this employee (assigned or entered)
      fuelType,
      limit = 50,
      offset = 0
    } = filter;

    const where = { stationId };

    if (startDate && endDate) {
      where.readingDate = { [Op.between]: [startDate, endDate] };
    }

    if (nozzleId) {
      where.nozzleId = nozzleId;
    }

    if (fuelType) {
      where.fuelType = fuelType;
    }

    // Req #1: Filter by employee (either assigned to OR entered by this employee)
    if (employeeId) {
      where[Op.or] = [
        { assignedEmployeeId: employeeId },
        { enteredBy: employeeId }
      ];
    }

    const readings = await NozzleReading.findAll({
      where,
      include: [
        { model: User, as: 'EnteredByUser', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'AssignedEmployeeUser', attributes: ['id', 'name', 'email'] }
      ],
      order: [['readingDate', 'DESC']],
      limit,
      offset
    });

    return readings.map(r => ({
      ...r.toJSON(),
      effectiveEmployee: r.assignedEmployeeId || r.enteredBy,
      wasEnteredOnBehalf: !!r.assignedEmployeeId
    }));
  }

  /**
   * Get readings by employee (Req #1)
   * Shows readings this employee is responsible for (assigned or self-entered)
   */
  async getEmployeeReadings(employeeId, stationId, dateRange) {
    const where = {
      stationId,
      [Op.or]: [
        { assignedEmployeeId: employeeId },
        { enteredBy: employeeId }
      ]
    };

    if (dateRange?.start && dateRange?.end) {
      where.readingDate = { [Op.between]: [dateRange.start, dateRange.end] };
    }

    return NozzleReading.findAll({
      where,
      include: [
        { model: User, as: 'EnteredByUser', attributes: ['id', 'name', 'email'] }
      ],
      order: [['readingDate', 'DESC']]
    });
  }

  /**
   * Get reading attribution stats (Req #1 analytics)
   */
  async getAttributionStats(stationId, month) {
    const where = { stationId };

    if (month) {
      const [year, mmStr] = month.split('-');
      const startDate = `${month}-01`;
      const endDate = new Date(parseInt(year), parseInt(mmStr), 0)
        .toISOString()
        .split('T')[0];
      where.readingDate = { [Op.between]: [startDate, endDate] };
    }

    const selfEntered = await NozzleReading.count({
      where: { ...where, assignedEmployeeId: null }
    });

    const onBehalf = await NozzleReading.count({
      where: { ...where, assignedEmployeeId: { [Op.ne]: null } }
    });

    const byEmployee = await NozzleReading.findAll({
      attributes: [
        'assignedEmployeeId',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
      ],
      where: { ...where, assignedEmployeeId: { [Op.ne]: null } },
      group: ['assignedEmployeeId'],
      raw: true
    });

    return {
      selfEntered,
      onBehalf,
      byEmployee
    };
  }
}

module.exports = new ReadingsService();
