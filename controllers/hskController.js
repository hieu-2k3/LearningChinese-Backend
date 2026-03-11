const { HskExam, HskResult } = require('../models/HskContent');

// ---------------------------
// CLIENT API (iOS)
// ---------------------------

// Lấy Dashboard hoặc danh sách đề thi theo Level
exports.getHskDashboard = async (req, res) => {
    try {
        const level = parseInt(req.params.level) || 3;

        // 1. Lấy danh sách đề thi của level này
        const exams = await HskExam.find({ hskLevel: level }).select('title duration totalQuestions thumbnail order');

        // 2. Tính toán target (Mock data - sau này sẽ tính dựa trên lịch sử user)
        const dashboardData = {
            target: {
                levelName: `HSK ${level} Standard Test`,
                progress: 75,
                predictionDate: "25/03",
                targetScore: 280
            },
            categories: [
                { id: "mock_exam", title: "Đề thi thử", count: exams.length, unit: "đề", badge: "HOT", icon: "doc.text.fill" },
                { id: "listening", title: "Luyện nghe", count: 45, unit: "bài", icon: "headphones" },
                { id: "reading", title: "Luyện đọc", count: 30, unit: "bài", icon: "book.fill" },
                { id: "writing", title: "Viết & Ngữ pháp", count: 20, unit: "bài", badge: "NEW", icon: "pencil" }
            ],
            exams: exams
        };

        res.status(200).json({ status: 'success', data: dashboardData });
    } catch (err) {
        res.status(400).json({ status: 'fail', message: err.message });
    }
};

// Chi tiết 1 đề thi (Gồm các section và câu hỏi)
exports.getExamById = async (req, res) => {
    try {
        const exam = await HskExam.findById(req.params.id);
        if (!exam) return res.status(404).json({ status: 'fail', message: 'Không tìm thấy đề thi' });

        res.status(200).json({ status: 'success', data: { exam } });
    } catch (err) {
        res.status(400).json({ status: 'fail', message: err.message });
    }
};

// Lưu kết quả thi
exports.submitExamResult = async (req, res) => {
    try {
        const { examId, score, totalScore, answers, timeSpent } = req.body;
        const result = await HskResult.create({
            userId: req.user.id,
            examId,
            score,
            totalScore,
            percentage: Math.round((score / totalScore) * 100),
            answers,
            timeSpent
        });
        res.status(201).json({ status: 'success', data: { result } });
    } catch (err) {
        res.status(400).json({ status: 'fail', message: err.message });
    }
};

// Lấy lịch sử thi
exports.getExamHistory = async (req, res) => {
    try {
        const history = await HskResult.find({ userId: req.user.id })
            .populate('examId', 'title hskLevel')
            .sort('-createdAt')
            .limit(10);

        res.status(200).json({ status: 'success', data: { history } });
    } catch (err) {
        res.status(400).json({ status: 'fail', message: err.message });
    }
};

// ---------------------------
// ADMIN API (Quản lý đề thi)
// ---------------------------
exports.createExam = async (req, res) => {
    try {
        const exam = await HskExam.create(req.body);
        res.status(201).json({ status: 'success', data: { exam } });
    } catch (err) {
        res.status(400).json({ status: 'fail', message: err.message });
    }
};
