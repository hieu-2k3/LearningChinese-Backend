const { Word } = require('../models/Content');
const { pinyin } = require('pinyin');
const translatte = require('translatte');

// API này cực nhẹ, không dùng thư viện Segment tốn RAM
exports.lookupText = async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ status: 'fail', message: 'Vui lòng cung cấp văn bản.' });

        // Chỉ lọc lấy chữ Hán và số
        const cleanText = text.replace(/[^\u4e00-\u9fff\u3400-\u4dbf\uF900-\uFAFF0-9 ]/g, '');
        
        // Tách chữ Hán thành từng ký tự để tra cứu nhanh (không dùng Segment dictionary)
        const characters = cleanText.split('');
        
        const words = await Promise.all(characters.map(async (char) => {
            if (/[0-9 ]/.test(char)) {
                return { text: char, pinyin: '', meaning: '', type: char === ' ' ? 'space' : 'number' };
            }

            const py = pinyin(char, { style: 'tone' }).map(i => i[0]).join(' ');
            const dbWord = await Word.findOne({ hanzi: char }).select('meaning audioUrl').lean();

            return {
                text: char,
                pinyin: py,
                meaning: dbWord ? dbWord.meaning : '',
                audioUrl: dbWord ? dbWord.audioUrl : `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(char)}&type=2`,
                type: 'chinese'
            };
        }));

        // Dịch toàn đoạn (Timeout ngắn)
        let fullMeaning = '';
        try {
            const trans = await translatte(cleanText.substring(0, 200), { to: 'vi' });
            fullMeaning = trans.text;
        } catch (e) {
            fullMeaning = 'Dịch vụ bận.';
        }

        res.status(200).json({
            status: 'success',
            data: {
                filteredText: cleanText,
                fullPinyin: pinyin(cleanText, { style: 'tone' }).map(i => i[0]).join(' '),
                fullMeaning,
                words
            }
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};
