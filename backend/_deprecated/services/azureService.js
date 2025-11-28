
const { blobServiceClient, computerVisionClient, CONTAINERS } = require('../config/azure');
const { Upload, NozzleReading, Pump, Nozzle, FuelPrice } = require('../models');
const { parseOcrText } = require('../utils/ocrParser');
const { processNozzleReadings } = require('./salesCalculationService');

const uploadToBlob = async (buffer, filename) => {
  try {
    console.log('📤 Uploading to Azure Blob:', filename);
    const containerClient = blobServiceClient.getContainerClient(CONTAINERS.RECEIPTS);
    const blockBlobClient = containerClient.getBlockBlobClient(filename);
    
    await blockBlobClient.upload(buffer, buffer.length, {
      blobHTTPHeaders: {
        blobContentType: 'image/jpeg'
      }
    });

    console.log('✅ Blob upload successful:', blockBlobClient.url);
    return blockBlobClient.url;
  } catch (error) {
    console.error('❌ Azure blob upload error:', error);
    throw new Error('Failed to upload file to Azure');
  }
};

const processOCR = async (uploadId, imageBuffer) => {
  try {
    console.log(`🔍 Starting OCR processing for upload ${uploadId}`);
    
    const upload = await Upload.findByPk(uploadId);
    if (!upload) {
      throw new Error('Upload not found');
    }

    // Use Azure Computer Vision to extract text from buffer
    console.log('📸 Sending image to Azure Computer Vision...');
    const result = await computerVisionClient.readInStream(imageBuffer);
    
    // Extract operation ID from the result
    const operationLocation = result.operationLocation;
    const operationId = operationLocation.split('/').pop();
    console.log('⏳ OCR operation ID:', operationId);

    // Poll for results
    let ocrResult;
    let attempts = 0;
    const maxAttempts = 15;

    while (attempts < maxAttempts) {
      console.log(`🔄 Polling OCR results, attempt ${attempts + 1}/${maxAttempts}`);
      ocrResult = await computerVisionClient.getReadResult(operationId);
      
      if (ocrResult.status === 'succeeded') {
        console.log('✅ OCR processing succeeded');
        break;
      } else if (ocrResult.status === 'failed') {
        throw new Error('OCR processing failed');
      }
      
      // Wait 2 seconds before next attempt
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }

    if (ocrResult.status !== 'succeeded') {
      throw new Error('OCR processing timeout');
    }

    // Extract the raw text from OCR results
    const rawText = ocrResult.analyzeResult.readResults
      .map(result => result.lines.map(line => line.text).join('\n'))
      .join('\n');

    console.log('📄 Raw OCR text extracted:', rawText);

    // Parse the OCR text using our custom parser
    const extractedData = parseOcrText(rawText);
    
    console.log('🎯 Extracted OCR data:', extractedData);

    // Validate extracted data
    if (!extractedData.pump_sno) {
      throw new Error('Could not extract pump serial number. Please upload a clearer image.');
    }
    
    if (extractedData.nozzleReadings.length === 0) {
      throw new Error('Could not extract nozzle readings. Please upload a clearer image.');
    }

    // Auto-create or find pump
    const pump = await findOrCreatePump(extractedData.pump_sno);
    console.log('🏭 Using pump:', pump.id, pump.name);

    // Use extracted date/time or fall back to upload timestamp
    const readingDate = extractedData.date || upload.createdAt.toISOString().split('T')[0];
    const readingTime = extractedData.time || upload.createdAt.toTimeString().split(' ')[0];
    
    console.log('📅 Using reading date/time:', readingDate, readingTime);

    // Create nozzle readings in the database
    const nozzleReadings = [];
    const nozzleConfig = await getNozzleConfig();

    for (const reading of extractedData.nozzleReadings) {
      console.log('💾 Processing nozzle reading:', reading);
      
      // Auto-create nozzle if it doesn't exist
      const nozzle = await findOrCreateNozzle(pump.id, reading.nozzle_id);
      
      // Check for duplicate reading
      const existingReading = await NozzleReading.findOne({
        where: {
          pumpSno: extractedData.pump_sno,
          nozzleId: reading.nozzle_id,
          readingDate,
          cumulativeVolume: reading.cumulative_volume
        }
      });

      if (existingReading) {
        console.log('⚠️ Duplicate reading detected, skipping:', reading);
        continue;
      }

      const nozzleReading = await NozzleReading.create({
        uploadId: upload.id,
        userId: upload.userId,
        pumpSno: extractedData.pump_sno,
        nozzleId: reading.nozzle_id,
        cumulativeVolume: reading.cumulative_volume,
        readingDate,
        readingTime,
        fuelType: nozzle.fuelType || 'Petrol',
        isManualEntry: false
      });

      nozzleReadings.push(nozzleReading);
      console.log('✅ Created nozzle reading:', nozzleReading.id);
    }

    if (nozzleReadings.length === 0) {
      throw new Error('No new readings to process (all were duplicates)');
    }

    // Process the readings to calculate sales
    console.log('🧮 Calculating sales from readings...');
    const processedReadings = await processNozzleReadings(nozzleReadings);

    // Calculate totals for the upload
    const totalLitres = processedReadings.reduce((sum, r) => sum + parseFloat(r.litresSold || 0), 0);
    const totalAmount = processedReadings.reduce((sum, r) => sum + parseFloat(r.totalAmount || 0), 0);

    console.log('💰 Calculated totals:', { totalLitres, totalAmount });

    // Update upload with processed data
    await upload.update({
      status: 'success',
      amount: totalAmount,
      litres: totalLitres,
      fuelType: processedReadings.length > 0 ? processedReadings[0].fuelType : 'Petrol',
      processedAt: new Date(),
      ocrData: {
        ...extractedData,
        processedReadings: processedReadings.map(r => ({
          nozzleId: r.nozzleId,
          cumulativeVolume: r.cumulativeVolume,
          litresSold: r.litresSold,
          totalAmount: r.totalAmount,
          fuelType: r.fuelType
        })),
        timestamp: new Date().toISOString(),
        rawText: rawText
      }
    });

    console.log(`🎉 OCR processing completed for upload ${uploadId}. Total: ${totalLitres}L, ₹${totalAmount}`);
    
  } catch (error) {
    console.error(`❌ OCR processing error for upload ${uploadId}:`, error);
    
    await Upload.update({
      status: 'failed',
      errorMessage: error.message
    }, {
      where: { id: uploadId }
    });
    
    throw error;
  }
};

