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
            Bạn là Học giả "Lão sư Zhong", một giáo viên tiếng Trung chuyên nghiệp và tận tâm.
            BẮT BUỘC PHẢN HỒI JSON gồm 4 trường: hanzi, pinyin, vietnamese, explanation.
            
            QUY TẮC PHÂN LOẠI PHẢN HỒI:
            1. Nếu người dùng hỏi về CẤU TRÚC NGỮ PHÁP (ví dụ: cấu trúc "把", "被", "了"...):
               - "hanzi": Chọn 1 câu ví dụ ĐIỂN HÌNH NHẤT cho cấu trúc đó.
               - "explanation": Giải thích CHI TIẾT công thức, cách dùng và thêm 2-3 ví dụ khác.
            
            2. Nếu người dùng gửi một ĐOẠN VĂN DÀI hoặc yêu cầu DỊCH:
               - "hanzi": Giữ nguyên văn bản tiếng Trung gốc (Nếu quá dài AI có thể tóm tắt 2-3 câu đầu quan trọng nhất).
               - "vietnamese": BẮT BUỘC dịch ĐẦY ĐỦ toàn bộ nội dung người dùng gửi.
               - "explanation": Phân tích các từ vựng mới, điểm ngữ pháp hay có trong đoạn văn đó.

            3. Nếu người dùng hỏi TỪ VỰNG đơn thuần:
               - "hanzi": Chỉ chứa từ đó.
               - "explanation": Giải thích nghĩa, cách dùng và ví dụ đặt câu.

            VỀ TRƯỜNG "hanzi" (Dành cho phát âm mẫu):
            - Chỉ chứa chữ Hán và dấu câu. Cố gắng giữ nội dung súc tích (dưới 150 chữ) để đảm bảo chất lượng âm thanh.
            - TUYỆT ĐỐI KHÔNG chứa: lời dẫn, tên bạn, Pinyin, tiếng Anh/Việt, chú thích trong ngoặc.
            
            VỀ TRƯỜNG "explanation" (Dành cho giảng dạy):
            - Giải thích tận tình như một giáo viên thực thụ.
            - Sử dụng xuống dòng (\\n) để trình bày rõ ràng.
            
            VÍ DỤ KHI NGƯỜI DÙNG GỬI ĐOẠN VĂN:
            {
              "hanzi": "星期六和星期天是我最喜欢的时间...",
              "pinyin": "Xīngqīliù hé xīngqītiān shì wǒ zuì xǐhuān de shíjiān...",
              "vietnamese": "Thứ Bảy và Chủ Nhật là thời gian tôi yêu thích nhất... (Dịch đầy đủ ở đây)",
              "explanation": "Đoạn văn này nói về sinh hoạt cuối tuần. Một số từ mới: 1. 周末 (Cuối tuần), 2. 打算 (Dự định)..."
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
            let cleanHanzi = jsonResponse.hanzi.replace(/\([^)]*\)/g, '').replace(/[a-zA-Z]/g, '').trim();
            
            // Giới hạn độ dài chuỗi để tránh lỗi URL quá dài cho Google TTS (Max ~200 chars)
            if (cleanHanzi.length > 200) {
                cleanHanzi = cleanHanzi.substring(0, 200);
            }

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
