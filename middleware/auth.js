const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ status: 'fail', message: 'You are not logged in!' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const currentUser = await User.findById(decoded.id);
        if (!currentUser) {
            return res.status(401).json({ status: 'fail', message: 'User no longer exists.' });
        }
        req.user = currentUser;
        next();
    } catch (err) {
        return res.status(401).json({ status: 'fail', message: 'Invalid token.' });
    }
};

const restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ status: 'fail', message: 'You do not have permission.' });
        }
        next();
    };
};

module.exports = { protect, restrictTo };
