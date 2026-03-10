const sdk = require("microsoft-cognitiveservices-speech-sdk");

exports.assessPronunciation = async (req, res) => {
    try {
        const { referenceText } = req.body;

        if (!req.file) {
            return res.status(400).json({ status: 'fail', message: 'Không tìm thấy file ghi âm.' });
        }

        if (!referenceText) {
            return res.status(400).json({ status: 'fail', message: 'Thiếu nội dung chữ Hán mẫu để đối chiếu.' });
        }

        // 1. Cấu hình Azure Speech
        const speechConfig = sdk.SpeechConfig.fromSubscription(
            process.env.AZURE_SPEECH_KEY,
            process.env.AZURE_SPEECH_REGION
        );
        speechConfig.speechRecognitionLanguage = "zh-CN";

        // 2. Đưa buffer audio vào PushStream
        const pushStream = sdk.AudioInputStream.createPushStream();
        pushStream.write(req.file.buffer);
        pushStream.close();

        const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);

        // 3. Cấu hình chấm điểm phát âm (Pronunciation Assessment)
        // Hệ điểm 100, độ chi tiết đến từng âm tiết
        const pronunciationAssessmentConfig = new sdk.PronunciationAssessmentConfig(
            referenceText,
            sdk.PronunciationAssessmentGradingSystem.HundredMark,
            sdk.PronunciationAssessmentGranularity.Phoneme,
            true
        );

        const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
        pronunciationAssessmentConfig.applyTo(recognizer);

        // 4. Thực hiện nhận diện và chấm điểm
        recognizer.recognizeOnceAsync(result => {
            if (result.reason === sdk.ResultReason.RecognizedSpeech) {
                const pronunciationResult = sdk.PronunciationAssessmentResult.fromResult(result);

                res.status(200).json({
                    status: 'success',
                    data: {
                        accuracyScore: pronunciationResult.accuracyScore,
                        pronunciationScore: pronunciationResult.pronunciationScore,
                        completenessScore: pronunciationResult.completenessScore,
                        fluencyScore: pronunciationResult.fluencyScore,
                        prosodyScore: pronunciationResult.prosodyScore,
                        details: pronunciationResult.words.map(w => ({
                            word: w.word,
                            accuracyScore: w.accuracyScore,
                            errorType: w.errorType
                        }))
                    }
                });
            } else {
                res.status(400).json({
                    status: 'fail',
                    message: 'Không thể nhận diện được giọng nói. Hãy thử lại.',
                    reason: result.reason
                });
            }
            recognizer.close();
        }, err => {
            console.error("Azure Speech Error:", err);
            res.status(500).json({ status: 'error', message: err });
            recognizer.close();
        });

    } catch (err) {
        console.error("Assessment Error:", err);
        res.status(500).json({ status: 'error', message: err.message });
    }
};
