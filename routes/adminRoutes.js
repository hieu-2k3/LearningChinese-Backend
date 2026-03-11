const express = require('express');
const { Lesson, Word, Listening, Reading } = require('../models/Content');
const { HskExam, HskResult } = require('../models/HskContent');
const User = require('../models/User');
const readingController = require('../controllers/readingController');
const { protect, restrictTo } = require('../middleware/auth');
const { cloudinary } = require('../utils/storage');
const { EdgeTTS } = require('node-edge-tts');
const mp3Duration = require('mp3-duration');
const fs = require('fs');
const path = require('path');
const streamifier = require('streamifier');

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
    const listeningCount = await Listening.countDocuments();
    const users = await User.find().limit(5).sort('-createdAt');
    res.render('dashboard', { userCount, lessonCount, listeningCount, users });
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

// Manage Lesson Grammar
router.get('/lessons/:id/grammar', async (req, res) => {
    const lesson = await Lesson.findById(req.params.id);
    res.render('lesson_grammar', { lesson });
});

router.post('/lessons/:id/grammar/add', async (req, res) => {
    const { title, formula, explanation, examplesJson } = req.body;
    let examples = [];
    try {
        examples = JSON.parse(examplesJson);
        // Auto-generate TTS for each example
        for (let ex of examples) {
            if (ex.hanzi) {
                const encoded = encodeURIComponent(ex.hanzi);
                ex.audioUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=zh-CN&client=tw-ob`;
            }
        }
    } catch (e) {
        console.error("JSON Parse error for examples", e);
    }

    await Lesson.findByIdAndUpdate(req.params.id, {
        $push: {
            grammarPoints: { title, formula, explanation, examples }
        }
    });
    res.redirect(`/admin/lessons/${req.params.id}/grammar`);
});

router.post('/lessons/:id/grammar/delete/:gIndex', async (req, res) => {
    const lesson = await Lesson.findById(req.params.id);
    lesson.grammarPoints.splice(req.params.gIndex, 1);
    await lesson.save();
    res.redirect(`/admin/lessons/${req.params.id}/grammar`);
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

router.post('/listenings/:id/generate-audio', async (req, res) => {
    try {
        const listening = await Listening.findById(req.params.id);
        if (!listening || listening.dialogues.length === 0) {
            return res.redirect(`/admin/listenings/${req.params.id}/dialogues`);
        }

        let audioBuffers = [];
        let currentTime = 0;

        // Microsoft Edge TTS Voices
        const VOICE_FEMALE = 'zh-CN-XiaoxiaoNeural';
        const VOICE_MALE = 'zh-CN-YunxiNeural';

        // Sort dialogues by startTime if they have it, but for generation we usually go in sequence
        // We'll use the current order in the array
        for (let i = 0; i < listening.dialogues.length; i++) {
            const dialogue = listening.dialogues[i];

            // Choose voice based on gender (A=Female, B=Male by default)
            const voiceName = (dialogue.gender === 'male') ? VOICE_MALE : VOICE_FEMALE;
            const tts = new EdgeTTS({ voice: voiceName });

            const tempFile = path.join(__dirname, `../temp_audio_${Date.now()}_${i}.mp3`);

            // Generate to temp file (node-edge-tts works with files)
            await tts.ttsPromise(dialogue.hanzi, tempFile);

            // Read back to buffer
            const buffer = fs.readFileSync(tempFile);
            const durationSec = await mp3Duration(buffer);

            // Update dialogue timestamps in memory
            dialogue.startTime = parseFloat(currentTime.toFixed(1));
            dialogue.endTime = parseFloat((currentTime + durationSec).toFixed(1));

            audioBuffers.push(buffer);
            currentTime += durationSec;

            // Clean up temp file
            fs.unlinkSync(tempFile);
        }

        // Concatenate all buffers into one final audio file
        const finalBuf = Buffer.concat(audioBuffers);

        // Upload to Cloudinary
        let cld_upload_stream = cloudinary.uploader.upload_stream(
            {
                resource_type: "video",
                folder: "chinese_learning_audio"
            },
            async function (error, result) {
                if (error) {
                    console.error("Cloudinary error:", error);
                    return res.status(500).json({ error: "Upload failed" });
                }

                // Update basic info
                listening.audioUrl = result.secure_url;
                listening.duration = Math.ceil(currentTime);

                await listening.save();
                res.redirect(`/admin/listenings/${listening._id}/dialogues`);
            }
        );

        streamifier.createReadStream(finalBuf).pipe(cld_upload_stream);

    } catch (err) {
        console.error("Audio generation error:", err);
        res.status(500).json({ error: "Audio generation failed", details: err.message });
    }
});

// Manage Readings
router.get('/readings', async (req, res) => {
    const hsk = req.query.hsk || 1;
    const readings = await Reading.find({ hskLevel: hsk }).sort('order');
    res.render('readings', { readings, currentHsk: hsk });
});

router.post('/readings/add', readingController.createReading);

router.post('/readings/delete/:id', async (req, res) => {
    const r = await Reading.findByIdAndDelete(req.params.id);
    res.redirect(`/admin/readings?hsk=${r ? r.hskLevel : 1}`);
});

router.post('/readings/analyze', readingController.analyzeText);

// HSK Exams Management
router.get('/hsk-exams', async (req, res) => {
    const hsk = req.query.hsk || 1;
    const exams = await HskExam.find({ hskLevel: hsk }).sort('order');
    res.render('hsk_exams', { exams, currentHsk: hsk });
});

router.post('/hsk-exams/add', async (req, res) => {
    await HskExam.create(req.body);
    res.redirect(`/admin/hsk-exams?hsk=${req.body.hskLevel}`);
});

router.post('/hsk-exams/delete/:id', async (req, res) => {
    const e = await HskExam.findByIdAndDelete(req.params.id);
    res.redirect(`/admin/hsk-exams?hsk=${e ? e.hskLevel : 1}`);
});

router.get('/hsk-exams/:id/details', async (req, res) => {
    const exam = await HskExam.findById(req.params.id);
    res.render('hsk_exam_details', { exam });
});

router.post('/hsk-exams/:id/update-content', async (req, res) => {
    try {
        const { sectionsJson } = req.body;
        const sections = JSON.parse(sectionsJson);
        await HskExam.findByIdAndUpdate(req.params.id, { sections });
        res.redirect(`/admin/hsk-exams/${req.params.id}/details`);
    } catch (err) {
        res.status(400).send("Invalid JSON format: " + err.message);
    }
});

module.exports = router;
