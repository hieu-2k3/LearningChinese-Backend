const express = require('express');
const { Lesson, Word, Listening } = require('../models/Content');
const User = require('../models/User');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

// Admin Login Page
router.get('/login', (req, res) => {
    res.render('login', { layout: false });
});

// All routes after this require login
router.use(protect);
router.use(restrictTo('admin'));

// Admin Dashboard Home
router.get('/', async (req, res) => {
    const userCount = await User.countDocuments();
    const lessonCount = await Lesson.countDocuments();
    const users = await User.find().limit(5).sort('-createdAt');
    res.render('dashboard', { userCount, lessonCount, users });
});

// Manage Lessons: filter by HSK
router.get('/lessons', async (req, res) => {
    const hsk = req.query.hsk || 1;
    const lessons = await Lesson.find({ hskLevel: hsk }).sort('order');
    res.render('lessons', { lessons, currentHsk: hsk });
});

router.post('/lessons/add', async (req, res) => {
    await Lesson.create(req.body);
    res.redirect(`/admin/lessons?hsk=${req.body.hskLevel}`);
});

// Manage Lesson Details (Vocabulary)
router.get('/lessons/:id/vocabulary', async (req, res) => {
    const lesson = await Lesson.findById(req.params.id).populate('vocabulary');
    res.render('lesson_vocabulary', { lesson });
});

router.post('/lessons/:id/vocabulary/add', async (req, res) => {
    const word = await Word.create({ ...req.body, lessonId: req.params.id });
    await Lesson.findByIdAndUpdate(req.params.id, { $push: { vocabulary: word._id } });
    res.redirect(`/admin/lessons/${req.params.id}/vocabulary`);
});

router.post('/lessons/:id/vocabulary/delete/:wordId', async (req, res) => {
    await Word.findByIdAndDelete(req.params.wordId);
    await Lesson.findByIdAndUpdate(req.params.id, { $pull: { vocabulary: req.params.wordId } });
    res.redirect(`/admin/lessons/${req.params.id}/vocabulary`);
});

// Manage Users
router.get('/users', async (req, res) => {
    const users = await User.find();
    res.render('users', { users });
});

module.exports = router;
