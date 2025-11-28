
const express = require('express');
const { Upload, NozzleReading, Sale, FuelPrice } = require('../models');
const { parseOcrText } = require('../utils/ocrParser');

const router = express.Router();

// Test OCR parsing with sample text
router.post('/ocr-parse', async (req, res) => {
  try {
    const { ocrText } = req.body;
    
    console.log('🧪 Testing OCR parsing with text:', ocrText);
    
    const result = parseOcrText(ocrText);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('❌ OCR test error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test sales calculation
router.post('/calculate-sales', async (req, res) => {
  try {
    const { pumpSno, nozzleId, currentVolume, previousVolume, fuelType } = req.body;
    
    console.log('🧪 Testing sales calculation:', {
      pumpSno, nozzleId, currentVolume, previousVolume, fuelType
    });
    
    const litresSold = currentVolume - previousVolume;
    
    const fuelPrice = await FuelPrice.findOne({
      where: { fuelType },
      order: [['updatedAt', 'DESC']]
    });
    
    const pricePerLitre = fuelPrice ? parseFloat(fuelPrice.price) : 0;
    const totalAmount = litresSold * pricePerLitre;
    
    const result = {
      litresSold,
      pricePerLitre,
      totalAmount,
      fuelPriceFound: !!fuelPrice
    };
    
    console.log('🎯 Sales calculation result:', result);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('❌ Sales calculation test error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
