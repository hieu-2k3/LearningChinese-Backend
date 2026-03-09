require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const { Lesson } = require('./models/Content');

const seed = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB...');

        // Clear existing
        await User.deleteMany({});
        await Lesson.deleteMany({});

        // Create Admin
        await User.create({
            username: 'admin',
            email: 'admin@chinese.com',
            password: 'password123',
            role: 'admin',
            xp: 1000
        });

        // Create Sample User
        await User.create({
            username: 'hieu_learning',
            email: 'hieu@example.com',
            password: 'password123',
            xp: 500,
            streak: 5
        });

        // Create Lessons
        await Lesson.create([
            { title: 'Greeting & Hello', level: 1, type: 'vocabulary', order: 1 },
            { title: 'Numbers 1-10', level: 1, type: 'vocabulary', order: 2 },
            { title: 'Daily Routine', level: 2, type: 'listening', order: 3 },
            { title: 'Ordering Coffee', level: 3, type: 'grammar', order: 4 }
        ]);

        console.log('✅ Seed successful!');
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

seed();
