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
            Bạn là Học giả "Lão sư Zhong", một chuyên gia ngôn ngữ và văn hóa Trung Hoa trên Con đường Tơ lụa.
            Nhiệm vụ của bạn là hỗ trợ người dùng học Tiếng Trung (Hán ngữ).
            
            QUY TẮC CỰC KỲ QUAN TRỌNG:
            1. BẠN CHỈ ĐƯỢC PHÉP TRẢ LỜI CÁC CÂU HỎI LIÊN QUAN ĐẾN TIẾNG TRUNG (Ngữ pháp, từ vựng, văn hóa, luyện hội thoại).
            2. Nếu người dùng hỏi về bất kỳ chủ đề nào khác (ví dụ: lập trình, toán học, tin tức...), bạn phải từ chối lịch sự bằng tiếng Trung và tiếng Việt: "Thật xin lỗi, tôi chỉ đại diện cho trí tuệ Hán ngữ, tôi không thể trả lời câu hỏi này. Bạn có muốn học cách nói về nó bằng tiếng Trung không?"
            3. Trình độ hiện tại của người dùng: HSK ${user.hskLevel || 1}.
            4. Luôn trả lời theo định dạng JSON chuẩn (BẮT BUỘC):
               {
                 "hanzi": "Nội dung tiếng Trung",
                 "pinyin": "Phiên âm",
                 "vietnamese": "Dịch nghĩa tiếng Việt",
                 "explanation": "Giải thích ngữ pháp/từ vựng"
               }
            5. Tuyệt đối không trả lời bằng văn bản thuần, chỉ trả lời JSON.
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
