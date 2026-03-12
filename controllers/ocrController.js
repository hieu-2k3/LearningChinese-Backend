require('dotenv').config();
const Segment = require('segment');
const hanzi = require('hanzi');
const { pinyin } = require('pinyin');
const { Word } = require('../models/Content');

console.log('DEBUG: GOOGLE_APPLICATION_CREDENTIALS =', process.env.GOOGLE_APPLICATION_CREDENTIALS);

const { ImageAnnotatorClient } = require('@google-cloud/vision');

// Initialize segment
const segment = new Segment();
segment.useDefault();

// Initialize hanzi
hanzi.start();

// Initialize Google Vision Client lazily
let visionClient;
const getVisionClient = () => {
    if (!visionClient) {
        console.log('Initializing Vision Client with:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
        visionClient = new ImageAnnotatorClient({
            keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
        });
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
        throw new Error(`Lỗi nhận diện: ${error.message}`);
    }
};

exports.scanImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ status: 'fail', message: 'Vui lòng cung cấp hình ảnh.' });
        }

        // 1. Perform OCR (Text Recognition)
        // Note: For now we use the mock function. 
        // In a real app, you'd send req.file.path or req.file.buffer to the OCR service.
        const rawText = await performOCR(req.file.path);

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

        res.status(200).json({
            status: 'success',
            data: {
                rawText: rawText,
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
