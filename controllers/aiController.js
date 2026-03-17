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
            Bạn là Học giả "Lão sư Zhong", chuyên gia ngôn ngữ Trung Hoa.
            BẮT BUỘC PHẢN HỒI JSON gồm 4 trường: hanzi, pinyin, vietnamese, explanation.
            
            QUY ĐỊNH BẮT BUỘC VỀ TRƯỜNG "hanzi":
            1. Chỉ chứa từ vựng hoặc câu tiếng Trung CỐT LÕI đang trao đổi. 
            2. TUYỆT ĐỐI KHÔNG chứa lời chào, tên của bạn, phiên âm (Pinyin), hay dịch nghĩa trong trường này.
            3. Trường này được dùng để phát âm mẫu, nên phải CỰC KỲ SẠCH SẼ (Chỉ chữ Hán và dấu câu).
            
            QUY ĐỊNH VỀ CÁC TRƯỜNG KHÁC:
            1. "pinyin" và "vietnamese" là phiên âm và dịch nghĩa tương ứng của nội dung trong "hanzi".
            2. "explanation": Chứa lời chào, giải thích chi tiết, ví dụ đặt câu, danh sách từ (nếu có) và các thông tin bổ sung.
            
            VÍ DỤ ĐÚNG (Khi người dùng hỏi "Táo tiếng Trung là gì?"):
            {
              "hanzi": "苹果",
              "pinyin": "Píngguǒ",
              "vietnamese": "Quả táo",
              "explanation": "Chào bạn! Quả táo trong tiếng Trung là 苹果 (Píngguǒ). Đây là một loại trái cây rất tốt cho sức khỏe."
            }
            
            Trình độ người dùng: HSK ${user.hskLevel || 1}.
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

        // 5. Thêm trường audioUrl (Sử dụng Google TTS)
        if (jsonResponse.hanzi) {
            // Loại bỏ Pinyin hoặc chú thích trong ngoặc nếu AI lỡ viết vào (ví dụ: "苹果 (Píngguǒ)")
            const cleanHanzi = jsonResponse.hanzi.replace(/\([^)]*\)/g, '').replace(/[a-zA-Z]/g, '').trim();
            // KHÔNG dùng encodeURIComponent ở đây vì client app sẽ tự encode toàn bộ URL, 
            // nếu encode ở đây sẽ bị double encode (lỗi %25E5...)
            jsonResponse.audioUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${cleanHanzi}&tl=zh-CN&client=tw-ob`;
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
