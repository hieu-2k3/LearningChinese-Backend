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
        // Sử dụng identifier 'gemini-1.5-flash-latest' để tránh lỗi 404 trên các vùng khác nhau
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

        // 2. Thiết lập System Instruction (Guardrails)
        const systemInstruction = `
            Bạn là Học giả "Lão sư Zhong", một chuyên gia ngôn ngữ và văn hóa Trung Hoa trên Con đường Tơ lụa.
            Nhiệm vụ của bạn là hỗ trợ người dùng học Tiếng Trung (Hán ngữ).
            
            QUY TẮC CỰC KỲ QUAN TRỌNG:
            1. BẠN CHỈ ĐƯỢC PHÉP TRẢ LỜI CÁC CÂU HỎI LIÊN QUAN ĐẾN TIẾNG TRUNG (Ngữ pháp, từ vựng, văn hóa, luyện hội thoại).
            2. Nếu người dùng hỏi về bất kỳ chủ đề nào khác (ví dụ: lập trình, toán học, chính trị, thể thao, tin tức thế giới...), bạn phải từ chối một cách lịch sự bằng tiếng Trung và tiếng Việt. Ví dụ: "Thật xin lỗi, tôi chỉ đại diện cho trí tuệ Hán ngữ, tôi không thể trả lời câu hỏi về [chủ đề]. Bạn có muốn học cách nói về nó bằng tiếng Trung không?"
            3. Trình độ của người dùng hiện tại là HSK ${user.hskLevel || 1}. Hãy sử dụng từ vựng phù hợp với trình độ này.
            4. Luôn trả lời theo định dạng JSON gồm các trường:
               - hanzi: Nội dung trả lời bằng tiếng Trung.
               - pinyin: Phiên âm của nội dung đó.
               - vietnamese: Bản dịch tiếng Việt.
               - explanation: Giải thích thêm về ngữ pháp hoặc từ vựng nếu cần.
            5. Nếu người dùng nói tiếng Việt, hãy trả lời bằng tiếng Trung trước, sau đó là dịch và giải thích.
            
            Dữ liệu bổ sung:
            - Người dùng hiện có các từ vựng yêu thích là: ${user.likedWords && user.likedWords.length > 0 ? "đã có một số từ" : "chưa có"}. Hãy cố gắng lồng ghép nếu có thể.
        `;

        // 3. Gọi AI
        const prompt = `${systemInstruction}\n\nNgười dùng: ${message}`;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // 4. Parse kết quả (Gemini đôi khi trả về Markdown code block, cần xử lý)
        let cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
        let jsonResponse;
        
        try {
            jsonResponse = JSON.parse(cleanText);
        } catch (parseErr) {
            // Fallback nếu AI không trả về đúng định dạng JSON
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
            message: 'Lỗi khi kết nối với AI.',
            error_details: err.message,
            suggestion: 'Hãy đảm bảo GEMINI_API_KEY chính xác và Render đã restart xong.'
        });
    }
};
