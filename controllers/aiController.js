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
            
            QUY ĐỊNH BẮT BUỘC:
            1. Trường "hanzi" KHÔNG BAO GIỜ ĐƯỢC ĐỂ TRỐNG. Nó phải chứa câu chào hoặc câu tóm tắt bằng CHỮ HÁN.
            2. Trường "pinyin" và "vietnamese" là phiên âm và dịch nghĩa của trường "hanzi".
            3. Nếu người dùng yêu cầu danh sách (ví dụ: 50 từ HSK 1), bạn phải:
               - hanzi: "你好！这是你要 HSK 1 单词列表。" (Ví dụ)
               - explanation: Liệt kê chi tiết danh sách "Chữ Hán (Pinyin) - Nghĩa" tại đây.
            
            VÍ DỤ ĐÚNG:
            {
              "hanzi": "你好！这是一些常用的汉字。",
              "pinyin": "Nǐ hǎo! Zhè shì yīxiē chángyòng de hànzì.",
              "vietnamese": "Chào bạn! Đây là một số chữ Hán thường dùng.",
              "explanation": "1. 我 (wǒ) - Tôi\\n2. 你 (nǐ) - Bạn..."
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

        // 5. Thêm trường audioUrl (Sử dụng Google TTS như các API khác)
        if (jsonResponse.hanzi) {
            const encoded = encodeURIComponent(jsonResponse.hanzi);
            jsonResponse.audioUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=zh-CN&client=tw-ob`;
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
