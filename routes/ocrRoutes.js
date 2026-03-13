const express = require('express');
const router = express.Router();
const ocrController = require('../controllers/ocrController');
const { upload } = require('../utils/storage');
const auth = require('../middleware/auth');

const ocrLightController = require('../controllers/ocrLightController');

// POST /api/v1/ocr/scan - Quét ảnh và nhận diện chữ (Cũ - Nặng RAM)
router.post('/scan', upload.single('image'), ocrController.scanImage);

// POST /api/v1/ocr/lookup - Nhận text từ Client và trả về nghĩa (Mới - Nhẹ RAM)
router.post('/lookup', ocrLightController.lookupText);

// GET /api/v1/ocr/detail/:word - Tra cứu chi tiết từ (dùng cho popup)
router.get('/detail/:word', ocrController.getWordDetail);

module.exports = router;
