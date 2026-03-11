const { Pinyin, PinyinRule } = require('../models/Pinyin');

exports.getAllPinyin = async (req, res) => {
    try {
        // Trả về dữ liệu phân nhóm để Client dễ hiển thị Grid
        const initials = await Pinyin.find({ type: 'initial' }).sort('sound');
        const finals = await Pinyin.find({ type: 'final' }).sort('sound');
        const tones = await Pinyin.find({ type: 'tone' }).sort('sound');

        res.status(200).json({
            status: 'success',
            data: {
                initials,
                finals,
                tones
            }
        });
    } catch (err) {
        res.status(400).json({ status: 'fail', message: err.message });
    }
};

exports.getPinyinDetail = async (req, res) => {
    try {
        const pinyin = await Pinyin.findOne({ sound: req.params.sound });
        if (!pinyin) {
            return res.status(404).json({ status: 'fail', message: 'Pinyin sound not found' });
        }
        res.status(200).json({ status: 'success', data: { pinyin } });
    } catch (err) {
        res.status(400).json({ status: 'fail', message: err.message });
    }
};

exports.getAllRules = async (req, res) => {
    try {
        const rules = await PinyinRule.find();
        res.status(200).json({ status: 'success', data: { rules } });
    } catch (err) {
        res.status(400).json({ status: 'fail', message: err.message });
    }
};
