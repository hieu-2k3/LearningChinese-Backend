require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const cookieParser = require('cookie-parser');

// TRÁNH CRASH: Bắt mọi lỗi chưa xử lý
process.on('uncaughtException', (err) => {
    console.error('❌ CRITICAL: Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

const app = express();

// 1. HEALTH CHECK (PHẢI TRÊN CÙNG ĐỂ RENDER THẤY)
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Middleware cơ bản
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('dev'));

// View Engine
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layout');
app.use(express.static(path.join(__dirname, 'public')));

// DB Connection (Không được chặn tiến độ start)
const dbUri = process.env.MONGODB_URI;
if (!dbUri) {
    console.error('❌ MONGODB_URI is missing!');
} else {
    mongoose.connect(dbUri, { serverSelectionTimeoutMS: 5000 })
        .then(() => console.log('✅ MongoDB Connected'))
        .catch(err => console.error('❌ DB Fail:', err.message));
}

// 2. ROUTES LOAD (Lazy load nếu cần, nhưng đây ta load bình thường)
try {
    const apiRoutes = require('./routes/apiRoutes');
    const adminRoutes = require('./routes/adminRoutes');
    app.use('/api/v1', apiRoutes);
    app.use('/admin', adminRoutes);
} catch (loadErr) {
    console.error('❌ Lỗi load Routes:', loadErr.message);
}

app.get('/', (req, res) => {
    res.send('<h1>Chinese Learning API v1.1</h1><p>Status: Running</p>');
});

// 3. START SERVER NGAY LẬP TỨC
const PORT = process.env.PORT || 5001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server up at port ${PORT}`);
});
