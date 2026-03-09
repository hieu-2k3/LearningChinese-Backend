const mongoose = require('mongoose');

const wordSchema = new mongoose.Schema({
    hanzi: { type: String, required: true },
    pinyin: { type: String, required: true },
    meaning: { type: String, required: true },
    example: { type: String },
    audioUrl: { type: String },
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' }
});

const lessonSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    level: { type: Number, required: true }, // HSK Level
    type: { type: String, enum: ['vocabulary', 'grammar', 'listening'], default: 'vocabulary' },
    thumbnail: { type: String },
    words: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Word' }],
    content: { type: String }, // For articles or long content
    order: { type: Number, default: 0 }
}, { timestamps: true });

const listeningSchema = new mongoose.Schema({
    title: { type: String, required: true },
    audioUrl: { type: String, required: true },
    transcript: { type: String },
    translation: { type: String },
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' }
});

module.exports = {
    Lesson: mongoose.model('Lesson', lessonSchema),
    Word: mongoose.model('Word', wordSchema),
    Listening: mongoose.model('Listening', listeningSchema)
};