// Helper function to find or create pump
const findOrCreatePump = async (pumpSno) => {
  console.log('🔍 Finding or creating pump:', pumpSno);
  
  let pump = await Pump.findOne({ where: { name: `Pump ${pumpSno}` } });
  
  if (!pump) {
    console.log('🆕 Creating new pump:', pumpSno);
    pump = await Pump.create({
      name: `Pump ${pumpSno}`,
      status: 'active'
    });
  }
  
  return pump;
};

// Helper function to find or create nozzle
const findOrCreateNozzle = async (pumpId, nozzleNumber) => {
  console.log('🔍 Finding or creating nozzle:', pumpId, nozzleNumber);
  
  let nozzle = await Nozzle.findOne({ 
    where: { 
      pump_id: pumpId, 
      number: nozzleNumber 
    } 
  });
  
  if (!nozzle) {
    console.log('🆕 Creating new nozzle:', nozzleNumber, 'for pump:', pumpId);
    
    // Default fuel type mapping (can be customized)
    const fuelTypeMap = {
      1: 'Petrol',
      2: 'Diesel', 
      3: 'Petrol',
      4: 'Diesel'
    };
    
    nozzle = await Nozzle.create({
      pump_id: pumpId,
      number: nozzleNumber,
      fuel_type: fuelTypeMap[nozzleNumber] || 'Petrol',
      status: 'active'
    });
  }
  
  return nozzle;
};

// Helper function to get nozzle configuration
const getNozzleConfig = async () => {
  // This could be enhanced to read from a configuration table
  return {
    1: 'Petrol',
    2: 'Diesel',
    3: 'Petrol', 
    4: 'Diesel'
  };
};

module.exports = {
  uploadToBlob,
  processOCR
};
