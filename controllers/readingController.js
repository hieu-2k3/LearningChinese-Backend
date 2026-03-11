const { Reading } = require('../models/Content');
const nodejieba = require('nodejieba');
const { pinyin } = require('pinyin');
const hanzi = require('hanzi');

let isHanziStarted = false;

// Khởi tạo thư viện từ điển khi cần
const ensureHanziStarted = () => {
    if (!isHanziStarted) {
        hanzi.start();
        isHanziStarted = true;
    }
};

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

        ensureHanziStarted();

        // 1. Cắt từ thông minh bằng nodejieba
        const segments = nodejieba.cut(text);
        const analyzedChunks = [];

        // Kiểm tra ký tự là chữ Hán hay Dấu câu
        const isChineseChar = (str) => /[\u4e00-\u9fa5]/.test(str);

        for (const word of segments) {
            let type = 'word';
            let pyStr = '';
            let meaningStr = '';

            if (word === '\n' || word === '\r\n') {
                type = 'newline';
            } else if (!isChineseChar(word)) {
                // Các dấu câu, số, chữ Alphabet -> không phải 'word' cần học
                type = 'punctuation';
            } else {
                // Lấy Pinyin
                const pyArray = pinyin(word, { style: 'tone' });
                pyStr = pyArray.map(item => item[0]).join('');

                // Tra từ điển lấy nghĩa tiếng Việt (tạm dùng Anh do CSDL Hanzi mặc định là tiếng Anh, Admin có thể sửa)
                const dictRes = hanzi.definitionLookup(word);
                if (dictRes && dictRes.length > 0) {
                    // Lấy nghĩa đầu tiên, chỉ lấy 2 mô tả đầu để ngắn gọn
                    meaningStr = dictRes[0].definition.split('/').slice(0, 2).join(', ');
                }
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
