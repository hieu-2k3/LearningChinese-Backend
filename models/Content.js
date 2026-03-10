const mongoose = require('mongoose');

const wordSchema = new mongoose.Schema({
    hanzi: { type: String, required: true },
    pinyin: { type: String, required: true },
    meaning: { type: String, required: true },
    example: { type: String },
    audioUrl: { type: String },
    strokeOrderUrl: { type: String }, // For writing part
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' }
});

const lessonSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    hskLevel: { type: Number, required: true, min: 1, max: 9 }, // HSK 1-9
    thumbnail: { type: String },
    order: { type: Number, default: 0 },

    // Detailed Parts
    vocabulary: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Word' }],
    pronunciation: {
        text: String,
        audioUrl: String,
        description: String
    },
    writing: {
        description: String,
        videoUrl: String // Stroke order video or GIF
    },
    exercises: [{
        type: {
            type: String,
            enum: ['choice', 'matching', 'translate', 'listening', 'fill_blank'],
            default: 'choice'
        },
        question: String,
        audioUrl: String, // For listening type
        options: [String], // For multiple choice
        correctAnswer: mongoose.Schema.Types.Mixed, // Can be index (Number) or string
        pairs: [{ // For matching type
            chinese: String,
            pinyin: String,
            meaning: String
        }],
        explanation: String
    }],
    quizzes: [{
        question: String,
        options: [String],
        correctAnswer: Number, // Index of correct option
        explanation: String
    }],

    type: { type: String, enum: ['standard', 'special'], default: 'standard' }
}, { timestamps: true });

const listeningSchema = new mongoose.Schema({
    title: { type: String, required: true },
    subTitle: { type: String },
    hskLevel: { type: Number, required: true, min: 1, max: 9, default: 1 },
    category: { type: String, required: true, default: "Giao tiếp cơ bản" }, // e.g. "Giao tiếp cơ bản"
    audioUrl: { type: String },
    duration: { type: Number, default: 0 }, // audio duration in seconds
    dialogues: [{
        speaker: { type: String, default: "A" },
        gender: { type: String, enum: ['male', 'female'], default: 'female' },
        hanzi: { type: String, required: true },
        pinyin: { type: String },
        translation: { type: String },
        audioUrl: { type: String }, // Fallback Google TTS URL
        startTime: { type: Number, default: 0 },
        endTime: { type: Number, default: 0 }
    }],
    order: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = {
    Lesson: mongoose.model('Lesson', lessonSchema),
    Word: mongoose.model('Word', wordSchema),
    Listening: mongoose.model('Listening', listeningSchema)
};
