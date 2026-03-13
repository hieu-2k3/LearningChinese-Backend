require('dotenv').config();
const { pinyin } = require('pinyin');
const translatte = require('translatte');
const { Word } = require('../models/Content');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

console.log('OCR Engine: OCR.Space API (free tier)');

const { segmentText } = require('../utils/wordSegmenter');

/**
 * Alternative OCR function using OCR.Space API (Free, needs email registration)
 */
const performOCROcrSpace = async (imagePath) => {
    try {
        console.log('--- Starting OCR.Space OCR Process ---');
        console.log('Target Image Path:', imagePath);
        
        const formData = new FormData();
        if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
            formData.append('url', imagePath);
        } else {
            formData.append('file', fs.createReadStream(imagePath));
        }
        formData.append('apikey', process.env.OCR_SPACE_API_KEY || 'helloworld'); // 'helloworld' is a public test key, but rate limited
        formData.append('language', 'chs'); // chs = Simplified Chinese
        formData.append('isOverlayRequired', 'false');

        const response = await axios.post('https://api.ocr.space/parse/image', formData, {
            headers: {
                ...formData.getHeaders()
            },
            timeout: 30000 // 30 giây timeout
        });

        const data = response.data;
        
        if (data.IsErroredOnProcessing) {
            throw new Error(data.ErrorMessage[0]);
        }
        
        const fullText = data.ParsedResults && data.ParsedResults.length > 0 
            ? data.ParsedResults[0].ParsedText 
            : '';
            
        console.log('Recognized Text Length:', fullText.length);
        
        if (fullText.length === 0) {
            console.warn('OCR detected zero characters.');
        }

        // Clean up newlines and whitespaces for better segmentation
        return fullText.replace(/\r?\n|\r/g, "");
    } catch (error) {
        console.error('--- OCR.Space Detailed Error ---');
        console.error('Error Message:', error.message);
        console.error('------------------------------------');
        throw new Error(`Lỗi nhận diện OCR.Space: ${error.message}`);
    }
};

// Helper: Kiểm tra chuỗi có chứa chữ Hán không
const isChineseChar = (str) => /[\u4e00-\u9fff\u3400-\u4dbf\uF900-\uFAFF]/.test(str);

// Helper: Kiểm tra chuỗi có phải là số không
const isNumber = (str) => /^[0-9]+$/.test(str);

exports.scanImage = async (req, res) => {
    let rawText = '';
    try {
        if (!req.file) return res.status(400).json({ status: 'fail', message: 'Vui lòng cung cấp hình ảnh.' });

        // 1. OCR
        try {
            rawText = await performOCROcrSpace(req.file.path);
        } catch (ocrErr) {
            return res.status(503).json({ status: 'error', message: 'Không thể nhận diện văn bản.' });
        }

        // 2. Filter & Truncate (Cực kỳ quan trọng để giữ RAM thấp)
        let filtered = rawText.replace(/[^\u4e00-\u9fff\u3400-\u4dbf\uF900-\uFAFF0-9]/g, '');
        if (filtered.length > 800) filtered = filtered.substring(0, 800); // Giảm xuống 800 cho an toàn tuyệt đối
        
        if (!filtered) {
            return res.status(200).json({
                status: 'success',
                data: { rawText, filteredText: '', fullPinyin: '', fullMeaning: 'Không có chữ Hán.', words: [], imageUrl: req.file.path }
            });
        }

        // 3. Tách Tokens (Số và Chữ Hán)
        const tokens = [];
        let numBuf = '';
        for (const char of filtered) {
            if (/[0-9]/.test(char)) {
                numBuf += char;
            } else {
                if (numBuf) { tokens.push({ type: 'num', val: numBuf }); numBuf = ''; }
                if (tokens.length > 0 && tokens[tokens.length - 1].type === 'cn_raw') {
                    tokens[tokens.length - 1].val += char;
                } else {
                    tokens.push({ type: 'cn_raw', val: char });
                }
            }
        }
        if (numBuf) tokens.push({ type: 'num', val: numBuf });

        // 4. Xử lý tuần tự (Không dùng Promise.all để tránh spike RAM)
        const wordsArr = [];
        let combinedPinyin = '';
        
        for (const token of tokens) {
            if (token.type === 'num') {
                wordsArr.push({ text: token.val, pinyin: '', meaning: '', dbMeaning: null, audioUrl: null, isLearned: false, type: 'number' });
                combinedPinyin += token.val + ' ';
            } else {
                // Dùng wordSegmenter mới
                const segs = await segmentText(token.val);
                for (const s of segs) {
                    const text = s.text;
                    const py = pinyin(text, { style: 'tone' }).map(i => i[0]).join(' ');

                    wordsArr.push({
                        text, pinyin: py,
                        meaning: s.meaning || 'Bấm để xem nghĩa',
                        dbMeaning: s.meaning || null,
                        audioUrl: s.audioUrl || `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=zh-CN&client=tw-ob`,
                        isLearned: !!s.meaning,
                        type: 'chinese'
                    });
                    combinedPinyin += py + ' ';
                }
            }
        }

        // 5. Dịch (Chỉ dịch 300 ký tự đầu để siêu tiết kiệm RAM)
        const toTranslate = filtered.replace(/[0-9]/g, '').substring(0, 300);
        let meaning = 'Đang cập nhật...';
        if (toTranslate) {
            try {
                const trans = await Promise.race([
                    translatte(toTranslate, { to: 'vi' }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('T')), 7000))
                ]);
                meaning = trans.text;
            } catch (e) { meaning = 'Dịch vụ bận, vui lòng tra cứu từng từ.'; }
        }

        res.status(200).json({
            status: 'success',
            data: { rawText, filteredText: filtered, fullPinyin: combinedPinyin.trim(), fullMeaning: meaning, words: wordsArr, imageUrl: req.file.path }
        });

    } catch (err) {
        res.status(500).json({ status: 'error', message: 'Lỗi hệ thống (RAM): ' + err.message });
    }
};

exports.getWordDetail = async (req, res) => {
    try {
        const { word } = req.params;
        
        // Search in our Word model for HSK info and audio
        const dbWord = await Word.findOne({ hanzi: word });

        // Dịch nghĩa Vietnamese sử dụng translatte thay vì thư viện hanzi (để giảm RAM)
        let definitionText = dbWord ? dbWord.meaning : "Đang cập nhật...";
        if (!dbWord) {
            try {
                const trans = await translatte(word, { to: 'vi' });
                definitionText = trans.text;
            } catch(e) {
                console.error("Lỗi Google Translate:", e.message);
            }
        }

        res.status(200).json({
            status: 'success',
            data: {
                word: word,
                pinyin: pinyin(word, { style: 'tone' }).map(i => i[0]).join(' '),
                definition: [ { definition: definitionText } ], // Format giả lập thư viện hanzi trả về
                decomposition: { character: word, components1: [], components2: [] }, // Format giả lập
                examples: [],
                audioUrl: dbWord && dbWord.audioUrl ? dbWord.audioUrl : `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(word)}&tl=zh-CN&client=tw-ob`,
                hskLevel: dbWord && dbWord.hskLevel ? dbWord.hskLevel : 'N/A'
            }
        });
    } catch (err) {
        res.status(400).json({ status: 'fail', message: err.message });
    }
};

