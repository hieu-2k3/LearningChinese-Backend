const { lookupText } = require('./ocrLightController');
const { segmentText } = require('../utils/wordSegmenter');
const { pinyin } = require('pinyin');
const translatte = require('translatte');

exports.lookupText = async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ status: 'fail', message: 'Vui lòng cung cấp văn bản.' });

        // Tách từ thông minh bằng DB (Gộp được "朋友", "学习" thay vì tách lẻ)
        const tokens = await segmentText(text);
        
        const words = tokens.map(token => {
            const py = pinyin(token.text, { style: 'tone' }).map(i => i[0]).join(' ');
            return {
                text: token.text,
                pinyin: py,
                meaning: token.meaning || 'Bấm để tra nghĩa',
                audioUrl: token.audioUrl || `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(token.text)}&type=2`,
                type: token.type === 'number' ? 'number' : 'chinese'
            };
        });

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
