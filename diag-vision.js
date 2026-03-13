const { ImageAnnotatorClient } = require('@google-cloud/vision');
const path = require('path');
require('dotenv').config();

async function testVision() {
    console.log('--- Google Vision Diagnostic Test ---');
    console.log('Current Directory:', __dirname);
    console.log('Creds Path in Env:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
    
    try {
        const client = new ImageAnnotatorClient();
        console.log('✅ Client initialized successfully.');
        
        // Test with a dummy operation or just check if it can authenticate
        console.log('Testing authentication...');
        // We just need to see if it throws a "Cloud Vision API has not been used" or "Permission denied" error
        // If it reaches here without throwing in the constructor, the key file is at least readable.
    } catch (err) {
        console.error('❌ Diagnostic Failed:');
        console.error(err.message);
        if (err.message.includes('ENOENT')) {
            console.log('👉 Hint: The JSON key file was not found at the path specified.');
        }
    }
}

testVision();
