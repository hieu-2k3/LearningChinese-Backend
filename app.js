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

// DB Connection (Sẵn sàng cho Render - Không chặn khởi động)
const dbUri = process.env.MONGODB_URI;
if (!dbUri) {
    console.error('❌ MONGODB_URI is missing! App may fail to fetch data.');
} else {
    console.log('⏳ Connecting to MongoDB...');
    mongoose.connect(dbUri, { 
        serverSelectionTimeoutMS: 10000, 
        connectTimeoutMS: 10000 
    })
    .then(() => console.log('✅ MongoDB Connected Successfully'))
    .catch(err => {
        console.error('❌ MongoDB Connection Error:', err.message);
        console.log('⚠️ App is still running to maintain Port Binding for Render.');
    });
}

// 2. ROUTES LOAD
console.log('⏳ Loading Routes...');
try {
    const apiRoutes = require('./routes/apiRoutes');
    const adminRoutes = require('./routes/adminRoutes');
    app.use('/api/v1', apiRoutes);
    app.use('/admin', adminRoutes);
    console.log('✅ Routes Loaded');
} catch (loadErr) {
    console.error('❌ Lỗi load Routes:', loadErr);
}

app.get('/', (req, res) => {
    res.send('<h1>Chinese Learning API v1.1</h1><p>Status: Running</p>');
});

// 3. START SERVER
const PORT = process.env.PORT || 10000; // Render thường dùng cổng 10000
const HOST = '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
    console.log(`🚀 SERVER IS LIVE!`);
    console.log(`🔗 Local Address: http://localhost:${PORT}`);
    console.log(`🌐 Network Address: http://${HOST}:${PORT}`);
    console.log(`🕒 Start time: ${new Date().toLocaleString()}`);
});

server.on('error', (err) => {
    console.error('❌ Server startup error:', err);
});
