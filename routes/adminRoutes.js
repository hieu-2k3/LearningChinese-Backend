const express = require('express');
const { Lesson, Word, Listening } = require('../models/Content');
const User = require('../models/User');
const { protect, restrictTo } = require('../middleware/auth');
const { cloudinary } = require('../utils/storage');

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

// Manage Lesson Exercises (Manual Practice)
router.get('/lessons/:id/exercises', async (req, res) => {
    const lesson = await Lesson.findById(req.params.id);
    res.render('lesson_exercises', { lesson });
});

router.post('/lessons/:id/exercises/add', async (req, res) => {
    const { type, question, options, correctAnswer, explanation } = req.body;
    let exerciseData = { type, question, explanation };

    if (type === 'choice' || type === 'listening' || type === 'fill_blank') {
        exerciseData.options = options.split(',').map(o => o.trim());
        exerciseData.correctAnswer = correctAnswer;
    }

    await Lesson.findByIdAndUpdate(req.params.id, { $push: { exercises: exerciseData } });
    res.redirect(`/admin/lessons/${req.params.id}/exercises`);
});

router.post('/lessons/:id/exercises/delete/:exIndex', async (req, res) => {
    const lesson = await Lesson.findById(req.params.id);
    lesson.exercises.splice(req.params.exIndex, 1);
    await lesson.save();
    res.redirect(`/admin/lessons/${req.params.id}/exercises`);
});

// Manage Users
router.get('/users', async (req, res) => {
    const users = await User.find();
    res.render('users', { users });
});

// Manage Listenings
router.get('/listenings', async (req, res) => {
    const hsk = req.query.hsk || 1;
    const listenings = await Listening.find({ hskLevel: hsk }).sort('order');
    res.render('listenings', { listenings, currentHsk: hsk });
});

router.post('/listenings/add', async (req, res) => {
    await Listening.create(req.body);
    res.redirect(`/admin/listenings?hsk=${req.body.hskLevel}`);
});

router.post('/listenings/delete/:id', async (req, res) => {
    const l = await Listening.findByIdAndDelete(req.params.id);
    res.redirect(`/admin/listenings?hsk=${l ? l.hskLevel : 1}`);
});

router.get('/listenings/:id/dialogues', async (req, res) => {
    const listening = await Listening.findById(req.params.id);
    res.render('listening_dialogues', { listening });
});

router.post('/listenings/:id/dialogues/add', async (req, res) => {
    const newDialogue = { ...req.body };
    // Auto-attach Google TTS audio URL for this sentence (no API key needed)
    if (newDialogue.hanzi) {
        const encoded = encodeURIComponent(newDialogue.hanzi);
        newDialogue.audioUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=zh-CN&client=tw-ob`;
    }
    await Listening.findByIdAndUpdate(req.params.id, { $push: { dialogues: newDialogue } });
    res.redirect(`/admin/listenings/${req.params.id}/dialogues`);
});

router.post('/listenings/:id/dialogues/delete/:dIndex', async (req, res) => {
    const listening = await Listening.findById(req.params.id);
    listening.dialogues.splice(req.params.dIndex, 1);
    await listening.save();
    res.redirect(`/admin/listenings/${req.params.id}/dialogues`);
});

module.exports = router;
