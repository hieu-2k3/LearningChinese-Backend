const { Reading, Word } = require('../models/Content');
const { segmentText } = require('../utils/wordSegmenter');
const { pinyin } = require('pinyin');


// ---------------------------
// API DÀNH CHO CLIENT MAPP (iOS)
// ---------------------------
exports.getAllReadings = async (req, res) => {
    try {
        const hsk = parseInt(req.query.hsk) || 1;
        const readings = await Reading.find({ hskLevel: hsk }).sort('order');

        // Group by category for the SwiftUI App
        const groupedData = readings.reduce((acc, item) => {
            const cat = item.category || 'Khác';
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push({
                _id: item._id,
                title: item.title,
                thumbnail: item.thumbnail,
                order: item.order
            });
            return acc;
        }, {});

        const sections = Object.keys(groupedData).map(cat => ({
            category: cat,
            count: groupedData[cat].length,
            items: groupedData[cat]
        }));

        res.status(200).json({ status: 'success', hskLevel: hsk, data: { sections } });
    } catch (err) {
        res.status(400).json({ status: 'fail', message: err.message });
    }
};

exports.getReadingById = async (req, res) => {
    try {
        const reading = await Reading.findById(req.params.id);
        if (!reading) return res.status(404).json({ status: 'fail', message: 'Không tìm thấy bài đọc' });

        res.status(200).json({ status: 'success', data: { reading } });
    } catch (err) {
        res.status(400).json({ status: 'fail', message: err.message });
    }
};

// ---------------------------
// API DÀNH CHO CMS (ADMIN)
// ---------------------------

// Tự động phân tích đoạn văn (Tokenizer + Pinyin + Meaning)
exports.analyzeText = async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ status: 'fail', message: 'Vui lòng nhập văn bản!' });

        // 1. Cắt từ thông minh bằng DB (Tiết kiệm RAM)
        const tokens = await segmentText(text);
        const segments = tokens.map(t => t.text);

        // Kiểm tra ký tự là chữ Hán hay Dấu câu
        const isChineseChar = (str) => /[\u4e00-\u9fa5]/.test(str);

        // Sử dụng vòng lặp tuần tự (Sequential) thay vì Promise.all để tránh spike RAM trên server 512MB
        const analyzedChunks = [];
        for (const word of segments) {
            let type = 'word';
            let pyStr = '';
            let meaningStr = '';

            if (word === '\n' || word === '\r\n') {
                type = 'newline';
            } else if (!isChineseChar(word)) {
                type = 'punctuation';
            } else {
                const pyArray = pinyin(word, { style: 'tone' });
                pyStr = pyArray.map(item => item[0]).join('');

                const dbWord = await Word.findOne({ hanzi: word }).lean();
                if (dbWord) meaningStr = dbWord.meaning;
            }

            analyzedChunks.push({
                text: word,
                pinyin: pyStr,
                meaning: meaningStr,
                type: type
            });
        }
        
        res.status(200).json({ status: 'success', data: { segments: analyzedChunks } });
    } catch (err) {
        res.status(400).json({ status: 'fail', message: err.message });
    }
};

exports.createReading = async (req, res) => {
    try {
        const reading = await Reading.create(req.body);
        res.status(201).json({ status: 'success', data: { reading } });
    } catch (err) {
        res.status(400).json({ status: 'fail', message: err.message });
    }
};

