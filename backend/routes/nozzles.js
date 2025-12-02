const express = require('express');
const router = express.Router();
const { NozzleReading } = require('../src/models/NozzleReading'); // Adjust path if needed

// GET /api/v1/nozzles/readings/latest?ids=...
router.get('/readings/latest', async (req, res) => {
  const ids = req.query.ids ? req.query.ids.split(',') : [];
  if (!ids.length) {
    return res.status(400).json({ error: 'No nozzle IDs provided' });
  }
  try {
    const results = {};
    for (const id of ids) {
      // Find latest reading for this nozzle
      const latest = await NozzleReading.findOne({
        where: { nozzleId: id },
        order: [['createdAt', 'DESC']]
      });
      results[id] = latest ? latest.readingValue : null;
    }
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch latest readings' });
  }
});

module.exports = router;
