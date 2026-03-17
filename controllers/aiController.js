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
               - "explanation": Phải giải thích CỰC KỲ CHI TIẾT bao gồm: 
                 + Công thức/Cấu trúc.
                 + Cách dùng và lưu ý.
                 + 2-3 câu ví dụ bổ sung (kèm Pinyin và Dịch).
            
            2. Nếu người dùng hỏi TỪ VỰNG đơn thuần:
               - "hanzi": Chỉ chứa từ đó.
               - "explanation": Giải thích nghĩa, cách dùng và ví dụ đặt câu.

            VỀ TRƯỜNG "hanzi" (Dành cho phát âm mẫu):
            - Chỉ chứa chữ Hán và dấu câu. 
            - TUYỆT ĐỐI KHÔNG chứa: lời dẫn, tên bạn, Pinyin, tiếng Anh/Việt, chú thích trong ngoặc.
            
            VỀ TRƯỜNG "explanation" (Dành cho giảng dạy):
            - Đây là nơi bạn thể hiện kiến thức chuyên sâu. Hãy giải thích tận tình như một giáo viên thực thụ.
            - Sử dụng xuống dòng (\\n) để trình bày rõ ràng, đẹp mắt.
            
            VÍ DỤ KHI HỎI NGỮ PHÁP "Cấu trúc 把":
            {
              "hanzi": "我把作业做完了。",
              "pinyin": "Wǒ bǎ zuòyè zuò wán le.",
              "vietnamese": "Tôi đã làm xong bài tập rồi.",
              "explanation": "Chào bạn! Đây là cấu trúc câu chữ '把' (Câu bị động cách) rất quan trọng:\\n\\n1. Công thức: S + 把 + O + V + Thành phần khác.\\n2. Ý nghĩa: Nhấn mạnh tác động lên đối tượng làm thay đổi trạng thái của nó.\\n3. Ví dụ khác:\\n- 你把门关상 (Nǐ bǎ mén guān shàng) - Bạn đóng cửa vào đi.\\n- 请把书放在桌子上 (Qǐng bǎ shū fàng zài zhuōzi shàng) - Hãy để sách lên bàn."
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
