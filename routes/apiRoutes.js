const express = require('express');
const authController = require('../controllers/authController');
const contentController = require('../controllers/contentController');
const pinyinController = require('../controllers/pinyinController');
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

module.exports = router;
