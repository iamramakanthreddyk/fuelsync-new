
const { NozzleReading, FuelPrice, Sale } = require('../models');
const { Op } = require('sequelize');

/**
 * Calculates litres sold and total amount for a nozzle reading
 * by comparing with the previous reading for the same pump and nozzle
 */
async function calculateSales(nozzleReading) {
  console.log('🧮 Calculating sales for nozzle reading:', nozzleReading.id);
  
  const { pumpSno, nozzleId, cumulativeVolume, readingDate, fuelType, userId } = nozzleReading;

  // Find the previous reading for this pump and nozzle
  const previousReading = await NozzleReading.findOne({
    where: {
      pumpSno,
      nozzleId,
      readingDate: {
        [Op.lt]: readingDate
      }
    },
    order: [['readingDate', 'DESC'], ['readingTime', 'DESC'], ['createdAt', 'DESC']]
  });

  console.log('🔍 Previous reading found:', previousReading ? {
    id: previousReading.id,
    date: previousReading.readingDate,
    volume: previousReading.cumulativeVolume
  } : 'None');

  let litresSold = 0;
  let totalAmount = 0;
  let pricePerLitre = 0;

  if (previousReading) {
    litresSold = parseFloat(cumulativeVolume) - parseFloat(previousReading.cumulativeVolume);
    console.log('📊 Litres calculation:', cumulativeVolume, '-', previousReading.cumulativeVolume, '=', litresSold);
  } else {
    // If no previous reading, assume this is the first reading (no sales yet)
    litresSold = 0;
    console.log('📊 First reading for this nozzle, no sales calculated');
  }

  // Get fuel price for calculation
  const fuelPrice = await FuelPrice.findOne({
    where: { fuelType },
    order: [['updatedAt', 'DESC']]
  });

  if (fuelPrice && litresSold > 0) {
    pricePerLitre = parseFloat(fuelPrice.price);
    totalAmount = litresSold * pricePerLitre;
    console.log('💰 Price calculation:', litresSold, 'L ×', pricePerLitre, '=', totalAmount);
  } else if (!fuelPrice) {
    console.warn('⚠️ No fuel price found for', fuelType);
  }

  const result = {
    litresSold: Math.max(0, litresSold), // Ensure no negative sales
    pricePerLitre,
    totalAmount: Math.max(0, totalAmount)
  };

  // Create a sale record if there are actual sales
  if (result.litresSold > 0 && result.totalAmount > 0) {
    try {
      const sale = await Sale.create({
        userId,
        pumpId: pumpSno, // Using pump serial number as ID for now
        fuelType,
        litres: result.litresSold,
        pricePerLitre: result.pricePerLitre,
        totalAmount: result.totalAmount,
        shift: getCurrentShift(),
        uploadId: nozzleReading.uploadId
      });
      
      console.log('✅ Created sale record:', sale.id);
    } catch (saleError) {
      console.error('❌ Failed to create sale record:', saleError);
    }
  }

  console.log('🎯 Sales calculation result:', result);
  return result;
}

/**
 * Processes nozzle readings and updates them with calculated sales data
 */
async function processNozzleReadings(readings) {
  console.log('⚙️ Processing', readings.length, 'nozzle readings for sales calculation');
  const processedReadings = [];

  for (const reading of readings) {
    try {
      const salesData = await calculateSales(reading);
      
      const updatedReading = await reading.update({
        litresSold: salesData.litresSold,
        pricePerLitre: salesData.pricePerLitre,
        totalAmount: salesData.totalAmount
      });

      processedReadings.push(updatedReading);
      console.log('✅ Processed reading:', reading.id, 'with sales data');
      
    } catch (error) {
      console.error('❌ Error processing reading:', reading.id, error);
      processedReadings.push(reading); // Include without sales data
    }
  }

  console.log('🎉 Completed processing', processedReadings.length, 'readings');
  return processedReadings;
}

/**
 * Determines the current shift based on time
 */
function getCurrentShift() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 14) return 'morning';
  if (hour >= 14 && hour < 22) return 'afternoon';
  return 'night';
}

module.exports = {
  calculateSales,
  processNozzleReadings,
  getCurrentShift
};
