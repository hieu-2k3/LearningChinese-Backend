const googleTTS = require('google-tts-api');
const mp3Duration = require('mp3-duration');
const fs = require('fs');

async function test() {
    console.log('Fetching TTS 1');
    const b1 = await googleTTS.getAudioBase64('你好，请问这张桌子有人吗？', { lang: 'zh-CN' });
    const buf1 = Buffer.from(b1, 'base64');
    const d1 = await mp3Duration(buf1);
    console.log('TTS 1 Duration:', d1);

    console.log('Fetching TTS 2');
    const b2 = await googleTTS.getAudioBase64('没有。请坐吧。', { lang: 'zh-CN' });
    const buf2 = Buffer.from(b2, 'base64');
    const d2 = await mp3Duration(buf2);
    console.log('TTS 2 Duration:', d2);

    const finalBuf = Buffer.concat([buf1, buf2]);
    const dTotal = await mp3Duration(finalBuf);
    console.log('Total measured duration:', dTotal, 'Sum:', d1 + d2);
    
    fs.writeFileSync('test.mp3', finalBuf);
    console.log('Done!');
}
test();
