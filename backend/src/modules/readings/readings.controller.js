/**
 * Readings Controller
 * HTTP handlers for reading creation and retrieval
 * Req #1: Supports assignedEmployeeId for manager/owner entries
 */

const { readingsService } = require('./index');

exports.createReading = async (req, res) => {
  try {
    const { stationId } = req.params;
    const userId = req.user.id;

    const reading = await readingsService.createReading({
      ...req.body,
      stationId,
      enteredBy: userId
    });

    res.json({
      success: true,
      data: reading
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: { message: error.message }
    });
  }
};

exports.listReadings = async (req, res) => {
  try {
    const { stationId } = req.params;
    const readings = await readingsService.listReadings({
      stationId,
      ...req.query,
      limit: Math.min(req.query.limit || 50, 500),
      offset: req.query.offset || 0
    });

    res.json({
      success: true,
      data: readings
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: { message: error.message }
    });
  }
};

exports.getReading = async (req, res) => {
  try {
    const { id } = req.params;
    const reading = await readingsService.getReadingWithDetails(id);

    res.json({
      success: true,
      data: reading
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: { message: error.message }
    });
  }
};

// Req #1: Get employee's readings (readings assigned to or entered by this employee)
exports.getEmployeeReadings = async (req, res) => {
  try {
    const { stationId, employeeId } = req.params;
    const { startDate, endDate } = req.query;

    const readings = await readingsService.getEmployeeReadings(
      employeeId,
      stationId,
      startDate && endDate ? { start: startDate, end: endDate } : undefined
    );

    res.json({
      success: true,
      data: readings
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: { message: error.message }
    });
  }
};

// Req #1: Get attribution statistics
exports.getAttributionStats = async (req, res) => {
  try {
    const { stationId } = req.params;
    const { month } = req.query;

    const stats = await readingsService.getAttributionStats(stationId, month);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: { message: error.message }
    });
  }
};

module.exports = exports;
