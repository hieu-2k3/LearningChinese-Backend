const mongoose = require('mongoose');

const hskExamSchema = new mongoose.Schema({
    title: { type: String, required: true },
    hskLevel: { type: Number, required: true, min: 1, max: 9 },
    duration: { type: Number, default: 40 }, // in minutes
    totalQuestions: { type: Number },
    thumbnail: { type: String },
    sections: [{
        name: String, // Listening, Reading, Writing
        audioUrl: String, // Main audio for the section
        parts: [{
            partNumber: Number,
            instruction: String,
            questions: [{
                type: {
                    type: String,
                    enum: ['true_false_image', 'image_selection', 'multiple_choice', 'matching_image', 'fill_blank', 'reorder'],
                    required: true
                },
                text: String, // For reading questions
                image: String, // For image-based questions
                images: [String], // For multiple images in options
                options: [String], // Array of text options
                audioTimestamp: {
                    start: Number, // in seconds
                    end: Number
                },
                correctAnswer: String,
                explanation: String
            }]
        }]
    }],
    order: { type: Number, default: 0 }
}, { timestamps: true });

const hskResultSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    examId: { type: mongoose.Schema.Types.ObjectId, ref: 'HskExam', required: true },
    score: { type: Number, required: true },
    totalScore: { type: Number, default: 300 },
    percentage: { type: Number },
    timeSpent: { type: Number }, // seconds
    answers: [{
        questionId: String,
        userAnswer: String,
        isCorrect: Boolean
    }]
}, { timestamps: true });

module.exports = {
    HskExam: mongoose.model('HskExam', hskExamSchema),
    HskResult: mongoose.model('HskResult', hskResultSchema)
};
