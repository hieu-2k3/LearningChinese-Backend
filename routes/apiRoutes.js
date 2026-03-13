const express = require('express');
const authController = require('../controllers/authController');
const contentController = require('../controllers/contentController');
const pinyinController = require('../controllers/pinyinController');
const readingController = require('../controllers/readingController');
const hskController = require('../controllers/hskController');
const ocrController = require('../controllers/ocrController');
const ocrLightController = require('../controllers/ocrLightController');
const { upload } = require('../utils/storage');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Auth Routes
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.get('/auth/logout', authController.logout);

// Protected Routes
router.use(protect);

router.get('/user/profile', authController.getProfile);
router.get('/lessons', contentController.getAllLessons);
router.get('/lessons/:id', contentController.getLessonById);
router.get('/lessons/:id/practice', contentController.getLessonPractice);
router.post('/progress/update', contentController.updateProgress);
router.get('/leaderboard', contentController.getLeaderboard);

router.get('/listenings', contentController.getAllListenings);
router.get('/listenings/:id', contentController.getListeningById);

// Pinyin Routes
router.get('/pinyin', pinyinController.getAllPinyin);
router.get('/pinyin-rules', pinyinController.getAllRules);
router.get('/pinyin/:sound', pinyinController.getPinyinDetail);

// Reading Routes
router.get('/readings', readingController.getAllReadings);
router.get('/readings/:id', readingController.getReadingById);

// HSK Exam Routes
router.get('/hsk/dashboard/:level', hskController.getHskDashboard);
router.get('/hsk/exams/:id', hskController.getExamById);
router.post('/hsk/submit', hskController.submitExamResult);
router.get('/hsk/history', hskController.getExamHistory);

// OCR Routes
router.post('/ocr/scan', upload.single('image'), ocrController.scanImage);
router.post('/ocr/lookup', ocrLightController.lookupText);
router.get('/ocr/detail/:word', ocrController.getWordDetail);

module.exports = router;
