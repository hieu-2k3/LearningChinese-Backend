require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const cookieParser = require('cookie-parser');

const apiRoutes = require('./routes/apiRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// Middleware
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

// DB Connection
if (!process.env.MONGODB_URI) {
    console.error('❌ FATAL: MONGODB_URI is not defined in environment variables!');
} else {
    mongoose.connect(process.env.MONGODB_URI)
        .then(() => console.log('✅ MongoDB Connected'))
        .catch(err => console.error('❌ DB Connection Error:', err));
}

// Routes
app.use('/api/v1', apiRoutes);
app.use('/admin', adminRoutes);

// Landing / Redirect to API docs or Admin
app.get('/', (req, res) => {
    res.send('<h1>Chinese Learning API v1</h1><p>Visit /admin for CMS</p>');
});

// Start Server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
