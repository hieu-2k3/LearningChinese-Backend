const { Word } = require('../models/Content');
const User = require('../models/User');

/**
 * Lấy dữ liệu trang chủ từ điển
 */
exports.getDictionaryHome = async (req, res) => {
    try {
        // 1. Bản tin cổ thư (Word of the Day) - Lấy từ mới nhất được set isWordOfTheDay hoặc ngẫu nhiên
        let wordOfTheDay = await Word.findOne({ isWordOfTheDay: true }).sort('-updatedAt');
        
        if (!wordOfTheDay) {
            // Nếu chưa set, lấy ngẫu nhiên 1 từ
            const count = await Word.countDocuments();
            const random = Math.floor(Math.random() * count);
            wordOfTheDay = await Word.findOne().skip(random);
        }

        // 2. Dấu chân lữ khách (Search History) - Lấy từ User profile
        const history = req.user.searchHistory || [];

        // 3. Chòm sao ngữ nghĩa (Categories)
        const categories = [
            { id: "culinary", name: "Ẩm thực", icon: "cup.and.saucer.fill" },
            { id: "place", name: "Địa danh", icon: "map.fill" },
            { id: "comm", name: "Giao tiếp", icon: "bubble.left.and.bubble.right.fill" },
            { id: "culture", name: "Văn hóa", icon: "scroll.fill" }
        ];

        res.status(200).json({
            status: 'success',
            data: {
                wordOfTheDay: {
                    hanzi: wordOfTheDay.hanzi,
                    pinyin: wordOfTheDay.pinyin,
                    meaning: wordOfTheDay.meaning,
                    ancientRecord: wordOfTheDay.ancientRecord || "Trích lục từ điển tích cổ đang được cập nhật..."
                },
                history: history.slice(0, 10), // Trả về 10 từ gần nhất
                categories
            }
        });
    } catch (err) {
        res.status(400).json({ status: 'fail', message: err.message });
    }
};

/**
 * Tìm kiếm từ điển (Hỗ trợ Hanzi, Pinyin, Meaning)
 */
exports.searchWords = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.status(400).json({ status: 'fail', message: 'Vui lòng nhập từ khóa tìm kiếm.' });

        // Tạo Regex tìm kiếm không phân biệt hoa thường
        const searchRegex = new RegExp(q.trim(), 'i');
        
        const results = await Word.find({
            $or: [
                { hanzi: { $regex: searchRegex } },
                { pinyin: { $regex: searchRegex } },
                { meaning: { $regex: searchRegex } }
            ]
        }).limit(20).lean();

        // Cập nhật lịch sử tra cứu cho User (Bất kể là tiếng Việt hay chữ Hán)
        const user = await User.findById(req.user.id);
        if (user) {
            // Đưa từ vừa tra lên đầu, giới hạn 15 từ gần nhất
            const cleanQ = q.trim();
            user.searchHistory = [cleanQ, ...user.searchHistory.filter(h => h !== cleanQ)].slice(0, 15);
            await user.save();
        }

        res.status(200).json({
            status: 'success',
            results: results.length,
            data: { words: results }
        });
    } catch (err) {
        res.status(400).json({ status: 'fail', message: err.message });
    }
};

/**
 * Chi tiết một từ và Điển tích cổ
 */
exports.getWordDetail = async (req, res) => {
    try {
        const { hanzi } = req.params;
        const word = await Word.findOne({ hanzi });

        if (!word) {
            return res.status(404).json({ status: 'fail', message: 'Không tìm thấy thông tin từ này.' });
        }

        // Tăng lượt tra cứu
        word.searchCount += 1;
        await word.save();

        res.status(200).json({
            status: 'success',
            data: {
                word: {
                    ...word._doc,
                    audioUrl: word.audioUrl || `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(word.hanzi)}&tl=zh-CN&client=tw-ob`
                }
            }
        });
    } catch (err) {
        res.status(400).json({ status: 'fail', message: err.message });
    }
};
