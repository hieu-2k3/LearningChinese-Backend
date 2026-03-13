require('dotenv').config();
const Segment = require('segment');
const { pinyin } = require('pinyin');
const translatte = require('translatte');
const { Word } = require('../models/Content');

console.log('DEBUG: GOOGLE_APPLICATION_CREDENTIALS =', process.env.GOOGLE_APPLICATION_CREDENTIALS);

const { ImageAnnotatorClient } = require('@google-cloud/vision');
const Tesseract = require('tesseract.js');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

// Initialize segment (Dùng khoảng 115MB RAM, an toàn cho server 512MB)
const segment = new Segment();
segment.useDefault();

// Initialize Google Vision Client lazily
let visionClient;
const getVisionClient = () => {
    if (!visionClient) {
        const credsContent = process.env.GOOGLE_CREDS_JSON;
        
        if (credsContent) {
            console.log('Initializing Vision Client using GOOGLE_CREDS_JSON environment variable...');
            try {
                const credentials = JSON.parse(credsContent);
                visionClient = new ImageAnnotatorClient({ credentials });
            } catch (err) {
                console.error('Failed to parse GOOGLE_CREDS_JSON:', err.message);
                throw new Error('Cấu hình GOOGLE_CREDS_JSON không hợp lệ.');
            }
        } else {
            console.log('Initializing Vision Client using key file:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
            visionClient = new ImageAnnotatorClient({
                keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
            });
        }
    }
    return visionClient;
};

/**
 * Real OCR function using Google Cloud Vision
 */
const performOCR = async (imagePath) => {
    try {
        console.log('--- Starting OCR Process ---');
        console.log('Target Image Path:', imagePath);
        
        const client = getVisionClient();
        const [result] = await client.textDetection(imagePath);
        
        if (!result) {
            console.error('OCR Result is empty or undefined');
            throw new Error('Google Vision không trả về kết quả.');
        }

        const fullText = result.fullTextAnnotation ? result.fullTextAnnotation.text : '';
        console.log('Recognized Text Length:', fullText.length);
        
        if (fullText.length === 0) {
            console.warn('OCR detected zero characters.');
        }

        return fullText.replace(/\r?\n|\r/g, " ");
    } catch (error) {
        console.error('--- Google Vision Detailed Error ---');
        console.error('Error Code:', error.code);
        console.error('Error Message:', error.message);
        console.error('------------------------------------');
        throw new Error(`Lỗi nhận diện Google Vision: ${error.message}`);
    }
};

/**
 * Alternative OCR function using Tesseract.js (Free, no cloud billing)
 */
const performOCRTesseract = async (imagePath) => {
    try {
        console.log('--- Starting Tesseract OCR Process ---');
        console.log('Target Image Path:', imagePath);
        
        // Use 'chi_sim' for Simplified Chinese. 'chi_tra' for Traditional.
        const result = await Tesseract.recognize(
            imagePath,
            'chi_sim',
            { logger: m => console.log(`Tesseract Progress: ${m.status} ${Math.round(m.progress * 100)}%`) }
        );
        
        const fullText = result.data.text || '';
        console.log('Recognized Text Length:', fullText.length);
        
        if (fullText.length === 0) {
            console.warn('OCR detected zero characters.');
        }

        // Clean up newlines and whitespaces
        return fullText.replace(/\s+/g, "");
    } catch (error) {
        console.error('--- Tesseract OCR Detailed Error ---');
        console.error('Error Message:', error.message);
        console.error('------------------------------------');
        throw new Error(`Lỗi nhận diện Tesseract: ${error.message}`);
    }
};

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
            }
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
    try {
        if (!req.file) {
            return res.status(400).json({ status: 'fail', message: 'Vui lòng cung cấp hình ảnh.' });
        }

        // 1. Perform OCR (Text Recognition)
        const rawText = await performOCROcrSpace(req.file.path);

        // 2. Lọc: Chỉ giữ lại chữ Hán + số, bỏ hết ký tự Latin, dấu câu, ký tự đặc biệt
        //    Regex: giữ ký tự CJK (\u4e00-\u9fff, mở rộng) và chữ số 0-9
        const chineseAndNumbers = rawText.replace(/[^\u4e00-\u9fff\u3400-\u4dbf\uF900-\uFAFF0-9]/g, '');
        console.log('Filtered text (Chinese + numbers only):', chineseAndNumbers);

        if (!chineseAndNumbers || chineseAndNumbers.length === 0) {
            return res.status(200).json({
                status: 'success',
                data: {
                    rawText: rawText,
                    filteredText: chineseAndNumbers,
                    fullPinyin: '',
                    fullMeaning: 'Không tìm thấy chữ Tiếng Trung trong ảnh.',
                    words: [],
                    imageUrl: req.file.path
                }
            });
        }

        // 3. Chỉ lấy phần chữ Hán (không kèm số) để dịch và tạo pinyin đoạn văn
        const chineseOnly = chineseAndNumbers.replace(/[0-9]/g, '');

        // 4. Word Segmentation: Tách câu thành các từ có nghĩa (chỉ dùng trên phần chữ Hán)
        const segmented = segment.doSegment(chineseOnly, { stripPunctuation: true });

        // 5. Xây dựng danh sách từ: chữ Hán được tra pinyin + nghĩa, số giữ nguyên
        //    Tách số từ chuỗi gốc đan xen với chữ Hán để giữ đúng thứ tự hiển thị
        const tokens = [];
        let buffer = '';
        for (const char of chineseAndNumbers) {
            if (/[0-9]/.test(char)) {
                if (buffer) { tokens.push({ type: 'chinese', value: buffer }); buffer = ''; }
                // Gộp số liên tiếp
                if (tokens.length > 0 && tokens[tokens.length - 1].type === 'number') {
                    tokens[tokens.length - 1].value += char;
                } else {
                    tokens.push({ type: 'number', value: char });
                }
            } else {
                buffer += char;
            }
        }
        if (buffer) tokens.push({ type: 'chinese', value: buffer });

        // Xử lý từng token
        const processedWords = [];
        for (const token of tokens) {
            if (token.type === 'number') {
                // Số: không cần pinyin / nghĩa
                processedWords.push({
                    text: token.value,
                    pinyin: '',
                    meaning: '',
                    dbMeaning: null,
                    audioUrl: null,
                    isLearned: false,
                    type: 'number'
                });
            } else {
                // Chữ Hán: tách từ và tra nghĩa
                const chunkSegmented = segment.doSegment(token.value, { stripPunctuation: true });
                const chunkWords = await Promise.all(chunkSegmented.map(async (seg) => {
                    const text = seg.w;
                    if (!isChineseChar(text)) return null; // bỏ nếu không phải chữ Hán

                    const py = pinyin(text, { style: 'tone' }).map(item => item[0]).join(' ');
                    const dbWord = await Word.findOne({ hanzi: text }).lean();

                    return {
                        text: text,
                        pinyin: py,
                        meaning: dbWord ? dbWord.meaning : 'Bấm để tra nghĩa chi tiết',
                        dbMeaning: dbWord ? dbWord.meaning : null,
                        audioUrl: dbWord && dbWord.audioUrl
                            ? dbWord.audioUrl
                            : `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=2`,
                        isLearned: !!dbWord,
                        type: 'chinese'
                    };
                }));
                processedWords.push(...chunkWords.filter(Boolean));
            }
        }

        // 6. Tạo pinyin toàn đoạn (chỉ từ chữ Hán)
        const fullPinyinArray = pinyin(chineseOnly, { style: 'tone' });
        const fullPinyin = fullPinyinArray.map(item => item[0]).join(' ');

        // 7. Dịch toàn bộ phần chữ Hán sang Tiếng Việt
        let fullMeaning = 'Đang cập nhật...';
        try {
            const translation = await translatte(chineseOnly, { to: 'vi' });
            fullMeaning = translation.text;
        } catch (transErr) {
            console.error('Translation Error:', transErr.message);
            fullMeaning = 'Không thể dịch tự động do lỗi kết nối (API giới hạn).';
        }

        res.status(200).json({
            status: 'success',
            data: {
                rawText: rawText,
                filteredText: chineseAndNumbers,
                fullPinyin: fullPinyin,
                fullMeaning: fullMeaning,
                words: processedWords,
                imageUrl: req.file.path
            }
        });

    } catch (err) {
        console.error('OCR Error:', err);
        res.status(500).json({ status: 'error', message: err.message });
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
                audioUrl: dbWord && dbWord.audioUrl ? dbWord.audioUrl : `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=2`,
                hskLevel: dbWord && dbWord.hskLevel ? dbWord.hskLevel : 'N/A'
            }
        });
    } catch (err) {
        res.status(400).json({ status: 'fail', message: err.message });
    }
};

