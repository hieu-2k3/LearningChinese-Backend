const { GoogleGenerativeAI } = require("@google/generative-ai");
const User = require('../models/User');

/**
 * Xử lý chat với AI chuyên về tiếng Trung
 */
exports.chatWithAI = async (req, res) => {
    try {
        const { message } = req.body;
        const user = await User.findById(req.user.id);
        
        if (!message) {
            return res.status(400).json({ status: 'fail', message: 'Vui lòng nhập tin nhắn.' });
        }

        // 1. Khởi tạo Gemini
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ 
                status: 'error', 
                message: 'GEMINI_API_KEY bị thiếu trong cấu hình hệ thống.' 
            });
        }
        
        const genAI = new GoogleGenerativeAI(apiKey);
        
        // Danh sách các model để thử nghiệm (từ mạnh nhất đến ổn định nhất)
        const modelNames = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-pro"];
        let model;
        let lastError;

        for (const name of modelNames) {
            try {
                const testModel = genAI.getGenerativeModel({ model: name });
                // Thử tạo một nội dung rất ngắn để kiểm tra xem model có thực sự tồn tại
                await testModel.generateContent({ contents: [{ role: 'user', parts: [{ text: 'hi' }] }] });
                model = testModel;
                console.log(`✅ Đã kết nối thành công với model: ${name}`);
                break;
            } catch (err) {
                lastError = err;
                console.warn(`⚠️ Model ${name} không sẵn dụng, đang thử model tiếp theo...`);
            }
        }

        if (!model) {
            throw new Error(`Không thể khởi tạo bất kỳ model nào. Lỗi cuối cùng: ${lastError.message}`);
        }

        // 2. Thiết lập System Instruction ( Guardrails)
        const systemInstruction = `
            Bạn là Học giả "Lão sư Zhong", một chuyên gia ngôn ngữ và văn hóa Trung Hoa trên Con đường Tơ lụa.
            Nhiệm vụ của bạn là hỗ trợ người dùng học Tiếng Trung (Hán ngữ).
            
            QUY TẮC CỰC KỲ QUAN TRỌNG:
            1. BẠN CHỈ ĐƯỢC PHÉP TRẢ LỜI CÁC CÂU HỎI LIÊN QUAN ĐẾN TIẾNG TRUNG (Ngữ pháp, từ vựng, văn hóa, luyện hội thoại).
            2. Nếu người dùng hỏi về bất kỳ chủ đề nào khác, bạn phải từ chối lịch sự và hướng người dùng quay lại việc học Tiếng Trung.
            3. Trình độ hiện tại: HSK ${user.hskLevel || 1}.
            4. Phản hồi luôn trả về JSON:
               {
                 "hanzi": "tiếng Trung",
                 "pinyin": "phiên âm",
                 "vietnamese": "dịch tiếng Việt",
                 "explanation": "giải thích"
               }
        `;

        // 3. Gọi AI
        const prompt = `${systemInstruction}\n\nNgười dùng: ${message}`;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // 4. Parse kết quả
        let cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
        // Một số model có thể trả về text thừa, ta lấy phần nằm giữa { và }
        const jsonStart = cleanText.indexOf('{');
        const jsonEnd = cleanText.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
            cleanText = cleanText.substring(jsonStart, jsonEnd + 1);
        }

        let jsonResponse;
        try {
            jsonResponse = JSON.parse(cleanText);
        } catch (parseErr) {
            jsonResponse = {
                hanzi: "抱歉，由于系统问题，我无法正常回答。",
                pinyin: "Bàoqiàn, yóuyú xìtǒng wèntí, wǒ wúfǎ zhèngcháng huídá.",
                vietnamese: "Rất tiếc, do lỗi hệ thống, tôi không thể trả lời bình thường.",
                explanation: "Lỗi định dạng phản hồi từ AI."
            };
        }

        res.status(200).json({
            status: 'success',
            data: jsonResponse
        });

    } catch (err) {
        console.error("AI Chat Error Details:", err);
        res.status(500).json({ 
            status: 'error', 
            message: 'Không thể kết nối với AI sau nhiều lần thử.',
            error_details: err.message
        });
    }
};
