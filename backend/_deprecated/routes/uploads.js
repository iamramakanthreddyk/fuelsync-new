
const express = require('express');
const multer = require('multer');
const {
  getUploads,
  uploadReceipt,
  updateOcrData,
  deleteUpload
} = require('../controllers/uploadController');
const auth = require('../middleware/auth');

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

router.get('/', auth, getUploads);
router.post('/', auth, upload.single('receipt'), uploadReceipt);
router.put('/:id', auth, updateOcrData);
router.delete('/:id', auth, deleteUpload);

module.exports = router;
