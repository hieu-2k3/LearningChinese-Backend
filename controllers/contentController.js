const { Lesson, Word, Listening } = require('../models/Content');
const User = require('../models/User');
const segment = require('../utils/segment');


exports.getAllLessons = async (req, res) => {
    try {
        const hsk = parseInt(req.query.hsk) || 1;

        // 1. Check if HSK level is unlocked
        if (hsk > 1) {
            const previousLevelLessons = await Lesson.find({ hskLevel: hsk - 1 });
            const previousLevelIds = previousLevelLessons.map(l => l._id.toString());
            const userCompletedIds = req.user.completedLessons.map(id => id.toString());

            const isPreviousLevelComplete = previousLevelIds.every(id => userCompletedIds.includes(id));

            if (!isPreviousLevelComplete && previousLevelIds.length > 0) {
                return res.status(403).json({
                    status: 'fail',
                    message: `Bạn cần hoàn thành tất cả bài học ở HSK ${hsk - 1} để mở khóa HSK ${hsk}.`
                });
            }
        }

        const lessons = await Lesson.find({ hskLevel: hsk }).sort('order');
        const completedIds = req.user.completedLessons.map(id => id.toString());

        const personalizedLessons = lessons.map(lesson => ({
            ...lesson._doc,
            level: lesson.hskLevel, // Map hskLevel to level for Swift App
            isCompleted: completedIds.includes(lesson._id.toString())
        }));

        res.status(200).json({
            status: 'success',
            hskLevel: hsk,
            results: personalizedLessons.length,
            data: { lessons: personalizedLessons }
        });
    } catch (err) {
        res.status(400).json({ status: 'fail', message: err.message });
    }
};

exports.updateProgress = async (req, res) => {
    try {
        const { lessonId, xpGained } = req.body;
        const user = req.user;

        // Update XP
        user.xp += xpGained;

        // Update Streak (Calendar Day Logic)
        const now = new Date();

        if (!user.lastActive) {
            user.streak = 1;
        } else {
            const lastActive = new Date(user.lastActive);

            // Normalize both dates to UTC midnight to compare calendar days
            const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
            const lastActiveUTC = Date.UTC(lastActive.getUTCFullYear(), lastActive.getUTCMonth(), lastActive.getUTCDate());

            // Calculate difference in days
            const diffDays = Math.floor((todayUTC - lastActiveUTC) / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                user.streak += 1; // Học liên tiếp ngày tiếp theo
            } else if (diffDays > 1) {
                user.streak = 1; // Bị đứt chuỗi, bắt đầu lại
            }
            // diffDays === 0: Học nhiều lần trong cùng 1 ngày, giữ nguyên streak
        }

        user.lastActive = now;

        // Mark lesson as completed
        if (lessonId && !user.completedLessons.includes(lessonId)) {
            user.completedLessons.push(lessonId);
        }

        await user.save();

        res.status(200).json({
            status: 'success',
            data: {
                xp: user.xp,
                streak: user.streak,
                completedLessons: user.completedLessons.length
            }
        });
    } catch (err) {
        res.status(400).json({ status: 'fail', message: err.message });
    }
};

exports.getLeaderboard = async (req, res) => {
    try {
        const topUsers = await User.find()
            .select('username avatar xp streak')
            .sort('-xp')
            .limit(10);

        res.status(200).json({
            status: 'success',
            data: { leaderboard: topUsers }
        });
    } catch (err) {
        res.status(400).json({ status: 'fail', message: err.message });
    }
};

exports.getLessonById = async (req, res) => {
    try {
        const lesson = await Lesson.findById(req.params.id).populate('vocabulary');
        if (!lesson) {
            return res.status(404).json({
                status: 'fail',
                message: 'Không tìm thấy bài học này.'
            });
        }

        res.status(200).json({
            status: 'success',
            data: { lesson }
        });
    } catch (err) {
        res.status(400).json({ status: 'fail', message: err.message });
    }
};

