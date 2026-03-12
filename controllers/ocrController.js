require('dotenv').config();
const Segment = require('segment');
const hanzi = require('hanzi');
const { pinyin } = require('pinyin');
const translatte = require('translatte');
const { Word } = require('../models/Content');

console.log('DEBUG: GOOGLE_APPLICATION_CREDENTIALS =', process.env.GOOGLE_APPLICATION_CREDENTIALS);

const { ImageAnnotatorClient } = require('@google-cloud/vision');
const Tesseract = require('tesseract.js');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

// Initialize segment
const segment = new Segment();
segment.useDefault();

// Initialize hanzi
hanzi.start();

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

exports.scanImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ status: 'fail', message: 'Vui lòng cung cấp hình ảnh.' });
        }

        // 1. Perform OCR (Text Recognition)
        // Switch to OCR.Space API as default free alternative
        const rawText = await performOCROcrSpace(req.file.path);

        // 2. Word Segmentation (Tách câu thành các từ có nghĩa)
        const segmented = segment.doSegment(rawText, {
            stripPunctuation: true
        });

        // 3. Process each word to get Pinyin, Meaning and search in Database
        const processedWords = await Promise.all(segmented.map(async (seg) => {
            const text = seg.w;
            
            // Get Pinyin from 'pinyin' library
            const py = pinyin(text, {
                style: 'tone',
            }).map(item => item[0]).join(' ');

            // Get Basic Meaning from 'hanzi' library
            const hanziData = hanzi.definitionLookup(text);
            const basicMeaning = (hanziData && hanziData.length > 0) ? hanziData[0].definition : 'N/A';

            // Optional: Search in our app's own database for advanced data (HSK level, audio, etc.)
            const dbWord = await Word.findOne({ hanzi: text });

            return {
                text: text,
                pinyin: py,
                meaning: basicMeaning,
                dbMeaning: dbWord ? dbWord.meaning : null,
                audioUrl: dbWord ? dbWord.audioUrl : `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=2`,
                isLearned: !!dbWord
            };
        }));

        // Create full pinyin for the entire paragraph
        const fullPinyinArray = pinyin(rawText, { style: 'tone' });
        const fullPinyin = fullPinyinArray.map(item => item[0]).join(' ');

        // Translate the full text to Vietnamese
        let fullMeaning = "Đang cập nhật...";
        try {
            const translation = await translatte(rawText, { to: 'vi' });
            fullMeaning = translation.text;
        } catch (transErr) {
            console.error('Translation Error:', transErr.message);
            fullMeaning = "Không thể dịch tự động do lỗi kết nối (API giới hạn).";
        }

        res.status(200).json({
            status: 'success',
            data: {
                rawText: rawText,
                fullPinyin: fullPinyin,
                fullMeaning: fullMeaning,
                words: processedWords,
                imageUrl: req.file.path // If using Cloudinary/Multer
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
        
        // Lookup detailed info using hanzi library
        const decomposition = hanzi.decompose(word);
        const definition = hanzi.definitionLookup(word);
        const examples = hanzi.getExamples(word);

        // Search in our Word model for HSK info and audio
        const dbWord = await Word.findOne({ hanzi: word });

        res.status(200).json({
            status: 'success',
            data: {
                word: word,
                pinyin: pinyin(word, { style: 'tone' }).map(i => i[0]).join(' '),
                definition: definition,
                decomposition: decomposition,
                examples: examples ? examples.slice(0, 3) : [],
                audioUrl: dbWord ? dbWord.audioUrl : `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=2`,
                hskLevel: dbWord ? dbWord.hskLevel : 'N/A'
            }
        });
    } catch (err) {
        res.status(400).json({ status: 'fail', message: err.message });
    }
};
