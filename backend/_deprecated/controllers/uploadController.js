
const { Upload, User, Plan, Station } = require('../models');
const { getEffectiveLimits } = require('../middleware/planLimits');
const { uploadToBlob } = require('../services/azureService');
const MultiTenantOCRController = require('./multiTenantOCRController');

const getUploads = async (req, res) => {
  try {
    console.log('📋 Fetching uploads for user:', req.userId);
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Get user with station info
    const user = await User.findByPk(req.userId, {
      include: [{ model: Station, as: 'station' }]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    let whereClause = {};
    
    // Role-based access control
    if (user.role === 'employee') {
      // Employee sees only their uploads
      whereClause.userId = req.userId;
    } else if (user.role === 'owner') {
      // Owner sees all uploads from their station
      if (user.stationId) {
        whereClause.stationId = user.stationId;
      } else {
        whereClause.userId = req.userId; // Fallback if no station assigned
      }
    }
    // Super Admin sees all uploads (no filter)

    const uploads = await Upload.findAndCountAll({
      where: whereClause,
      include: [
        { 
          model: User, 
          as: 'user', 
          attributes: ['name', 'email'] 
        },
        {
          model: Station,
          as: 'station',
          attributes: ['name', 'location']
        }
      ],
      offset: parseInt(offset),
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']]
    });

    console.log('✅ Found', uploads.count, 'uploads');

    res.json({
      success: true,
      data: uploads.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: uploads.count,
        totalPages: Math.ceil(uploads.count / limit)
      }
    });
  } catch (error) {
    console.error('❌ Get uploads error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch uploads'
    });
  }
};

const uploadReceipt = async (req, res) => {
  try {
    console.log('📤 Processing receipt upload for user:', req.userId);
    
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

    console.log('📄 File details:', {
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      pumpSno
    });

    // Get user with station info
    const user = await User.findByPk(req.userId, {
      include: [{ 
        model: Station, 
        as: 'station' 
      }, {
        model: Plan,
        as: 'plan'
      }]
    });

    if (!user || !user.station) {
      return res.status(400).json({
        success: false,
        error: 'User must be assigned to a station'
      });
    }

    // Check daily upload limit
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

    const effectiveLimits = getEffectiveLimits(user);
    if (effectiveLimits.maxUploadsPerDay !== -1 && todayUploads >= effectiveLimits.maxUploadsPerDay) {
      console.log('❌ Daily upload limit exceeded:', todayUploads, '>=', effectiveLimits.maxUploadsPerDay);
      return res.status(429).json({
        success: false,
        error: `Daily upload limit (${effectiveLimits.maxUploadsPerDay}) exceeded`,
        isCustomLimit: !!user.customLimits && user.customLimits.hasOwnProperty('maxUploadsPerDay')
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

    console.log('✅ Created upload record:', upload.id, 'for station:', user.station.name);

    // Upload to Azure Blob Storage
    try {
      const blobUrl = await uploadToBlob(req.file.buffer, filename);
      await upload.update({ blobUrl });
      console.log('✅ File uploaded to Azure Blob:', blobUrl);
    } catch (blobError) {
      console.error('❌ Blob upload failed:', blobError);
      await upload.update({
        status: 'failed',
        errorMessage: 'Failed to upload to cloud storage'
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to upload file to cloud storage'
      });
    }

    // Process OCR asynchronously using multi-tenant controller
    setImmediate(async () => {
      try {
        console.log('🔍 Starting async OCR processing for upload:', upload.id);
        await MultiTenantOCRController.processOCRReading(upload.id, req.file.buffer, pumpSno);
      } catch (ocrError) {
        console.error('❌ OCR processing failed for upload:', upload.id, ocrError);
      }
    });

    res.status(201).json({
      success: true,
      data: upload,
      message: 'File uploaded successfully. OCR processing in progress.'
    });

  } catch (error) {
    console.error('❌ Upload receipt error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload receipt'
    });
  }
};

const updateOcrData = async (req, res) => {
  try {
    console.log('✏️ Updating OCR data for upload:', req.params.id);
    const { id } = req.params;
    const { amount, litres, fuelType, pumpId } = req.body;

    // Get user info for authorization
    const user = await User.findByPk(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    let whereClause = { id };
    
    // Role-based access control
    if (user.role === 'employee') {
      whereClause.userId = req.userId;
    } else if (user.role === 'owner' && user.stationId) {
      whereClause.stationId = user.stationId;
    }

    const upload = await Upload.findOne({
      where: whereClause
    });

    if (!upload) {
      return res.status(404).json({
        success: false,
        error: 'Upload not found or access denied'
      });
    }

    const updatedUpload = await upload.update({
      amount: parseFloat(amount),
      litres: parseFloat(litres),
      fuelType,
      ocrData: {
        ...upload.ocrData,
        amount: parseFloat(amount),
        litres: parseFloat(litres),
        fuelType,
        pumpId,
        editedManually: true,
        updatedAt: new Date()
      }
    });

    console.log('✅ OCR data updated for upload:', id);

    res.json({
      success: true,
      data: updatedUpload
    });
  } catch (error) {
    console.error('❌ Update OCR data error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update OCR data'
    });
  }
};

const deleteUpload = async (req, res) => {
  try {
    console.log('🗑️ Deleting upload:', req.params.id);
    const { id } = req.params;

    // Get user info for authorization
    const user = await User.findByPk(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    let whereClause = { id };
    
    // Role-based access control
    if (user.role === 'employee') {
      whereClause.userId = req.userId;
    } else if (user.role === 'owner' && user.stationId) {
      whereClause.stationId = user.stationId;
    }

    const upload = await Upload.findOne({
      where: whereClause
    });

    if (!upload) {
      return res.status(404).json({
        success: false,
        error: 'Upload not found or access denied'
      });
    }

    await upload.destroy();
    console.log('✅ Upload deleted:', id);

    res.json({
      success: true,
      message: 'Upload deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete upload'
    });
  }
};

module.exports = {
  getUploads,
  uploadReceipt,
  updateOcrData,
  deleteUpload
};
