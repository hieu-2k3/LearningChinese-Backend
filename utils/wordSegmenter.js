const { Word } = require('../models/Content');

// Bộ từ điển "nóng" cho các từ thông dụng (phòng trường hợp DB thiếu)
const COMMON_WORDS = ['喜欢', '旅游', '朋友', '一起', '参观', '花园', '这里', '那里', '什么', '怎么', '觉得', '因为', '所以', '但是', '非常', '我们', '你们', '他们', '老师', '学生', '手机', '开心', '快乐', '天气', '瀑布', '市场', '水果', '一个月', '上个月', '下个月'];

/**
 * Thuật toán Longest Word Matching (Tra cứu dựa trên Database + Fallback thông minh)
 */
async function segmentText(text) {
    if (!text) return [];
    
    const cleanText = text.replace(/[^\u4e00-\u9fff\u3400-\u4dbf\uF900-\uFAFF0-9]/g, '');
    const tokens = [];
    let i = 0;

    while (i < cleanText.length) {
        let found = false;
        
        // 1. Thử tìm trong DB và bộ từ điển COMMON_WORDS (tối đa 4 ký tự)
        for (let len = 4; len > 1; len--) {
            const chunk = cleanText.substring(i, i + len);
            if (chunk.length < len) continue;

            // Check COMMON_WORDS trước để nhanh
            if (COMMON_WORDS.includes(chunk)) {
                const dbWord = await Word.findOne({ hanzi: chunk }).select('hanzi meaning').lean();
                tokens.push({
                    text: chunk,
                    meaning: dbWord ? dbWord.meaning : 'Bấm để tra nghĩa',
                    type: 'chinese_word'
                });
                i += len;
                found = true;
                break;
            }

            // Check Database
            const dbWord = await Word.findOne({ hanzi: chunk }).select('hanzi meaning').lean();
            if (dbWord) {
                tokens.push({
                    text: dbWord.hanzi,
                    meaning: dbWord.meaning,
                    type: 'chinese_word'
                });
                i += len;
                found = true;
                break;
            }
        }

        // 2. Xử lý từng ký tự đơn hoặc số
        if (!found) {
            const char = cleanText[i];
            if (/[0-9]/.test(char)) {
                tokens.push({ text: char, meaning: '', type: 'number' });
            } else {
                const dbWord = await Word.findOne({ hanzi: char }).select('hanzi meaning').lean();
                tokens.push({
                    text: char,
                    meaning: dbWord ? dbWord.meaning : 'Bấm để tra nghĩa',
                    type: 'chinese_char'
                });
            }
            i++;
        }
    }
    return tokens;
}

module.exports = { segmentText };
