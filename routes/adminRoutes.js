const express = require('express');
const { Lesson, Word, Listening } = require('../models/Content');
const User = require('../models/User');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

// Only Admins allowed
router.use(protect);
router.use(restrictTo('admin'));

// Admin Dashboard Home
router.get('/', async (req, res) => {
    const userCount = await User.countDocuments();
    const lessonCount = await Lesson.countDocuments();
    const users = await User.find().limit(5).sort('-createdAt');
    res.render('dashboard', { userCount, lessonCount, users });
});

// Manage Lessons
router.get('/lessons', async (req, res) => {
    const lessons = await Lesson.find();
    res.render('lessons', { lessons });
});

router.post('/lessons/add', async (req, res) => {
    await Lesson.create(req.body);
    res.redirect('/admin/lessons');
});

// Manage Users
router.get('/users', async (req, res) => {
    const users = await User.find();
    res.render('users', { users });
});

module.exports = router;
