import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
    console.error("❌ No API Key found in .env file!");
    process.exit(1);
}

console.log(`🔍 Checking API Key: ${apiKey.substring(0, 8)}...`);

const genAI = new GoogleGenerativeAI(apiKey);

async function checkModels() {
    try {
        const models = await genAI.listModels();
        console.log("✅ Models available for this key:");
        models.models.forEach(m => {
            console.log(`   - ${m.name} (supports: ${m.supportedGenerationMethods})`);
        });
    } catch (error) {
        console.error("❌ Could not list models!");
        console.error("Error Message:", error.message);
        if (error.message.includes("403")) {
            console.error("\nHINT: Your API key is valid but may not have 'Generative Language API' enabled in Google AI Studio, or your account is restricted.");
        }
    }
}

checkModels();
