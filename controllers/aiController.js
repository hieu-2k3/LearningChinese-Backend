const OpenAI = require("openai");
const User = require('../models/User');

/**
 * Xử lý chat với AI chuyên về tiếng Trung sử dụng Groq (Llama 3)
 */
exports.chatWithAI = async (req, res) => {
    try {
        const { message } = req.body;
        const user = await User.findById(req.user.id);
        
        if (!message) {
            return res.status(400).json({ status: 'fail', message: 'Vui lòng nhập tin nhắn.' });
        }

        // 1. Khởi tạo Groq (Sử dụng chuẩn OpenAI)
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ 
                status: 'error', 
                message: 'GROQ_API_KEY bị thiếu trong cấu hình hệ thống.' 
            });
        }

        const groq = new OpenAI({
            apiKey: apiKey,
            baseURL: "https://api.groq.com/openai/v1",
        });

        // 2. Thiết lập System Instruction (Guardrails)
        const systemInstruction = `
            Bạn là Học giả "Lão sư Zhong", một chuyên gia ngôn ngữ và văn hóa Trung Hoa.
            Nhiệm vụ của bạn là hỗ trợ người dùng học Tiếng Trung.
            
            QUY TẮC PHẢN HỒI JSON (CỰC KỲ QUAN TRỌNG):
            1. BẠN CHỈ ĐƯỢC PHÉP TRẢ LỜI DUY NHẤT 1 ĐỐI TƯỢNG JSON VỚI ĐÚNG 4 KHÓA SAU:
               - "hanzi": Nội dung bằng chữ Hán (KHÔNG ĐƯỢC ĐỂ TRỐNG).
               - "pinyin": Phiên âm của nội dung chữ Hán đó.
               - "vietnamese": Bản dịch nghĩa tiếng Việt.
               - "explanation": Giải thích chi tiết về kiến thức, ngữ pháp, hoặc liệt kê danh sách nếu người dùng yêu cầu.
            
            2. TUYỆT ĐỐI KHÔNG tự tạo thêm các khóa khác như "words", "list", "vocabulary"... 
            3. Nếu người dùng yêu cầu danh sách từ vựng (ví dụ: cho 50 từ HSK1), hãy trình bày danh sách đó theo dạng liệt kê văn bản (string) trong trường "explanation" hoặc "hanzi", KHÔNG ĐƯỢC tạo mảng JSON phức tạp.
            4. Nếu chủ đề không liên quan đến tiếng Trung, hãy dùng 4 khóa trên để từ chối lịch sự.
            5. Trình độ người dùng: HSK ${user.hskLevel || 1}.
        `;

        // 3. Gọi AI
        const response = await groq.chat.completions.create({
            messages: [
                { role: "system", content: systemInstruction },
                { role: "user", content: message }
            ],
            model: "llama-3.3-70b-versatile", // Model cực mạnh và nhanh của Groq
            response_format: { type: "json_object" } // Ép AI trả về JSON
        });

        const aiResponse = response.choices[0].message.content;

        // 4. Parse kết quả
        let jsonResponse;
        try {
            jsonResponse = JSON.parse(aiResponse);
        } catch (parseErr) {
            console.error("JSON Parse Error:", aiResponse);
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
        console.error("Groq AI Error:", err);
        res.status(500).json({ 
            status: 'error', 
            message: 'Lỗi khi kết nối với AI (Groq).',
            error_details: err.message
        });
    }
};
