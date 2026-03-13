const { segmentText } = require('../utils/wordSegmenter');
const { pinyin } = require('pinyin');
const translatte = require('translatte');

exports.lookupText = async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ status: 'fail', message: 'Vui lòng cung cấp văn bản.' });

        // Định nghĩa cleanText để tránh lỗi "not defined"
        const cleanText = text.replace(/[^\u4e00-\u9fff\u3400-\u4dbf\uF900-\uFAFF0-9 ]/g, '');

        // Tách từ thông minh bằng DB
        const tokens = await segmentText(cleanText);
        
        const words = tokens.map(token => {
            const py = pinyin(token.text, { style: 'tone' }).map(i => i[0]).join(' ');
            return {
                text: token.text,
                pinyin: py,
                meaning: token.meaning || 'Bấm để tra nghĩa',
                audioUrl: `https://translate.google.com/translate_tts?ie=UTF-8&q=${token.text}&tl=zh-CN&client=tw-ob`,
                type: token.type === 'number' ? 'number' : 'chinese'
            };
        });

        // Dịch toàn đoạn
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
