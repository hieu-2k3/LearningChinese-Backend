const { Word } = require('../models/Content');
const User = require('../models/User');

/**
 * Lấy dữ liệu trang chủ từ điển
 */
exports.getDictionaryHome = async (req, res) => {
    try {
        // 1. Bản tin cổ thư (Word of the Day)
        let wordOfTheDay = await Word.findOne({ isWordOfTheDay: true }).sort('-updatedAt');
        
        if (!wordOfTheDay) {
            // Nếu không có từ nào được set làm "Word of the Day", lấy ngẫu nhiên 1 từ trong DB
            const count = await Word.countDocuments();
            if (count > 0) {
                const random = Math.floor(Math.random() * count);
                wordOfTheDay = await Word.findOne().skip(random);
            }
        }
        
        if (!wordOfTheDay) {
            // Nếu tuyệt đối không có từ nào trong cả DB (trường hợp DB rỗng hoàn toàn)
            return res.status(200).json({
                status: 'success',
                data: {
                    wordOfTheDay: { hanzi: '---', pinyin: '---', meaning: 'Chưa có dữ liệu từ vựng.', ancientRecord: 'Vui lòng thêm từ vào Database' },
                    history: (req.user && req.user.searchHistory) ? req.user.searchHistory.slice(0, 10) : [],
                    categories: [
                        { id: "culinary", name: "Ẩm thực", icon: "cup.and.saucer.fill" },
                        { id: "place", name: "Địa danh", icon: "map.fill" },
                        { id: "comm", name: "Giao tiếp", icon: "bubble.left.and.bubble.right.fill" },
                        { id: "culture", name: "Văn hóa", icon: "scroll.fill" }
                    ]
                }
            });
        }

        // 2. Dấu chân lữ khách (Search History) - Lấy từ User profile
        const history = (req.user && req.user.searchHistory) ? req.user.searchHistory : [];

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
                    hanzi: wordOfTheDay.hanzi || '---',
                    pinyin: wordOfTheDay.pinyin || '---',
                    meaning: wordOfTheDay.meaning || '---',
                    ancientRecord: wordOfTheDay.ancientRecord || "Trích lục từ điển tích cổ đang được cập nhật..."
                },
                history: [...history].slice(0, 10), // Safe spread
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

        // Thêm trạng thái like/dislike cho kết quả tìm kiếm
        const personalizedWords = results.map(word => {
            const isLiked = req.user.likedWords && req.user.likedWords.some(id => id.toString() === word._id.toString());
            const isDisliked = req.user.dislikedWords && req.user.dislikedWords.some(id => id.toString() === word._id.toString());
            return {
                ...word,
                isLiked,
                isDisliked
            };
        });

        res.status(200).json({
            status: 'success',
            results: results.length,
            data: { words: personalizedWords }
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

        // Kiểm tra xem user có thích hay không thích từ này không
        let isLiked = false;
        let isDisliked = false;
        if (req.user) {
            const user = await User.findById(req.user.id);
            if (user) {
                isLiked = user.likedWords.includes(word._id);
                isDisliked = user.dislikedWords.includes(word._id);
            }
        }

        res.status(200).json({
            status: 'success',
            data: {
                word: {
                    ...word._doc,
                    audioUrl: word.audioUrl || `https://translate.google.com/translate_tts?ie=UTF-8&q=${word.hanzi}&tl=zh-CN&client=tw-ob`,
                    isLiked,
                    isDisliked
                }
            }
        });
    } catch (err) {
        res.status(400).json({ status: 'fail', message: err.message });
    }
};

/**
 * Tương tác với từ vựng (Thích hoặc Không thích)
 */
exports.toggleReaction = async (req, res) => {
    try {
        const { wordId, type } = req.body; // type: 'like' hoặc 'dislike'
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({ status: 'fail', message: 'Người dùng không tồn tại.' });
        }

        if (type === 'like') {
            const isLiked = user.likedWords.includes(wordId);
            if (isLiked) {
                user.likedWords = user.likedWords.filter(id => id.toString() !== wordId);
            } else {
                user.likedWords.push(wordId);
                user.dislikedWords = user.dislikedWords.filter(id => id.toString() !== wordId);
            }
            await user.save();
            return res.status(200).json({
                status: 'success',
                message: isLiked ? 'Đã bỏ thích từ vựng.' : 'Đã thích từ vựng.',
                data: { isLiked: !isLiked, isDisliked: false }
            });
        } else if (type === 'dislike') {
            const isDisliked = user.dislikedWords.includes(wordId);
            if (isDisliked) {
                user.dislikedWords = user.dislikedWords.filter(id => id.toString() !== wordId);
            } else {
                user.dislikedWords.push(wordId);
                user.likedWords = user.likedWords.filter(id => id.toString() !== wordId);
            }
            await user.save();
            return res.status(200).json({
                status: 'success',
                message: isDisliked ? 'Đã bỏ không thích từ vựng.' : 'Đã không thích từ vựng.',
                data: { isLiked: false, isDisliked: !isDisliked }
            });
        } else {
            return res.status(400).json({ status: 'fail', message: 'Loại tương tác không hợp lệ.' });
        }
    } catch (err) {
        res.status(400).json({ status: 'fail', message: err.message });
    }
};


/**
 * Lấy danh sách từ vựng đã thích của người dùng
 */
exports.getFavoriteWords = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate('likedWords');
        
        if (!user) {
            return res.status(404).json({ status: 'fail', message: 'Người dùng không tồn tại.' });
        }

        res.status(200).json({
            status: 'success',
            results: user.likedWords.length,
            data: {
                favorites: user.likedWords
            }
        });
    } catch (err) {
        res.status(400).json({ status: 'fail', message: err.message });
    }
};