exports.getLessonPractice = async (req, res) => {
    try {
        const lesson = await Lesson.findById(req.params.id).populate('vocabulary');
        if (!lesson) {
            return res.status(404).json({ status: 'fail', message: 'Bài học không tồn tại.' });
        }

        let practiceSession = [];

        // 1. Add hand-crafted exercises from CMS
        if (lesson.exercises && lesson.exercises.length > 0) {
            practiceSession = [...lesson.exercises];
        }

        // 2. Auto-generate exercises from Vocabulary (Smart Idea 2)
        if (lesson.vocabulary && lesson.vocabulary.length > 1) {
            // Generate Matching exercise from Vocabulary
            const vocabPairs = lesson.vocabulary.slice(0, 5).map(v => ({
                chinese: v.hanzi,
                pinyin: v.pinyin,
                meaning: v.meaning
            }));

            practiceSession.push({
                type: 'matching',
                question: 'Nối từ chữ Hán với phiên âm và nghĩa đúng',
                pairs: vocabPairs
            });

            // Generate Choice exercises for each word
            lesson.vocabulary.forEach(v => {
                const distractions = lesson.vocabulary
                    .filter(item => item._id !== v._id)
                    .map(item => item.meaning)
                    .sort(() => 0.5 - Math.random())
                    .slice(0, 3);

                practiceSession.push({
                    type: 'choice',
                    question: `Từ "${v.hanzi}" (${v.pinyin}) có nghĩa là gì?`,
                    options: [...distractions, v.meaning].sort(() => 0.5 - Math.random()),
                    correctAnswer: v.meaning,
                    explanation: `"${v.hanzi}" có nghĩa là "${v.meaning}"`
                });

                // SMART IDEA: Auto-generate Fill in the Blank from example sentence
                if (v.example && v.example.includes(v.hanzi)) {
                    const blankSentence = v.example.replace(v.hanzi, ' ___ ');
                    const wordDistractions = lesson.vocabulary
                        .filter(item => item._id !== v._id)
                        .map(item => item.hanzi)
                        .sort(() => 0.5 - Math.random())
                        .slice(0, 3);

                    practiceSession.push({
                        type: 'fill_blank',
                        question: `Điền từ còn thiếu vào câu sau: "${blankSentence}"`,
                        options: [...wordDistractions, v.hanzi].sort(() => 0.5 - Math.random()),
                        correctAnswer: v.hanzi,
                        explanation: `Câu hoàn chỉnh: "${v.example}"`
                    });
                }

                // SMART IDEA: Auto-generate REORDER exercise from vocabulary example
                if (v.example && v.example.length >= 2) {
                    const words = segment.doSegment(v.example)
                        .map(s => s.w)
                        .filter(w => /[\u4e00-\u9fa5]/.test(w));

                    if (words.length >= 2) {
                        practiceSession.push({
                            type: 'reorder',
                            question: 'Sắp xếp các từ sau thành câu đúng:',
                            meaning: (v.meaning || "") + " (Ví dụ)",
                            shuffledWords: [...words].sort(() => 0.5 - Math.random()),
                            correctAnswer: words.join(''),
                            explanation: `Câu đúng: ${v.example}`
                        });
                    }
                }
            });
        }

        // 3. Auto-generate REORDER from Grammar Points
        if (lesson.grammarPoints && lesson.grammarPoints.length > 0) {
            lesson.grammarPoints.forEach(gp => {
                gp.examples.forEach(ex => {
                    const words = segment.doSegment(ex.hanzi)
                        .map(s => s.w)
                        .filter(w => /[\u4e00-\u9fa5]/.test(w));

                    if (words.length >= 2) {
                        practiceSession.push({
                            type: 'reorder',
                            question: `Luyện tập cấu trúc: ${gp.title}`,
                            meaning: ex.meaning,
                            shuffledWords: [...words].sort(() => 0.5 - Math.random()),
                            correctAnswer: words.join(''),
                            explanation: `Cấu trúc: ${gp.formula}`
                        });
                    }
                });
            });
        }

        // 4. EMERGENCY FALLBACKS: If any type is missing, create a simplified version from vocab
        const hasType = (t) => practiceSession.some(ex => ex.type === t);

        if (!hasType('fill_blank') && lesson.vocabulary && lesson.vocabulary.length > 0) {
            // Fallback for fill_blank: Pinyin to Hanzi
            lesson.vocabulary.slice(0, 3).forEach(v => {
                practiceSession.push({
                    type: 'fill_blank',
                    question: `Chọn chữ Hán đúng cho phiên âm "${v.pinyin}":`,
                    options: lesson.vocabulary.map(item => item.hanzi).sort(() => 0.5 - Math.random()).slice(0, 4),
                    correctAnswer: v.hanzi,
                    explanation: `${v.hanzi} đọc là ${v.pinyin}`
                });
            });
        }

        if (!hasType('reorder') && lesson.vocabulary && lesson.vocabulary.length > 0) {
            // Fallback for reorder: Split the word into characters if it's a multi-char word
            lesson.vocabulary.filter(v => v.hanzi.length >= 2).slice(0, 3).forEach(v => {
                const chars = v.hanzi.split('');
                practiceSession.push({
                    type: 'reorder',
                    question: `Ghép các chữ cái để tạo thành từ "${v.meaning}":`,
                    meaning: v.pinyin,
                    shuffledWords: [...chars].sort(() => 0.5 - Math.random()),
                    correctAnswer: v.hanzi,
                    explanation: `Từ đúng: ${v.hanzi}`
                });
            });
        }

        // 5. Shuffle the session
        practiceSession = practiceSession.sort(() => 0.5 - Math.random());

        res.status(200).json({
            status: 'success',
            results: practiceSession.length,
            data: {
                lessonTitle: lesson.title,
                exercises: practiceSession
            }
        });
    } catch (err) {
        res.status(400).json({ status: 'fail', message: err.message });
    }
};

exports.getAllListenings = async (req, res) => {
    try {
        const hsk = parseInt(req.query.hsk) || 1;
        const listenings = await Listening.find({ hskLevel: hsk }).sort('order');

        // Group by category for the SwiftUI App
        const groupedData = listenings.reduce((acc, item) => {
            const cat = item.category || 'Khởi động';
            if (!acc[cat]) {
                acc[cat] = [];
            }
            acc[cat].push({
                _id: item._id,
                title: item.title,
                subTitle: item.subTitle,
                duration: item.duration,
                order: item.order
            });
            return acc;
        }, {});

        // Format into an array of sections
        const sections = Object.keys(groupedData).map(cat => ({
            category: cat,
            count: groupedData[cat].length,
            items: groupedData[cat]
        }));

        res.status(200).json({
            status: 'success',
            hskLevel: hsk,
            data: { sections }
        });
    } catch (err) {
        res.status(400).json({ status: 'fail', message: err.message });
    }
};

exports.getListeningById = async (req, res) => {
    try {
        const listening = await Listening.findById(req.params.id);
        if (!listening) {
            return res.status(404).json({ status: 'fail', message: 'Không tìm thấy bài nghe' });
        }
        res.status(200).json({
            status: 'success',
            data: { listening }
        });
    } catch (err) {
        res.status(400).json({ status: 'fail', message: err.message });
    }
};
