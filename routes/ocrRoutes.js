const express = require('express');
const router = express.Router();
const ocrController = require('../controllers/ocrController');
const { upload } = require('../utils/storage');
const auth = require('../middleware/auth');

// POST /api/v1/ocr/scan - Quét ảnh và nhận diện chữ
router.post('/scan', upload.single('image'), ocrController.scanImage);

// GET /api/v1/ocr/detail/:word - Tra cứu chi tiết từ (dùng cho popup)
router.get('/detail/:word', ocrController.getWordDetail);

module.exports = router;
