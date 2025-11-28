
const { Upload, OCRReading, Station, User } = require('../models/multiTenantIndex');
const { parseOcrText } = require('../utils/ocrParser');
const MultiTenantSalesService = require('../services/multiTenantSalesService');
const { uploadToBlob, processOCR: azureOCR } = require('../services/azureService');

/**
 * Multi-tenant OCR controller with station-based isolation
 */
class MultiTenantOCRController {
  
  /**
   * Upload and process receipt with OCR
   */
  static async uploadReceipt(req, res) {
    try {
      console.log(`📤 Processing receipt upload for user ${req.userId}`);
      
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }
      
      const { pumpSno } = req.body;
      if (!pumpSno) {
        return res.status(400).json({
          success: false,
          error: 'Pump serial number (pumpSno) is required'
        });
      }
      
      // Get user with station info
      const user = await User.findByPk(req.userId, {
        include: [{ model: Station, as: 'station' }]
      });
      
      if (!user || !user.station) {
        return res.status(400).json({
          success: false,
          error: 'User must be assigned to a station'
        });
      }
      
      console.log(`📄 File details: ${req.file.originalname}, ${req.file.size} bytes, Station: ${user.station.name}`);
      
      // Check daily upload limits
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayUploads = await Upload.count({
        where: {
          userId: req.userId,
          stationId: user.stationId,
          createdAt: {
            [require('sequelize').Op.gte]: today
          }
        }
      });
      
      const effectiveLimits = user.getEffectiveLimits();
      if (effectiveLimits.maxUploadsPerDay !== -1 && todayUploads >= effectiveLimits.maxUploadsPerDay) {
        console.log(`❌ Daily upload limit exceeded: ${todayUploads}/${effectiveLimits.maxUploadsPerDay}`);
        return res.status(429).json({
          success: false,
          error: `Daily upload limit (${effectiveLimits.maxUploadsPerDay}) exceeded`
        });
      }
      
      // Create upload record
      const filename = `${Date.now()}-${req.file.originalname}`;
      const upload = await Upload.create({
        userId: req.userId,
        stationId: user.stationId,
        filename,
        originalName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        status: 'processing'
      });
      
      console.log(`✅ Created upload record ${upload.id} for station ${user.station.name}`);
      
      // Upload to Azure Blob Storage
      try {
        const blobUrl = await uploadToBlob(req.file.buffer, filename);
        await upload.update({ blobUrl });
        console.log(`✅ File uploaded to Azure Blob: ${blobUrl}`);
      } catch (blobError) {
        console.error(`❌ Blob upload failed:`, blobError);
        await upload.update({
          status: 'failed',
          errorMessage: 'Failed to upload to cloud storage'
        });
        return res.status(500).json({
          success: false,
          error: 'Failed to upload file to cloud storage'
        });
      }
      
      // Process OCR asynchronously
      setImmediate(async () => {
        try {
          await this.processOCRReading(upload.id, req.file.buffer, pumpSno);
        } catch (ocrError) {
          console.error(`❌ OCR processing failed for upload ${upload.id}:`, ocrError);
        }
      });
      
      res.status(201).json({
        success: true,
        data: upload,
        message: 'File uploaded successfully. OCR processing in progress.'
      });
      
    } catch (error) {
      console.error(`❌ Upload receipt error:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to upload receipt'
      });
    }
  }
  
  /**
   * Process OCR and save readings
   */
  static async processOCRReading(uploadId, imageBuffer, expectedPumpSno) {
    try {
      console.log(`🔍 Starting OCR processing for upload ${uploadId}`);
      
      const upload = await Upload.findByPk(uploadId, {
        include: [{ model: Station, as: 'station' }]
      });
      
      if (!upload) {
        throw new Error('Upload not found');
      }
      
      // Use Azure Computer Vision OCR
      const result = await azureOCR(imageBuffer);
      const operationId = result.operationLocation.split('/').pop();
      
      // Poll for OCR results
      let ocrResult;
      let attempts = 0;
      const maxAttempts = 15;
      
      while (attempts < maxAttempts) {
        console.log(`🔄 Polling OCR results, attempt ${attempts + 1}/${maxAttempts}`);
        ocrResult = await require('../services/azureService').computerVisionClient.getReadResult(operationId);
        
        if (ocrResult.status === 'succeeded') {
          break;
        } else if (ocrResult.status === 'failed') {
          throw new Error('Azure OCR processing failed');
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
      }
      
      if (ocrResult.status !== 'succeeded') {
        throw new Error('OCR processing timeout');
      }
      
      // Extract raw text
      const rawText = ocrResult.analyzeResult.readResults
        .map(result => result.lines.map(line => line.text).join('\n'))
        .join('\n');
      
      console.log(`📄 Raw OCR text extracted (${rawText.length} chars)`);
      
      // Parse OCR text using custom parser
      const extractedData = parseOcrText(rawText);
      console.log(`🎯 Extracted OCR data:`, extractedData);
      
      // Validate extracted data
      if (!extractedData.pump_sno) {
        throw new Error('Could not extract pump serial number from image');
      }
      
      if (extractedData.nozzleReadings.length === 0) {
        throw new Error('Could not extract any nozzle readings from image');
      }
      
      // Validate pump_sno matches expected (if provided)
      if (expectedPumpSno && extractedData.pump_sno !== expectedPumpSno) {
        console.warn(`⚠️ Pump S.No mismatch: expected ${expectedPumpSno}, found ${extractedData.pump_sno}`);
      }
      
      // Auto-create pump and nozzles if they don't exist
      const nozzleIds = extractedData.nozzleReadings.map(r => r.nozzle_id);
      await MultiTenantSalesService.ensurePumpAndNozzlesExist(
        upload.stationId,
        extractedData.pump_sno,
        nozzleIds,
        upload.userId
      );
      
      // Save OCR readings to database
      const savedReadings = await this.saveOCRReadings(upload, extractedData);
      
      if (savedReadings.length === 0) {
        throw new Error('No new readings to process (all were duplicates)');
      }
      
      // Calculate sales from readings
      console.log(`🧮 Calculating sales from ${savedReadings.length} readings`);
      const salesResults = await MultiTenantSalesService.processOCRReadingsForSales(
        upload.stationId,
        savedReadings
      );
      
      // Update upload with success status
      await upload.update({
        status: 'success',
        processedAt: new Date(),
        ocrData: {
          ...extractedData,
          processedReadings: savedReadings.length,
          salesCalculated: salesResults.length,
          timestamp: new Date().toISOString(),
          rawText: rawText.substring(0, 1000) // Truncate for storage
        }
      });
      
      console.log(`🎉 OCR processing completed for upload ${uploadId}. ${savedReadings.length} readings, ${salesResults.length} sales`);
      
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
  }
  
  /**
   * Save parsed OCR data as individual nozzle readings
   */
  static async saveOCRReadings(upload, ocrData) {
    console.log(`💾 Saving OCR readings for upload ${upload.id}`);
    
    const savedReadings = [];
    const readingDate = ocrData.date || upload.createdAt.toISOString().split('T')[0];
    const readingTime = ocrData.time || upload.createdAt.toTimeString().split(' ')[0];
    
    // Get pump info for validation
    const pump = await require('../models/multiTenantIndex').Pump.findOne({
      where: {
        stationId: upload.stationId,
        pumpSno: ocrData.pump_sno
      },
      include: [{ 
        model: require('../models/multiTenantIndex').Nozzle, 
        as: 'nozzles' 
      }]
    });
    
    if (!pump) {
      throw new Error(`Pump ${ocrData.pump_sno} not found in station ${upload.stationId}`);
    }
    
    for (const nozzleReading of ocrData.nozzleReadings) {
      try {
        // Find corresponding nozzle configuration
        const nozzle = pump.nozzles.find(n => n.nozzleId === nozzleReading.nozzle_id);
        if (!nozzle) {
          console.warn(`⚠️ Nozzle ${nozzleReading.nozzle_id} not found for pump ${pump.pumpSno}`);
          continue;
        }
        
        // Check for duplicate reading
        const existingReading = await OCRReading.findOne({
          where: {
            stationId: upload.stationId,
            pumpSno: ocrData.pump_sno,
            nozzleId: nozzleReading.nozzle_id,
            readingDate,
            readingTime,
            cumulativeVolume: nozzleReading.cumulative_volume
          }
        });
        
        if (existingReading) {
          console.log(`⚠️ Duplicate reading detected for Pump ${ocrData.pump_sno}, Nozzle ${nozzleReading.nozzle_id}`);
          continue;
        }
        
        // Create new OCR reading
        const ocrReading = await OCRReading.create({
          uploadId: upload.id,
          stationId: upload.stationId,
          pumpId: pump.id,
          nozzleId: nozzleReading.nozzle_id,
          pumpSno: ocrData.pump_sno,
          fuelType: nozzle.fuelType,
          cumulativeVolume: nozzleReading.cumulative_volume,
          readingDate,
          readingTime,
          isManualEntry: false,
          enteredBy: upload.userId
        });
        
        savedReadings.push(ocrReading);
        console.log(`✅ Saved OCR reading ${ocrReading.id}: Pump ${ocrData.pump_sno}, Nozzle ${nozzleReading.nozzle_id}, Volume ${nozzleReading.cumulative_volume}L`);
        
      } catch (error) {
        console.error(`❌ Error saving nozzle reading:`, error);
      }
    }
    
    console.log(`💾 Saved ${savedReadings.length} OCR readings from ${ocrData.nozzleReadings.length} total`);
    return savedReadings;
  }
  
  /**
   * Create manual OCR reading entry
   */
  static async createManualReading(req, res) {
    try {
      const { pumpSno, nozzleId, cumulativeVolume, readingDate, readingTime } = req.body;
      
      if (!pumpSno || !nozzleId || !cumulativeVolume || !readingDate) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: pumpSno, nozzleId, cumulativeVolume, readingDate'
        });
      }
      
      // Get user with station info
      const user = await User.findByPk(req.userId, {
        include: [{ model: Station, as: 'station' }]
      });
      
      if (!user || !user.station) {
        return res.status(400).json({
          success: false,
          error: 'User must be assigned to a station'
        });
      }
      
      // Find pump and nozzle
      const pump = await require('../models/multiTenantIndex').Pump.findOne({
        where: {
          stationId: user.stationId,
          pumpSno
        },
        include: [{ 
          model: require('../models/multiTenantIndex').Nozzle, 
          as: 'nozzles',
          where: { nozzleId: parseInt(nozzleId) }
        }]
      });
      
      if (!pump || !pump.nozzles.length) {
        return res.status(404).json({
          success: false,
          error: `Pump ${pumpSno} or Nozzle ${nozzleId} not found in your station`
        });
      }
      
      const nozzle = pump.nozzles[0];
      
      // Check for duplicate reading
      const existingReading = await OCRReading.findOne({
        where: {
          stationId: user.stationId,
          pumpSno,
          nozzleId: parseInt(nozzleId),
          readingDate,
          readingTime: readingTime || null
        }
      });
      
      if (existingReading) {
        return res.status(400).json({
          success: false,
          error: 'A reading for this pump, nozzle, and time already exists'
        });
      }
      
      // Create manual reading
      const ocrReading = await OCRReading.create({
        uploadId: null,
        stationId: user.stationId,
        pumpId: pump.id,
        nozzleId: parseInt(nozzleId),
        pumpSno,
        fuelType: nozzle.fuelType,
        cumulativeVolume: parseFloat(cumulativeVolume),
        readingDate,
        readingTime: readingTime || null,
        isManualEntry: true,
        enteredBy: req.userId
      });
      
      // Calculate sales
      const salesResults = await MultiTenantSalesService.processOCRReadingsForSales(
        user.stationId,
        [ocrReading]
      );
      
      console.log(`✅ Created manual reading ${ocrReading.id} with ${salesResults.length} sales`);
      
      res.status(201).json({
        success: true,
        data: {
          reading: ocrReading,
          salesCalculated: salesResults.length
        }
      });
      
    } catch (error) {
      console.error(`❌ Create manual reading error:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to create manual reading'
      });
    }
  }
  
  /**
   * Get OCR readings for a station
   */
  static async getOCRReadings(req, res) {
    try {
      const { page = 1, limit = 20, pumpSno, date } = req.query;
      const offset = (page - 1) * limit;
      
      // Get user with station info
      const user = await User.findByPk(req.userId, {
        include: [{ model: Station, as: 'station' }]
      });
      
      if (!user || !user.station) {
        return res.status(400).json({
          success: false,
          error: 'User must be assigned to a station'
        });
      }
      
      let whereClause = {
        stationId: user.stationId
      };
      
      // Apply filters
      if (pumpSno) whereClause.pumpSno = pumpSno;
      if (date) whereClause.readingDate = date;
      
      const readings = await OCRReading.findAndCountAll({
        where: whereClause,
        include: [
          { 
            model: User, 
            as: 'enteredByUser', 
            attributes: ['name', 'email'] 
          },
          {
            model: require('../models/multiTenantIndex').Pump,
            as: 'pump',
            attributes: ['name', 'location']
          }
        ],
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
      console.error(`❌ Get OCR readings error:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch OCR readings'
      });
    }
  }
}

module.exports = MultiTenantOCRController;
