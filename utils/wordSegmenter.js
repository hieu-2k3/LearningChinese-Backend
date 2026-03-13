const { Word } = require('../models/Content');

/**
 * Thuật toán Longest Word Matching (Tra cứu dựa trên Database)
 * Giúp tách từ mà không cần bộ từ điển 100MB trong RAM.
 */
async function segmentText(text) {
    if (!text) return [];
    
    // Lọc lấy chữ Hán
    const cleanText = text.replace(/[^\u4e00-\u9fff\u3400-\u4dbf\uF900-\uFAFF0-9]/g, '');
    const tokens = [];
    let i = 0;

    while (i < cleanText.length) {
        let found = false;
        
        // Thử tìm từ dài nhất (tối đa 4 ký tự) trong Database
        for (let len = 4; len > 1; len--) {
            const chunk = cleanText.substring(i, i + len);
            if (chunk.length < len) continue;

            const dbWord = await Word.findOne({ hanzi: chunk }).select('hanzi meaning audioUrl').lean();
            if (dbWord) {
                tokens.push({
                    text: dbWord.hanzi,
                    meaning: dbWord.meaning,
                    audioUrl: dbWord.audioUrl,
                    type: 'chinese_word'
                });
                i += len;
                found = true;
                break;
            }
        }

        // Nếu không tìm thấy từ ghép, xử lý từng ký tự đơn hoặc số
        if (!found) {
            const char = cleanText[i];
            if (/[0-9]/.test(char)) {
                tokens.push({ text: char, meaning: '', type: 'number' });
            } else {
                const dbWord = await Word.findOne({ hanzi: char }).select('hanzi meaning audioUrl').lean();
                tokens.push({
                    text: char,
                    meaning: dbWord ? dbWord.meaning : '',
                    audioUrl: dbWord ? dbWord.audioUrl : null,
                    type: 'chinese_char'
                });
            }
            i++;
        }
    }
    return tokens;
}

module.exports = { segmentText };
