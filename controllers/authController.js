const jwt = require('jsonwebtoken');
const User = require('../models/User');

const signToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '90d'
    });
};

const createSendToken = (user, statusCode, res) => {
    const token = signToken(user._id);
    user.password = undefined; // Hide password
    res.status(statusCode).json({
        status: 'success',
        token,
        data: { user }
    });
};

exports.register = async (req, res) => {
    try {
        const newUser = await User.create({
            username: req.body.username,
            email: req.body.email,
            password: req.body.password,
            avatar: req.body.avatar
        });
        createSendToken(newUser, 201, res);
    } catch (err) {
        res.status(400).json({ status: 'fail', message: err.message });
    }
};

exports.login = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ status: 'fail', message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
        return res.status(401).json({ status: 'fail', message: 'Incorrect email or password' });
    }

    createSendToken(user, 200, res);
};

exports.getProfile = async (req, res) => {
    res.status(200).json({
        status: 'success',
        data: { user: req.user }
    });
};

exports.logout = (req, res) => {
    res.status(200).json({ status: 'success', message: 'Logged out successfully' });
};
