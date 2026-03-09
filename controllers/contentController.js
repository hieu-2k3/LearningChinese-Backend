const { Lesson, Word, Listening } = require('../models/Content');
const User = require('../models/User');

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

        // Update Streak
        const now = new Date();
        const lastActive = new Date(user.lastActive);
        const diffDays = Math.floor((now - lastActive) / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
            user.streak += 1;
        } else if (diffDays > 1) {
            user.streak = 1;
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
