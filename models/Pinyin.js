const mongoose = require('mongoose');

const pinyinSchema = new mongoose.Schema({
    sound: { type: String, required: true, unique: true }, // e.g., 'b', 'p', 'ai'
    type: {
        type: String,
        enum: ['initial', 'final', 'tone', 'combination'],
        required: true
    },
    group: { type: String }, // e.g., 'Âm môi', 'Âm lưỡi', 'Vận mẫu đơn', 'Vận mẫu kép'
    description: { type: String }, // Hướng dẫn phát âm chi tiết
    tips: { type: String }, // Mẹo nhớ
    audioUrl: { type: String },
    videoUrl: { type: String }, // Link video/gif hướng dẫn khẩu hình
    examples: [{
        hanzi: String,
        pinyin: String,
        meaning: String,
        audioUrl: String
    }]
}, { timestamps: true });

const pinyinRuleSchema = new mongoose.Schema({
    title: { type: String, required: true },
    ruleCode: { type: String, unique: true }, // e.g., 'third_tone_change'
    description: { type: String, required: true },
    examples: [{
        text: String,
        pinyin: String,
        meaning: String
    }]
}, { timestamps: true });

module.exports = {
    Pinyin: mongoose.model('Pinyin', pinyinSchema),
    PinyinRule: mongoose.model('PinyinRule', pinyinRuleSchema)
};
