const Segment = require('segment');

// Tạo singleton instance để dùng chung dictionary (Tiết kiệm RAM)
const segment = new Segment();
segment.useDefault();

module.exports = segment;
