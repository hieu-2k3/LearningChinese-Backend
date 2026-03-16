const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    avatar: { type: String, default: 'https://res.cloudinary.com/demo/image/upload/v1622550000/sample.jpg' },
    xp: { type: Number, default: 0 },
    streak: { type: Number, default: 0 },
    lastActive: { type: Date, default: Date.now },
    hskLevel: { type: Number, default: 1 },
    completedLessons: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' }],
    likedWords: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Word' }],
    dislikedWords: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Word' }],
    searchHistory: [{ type: String }], // Lưu mảng chữ Hán vừa tra cứu
    role: { type: String, enum: ['user', 'admin'], default: 'user' }
}, { timestamps: true });

userSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
