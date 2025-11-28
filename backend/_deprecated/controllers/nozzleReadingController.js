
const { NozzleReading, User } = require('../models/multiTenantIndex');
const { processNozzleReadings } = require('../services/salesCalculationService');

const getNozzleReadings = async (req, res) => {
  try {
    const { page = 1, limit = 20, pump_sno, date } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = {};
    
    // Role-based access control
    if (req.user.role === 'employee') {
      whereClause.userId = req.userId;
    } else if (req.user.role === 'owner') {
      const stationUsers = await User.findAll({
        where: { stationId: req.user.stationId },
        attributes: ['id']
      });
      whereClause.userId = stationUsers.map(u => u.id);
    }

    // Apply filters
    if (pump_sno) whereClause.pumpSno = pump_sno;
    if (date) whereClause.readingDate = date;

    const readings = await NozzleReading.findAndCountAll({
      where: whereClause,
      include: [{ model: User, as: 'user', attributes: ['name', 'email'] }],
      offset: parseInt(offset),
      limit: parseInt(limit),
      order: [['readingDate', 'DESC'], ['readingTime', 'DESC'], ['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: readings.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: readings.count,
        totalPages: Math.ceil(readings.count / limit)
      }
    });
  } catch (error) {
    console.error('Get nozzle readings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch nozzle readings'
    });
  }
};

const createManualReading = async (req, res) => {
  try {
    const { pump_sno, nozzle_id, cumulative_volume, reading_date, reading_time, fuel_type } = req.body;

    if (!pump_sno || !nozzle_id || !cumulative_volume || !reading_date || !fuel_type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: pump_sno, nozzle_id, cumulative_volume, reading_date, fuel_type'
      });
    }

    // Check for duplicate reading
    const existingReading = await NozzleReading.findOne({
      where: {
        pumpSno: pump_sno,
        nozzleId: nozzle_id,
        readingDate: reading_date,
        readingTime: reading_time || null,
        isManualEntry: true
      }
    });

    if (existingReading) {
      return res.status(400).json({
        success: false,
        error: 'A manual reading for this pump, nozzle, and time already exists'
      });
    }

    // Create the manual reading
    const nozzleReading = await NozzleReading.create({
      userId: req.userId,
      pumpSno: pump_sno,
      nozzleId: parseInt(nozzle_id),
      cumulativeVolume: parseFloat(cumulative_volume),
      readingDate: reading_date,
      readingTime: reading_time || null,
      fuelType: fuel_type,
      isManualEntry: true
    });

    // Process the reading to calculate sales
    const [processedReading] = await processNozzleReadings([nozzleReading]);

    res.status(201).json({
      success: true,
      data: processedReading
    });
  } catch (error) {
    console.error('Create manual reading error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create manual reading'
    });
  }
};

const updateNozzleReading = async (req, res) => {
  try {
    const { id } = req.params;
    const { cumulative_volume, fuel_type } = req.body;

    const reading = await NozzleReading.findOne({
      where: { id, userId: req.userId }
    });

    if (!reading) {
      return res.status(404).json({
        success: false,
        error: 'Nozzle reading not found'
      });
    }

    // Update the reading
    await reading.update({
      cumulativeVolume: parseFloat(cumulative_volume),
      fuelType: fuel_type
    });

    // Recalculate sales for this reading
    const [processedReading] = await processNozzleReadings([reading]);

    res.json({
      success: true,
      data: processedReading
    });
  } catch (error) {
    console.error('Update nozzle reading error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update nozzle reading'
    });
  }
};

const deleteNozzleReading = async (req, res) => {
  try {
    const { id } = req.params;

    const reading = await NozzleReading.findOne({
      where: { id, userId: req.userId }
    });

    if (!reading) {
      return res.status(404).json({
        success: false,
        error: 'Nozzle reading not found'
      });
    }

    await reading.destroy();

    res.json({
      success: true,
      message: 'Nozzle reading deleted successfully'
    });
  } catch (error) {
    console.error('Delete nozzle reading error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete nozzle reading'
    });
  }
};

module.exports = {
  getNozzleReadings,
  createManualReading,
  updateNozzleReading,
  deleteNozzleReading
};
