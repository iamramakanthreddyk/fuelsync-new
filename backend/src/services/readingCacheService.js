/**
 * Reading Cache Service
 * Handles nozzle cache updates (repeated in 3 places in original controller)
 */

const { Nozzle, sequelize } = require('../models');

/**
 * Update nozzle's lastReading cache after a reading operation
 * Fetches the latest reading for the nozzle and updates nozzle.lastReading
 * 
 * Called after: createReading, updateReading, deleteReading
 * 
 * @param {string} nozzleId - Nozzle ID
 * @returns {Object} - Updated nozzle data or null
 */
exports.refreshNozzleCache = async (nozzleId) => {
  try {
    const nozzle = await Nozzle.findByPk(nozzleId);
    if (!nozzle) return null;

    // Get latest reading for this nozzle
    const latestReading = await sequelize.query(
      `SELECT reading_value as readingValue, reading_date as readingDate 
       FROM nozzle_readings 
       WHERE nozzle_id = :nozzleId 
       ORDER BY reading_date DESC, created_at DESC 
       LIMIT 1`,
      {
        replacements: { nozzleId },
        type: sequelize.QueryTypes.SELECT,
        raw: true
      }
    );

    if (latestReading && latestReading.length > 0) {
      const reading = latestReading[0];
      const val = parseFloat(reading.readingValue || 0);
      const date = reading.readingDate;

      // Update nozzle cache fields
      await nozzle.update({
        lastReading: val,
        lastReadingDate: date
      });

      return { lastReading: val, lastReadingDate: date };
    } else {
      // No readings exist, reset cache
      await nozzle.update({
        lastReading: null,
        lastReadingDate: null
      });

      return { lastReading: null, lastReadingDate: null };
    }
  } catch (err) {
    console.warn(`[WARN] Failed to refresh nozzle cache for ${nozzleId}:`, err?.message || err);
    return null;
  }
};

/**
 * Batch refresh cache for multiple nozzles
 * More efficient when doing bulk operations
 * @param {Array<string>} nozzleIds - Array of nozzle IDs
 * @returns {Object} - Map of nozzleId -> updated cache
 */
exports.refreshMultipleNozzlesCaches = async (nozzleIds) => {
  const results = {};

  for (const nozzleId of nozzleIds) {
    results[nozzleId] = await exports.refreshNozzleCache(nozzleId);
  }

  return results;
};

/**
 * Update nozzle cache directly (faster if you already have latest reading)
 * @param {string} nozzleId - Nozzle ID
 * @param {number} readingValue - Latest reading value
 * @param {string} readingDate - Latest reading date
 * @returns {Object} - Updated nozzle data
 */
exports.updateNozzleCacheDirect = async (nozzleId, readingValue, readingDate) => {
  try {
    const nozzle = await Nozzle.findByPk(nozzleId);
    if (!nozzle) return null;

    await nozzle.update({
      lastReading: parseFloat(readingValue || 0),
      lastReadingDate: readingDate
    });

    return {
      lastReading: parseFloat(readingValue || 0),
      lastReadingDate: readingDate
    };
  } catch (err) {
    console.warn(`[WARN] Failed to update nozzle cache for ${nozzleId}:`, err?.message || err);
    return null;
  }
};
