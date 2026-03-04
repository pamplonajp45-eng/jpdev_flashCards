import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
    console.warn("⚠️ Missing Gemini API Key. AI features will not work.");
} else {
    console.log("✅ AI Key loaded:", apiKey.substring(0, 4) + "..." + apiKey.substring(apiKey.length - 4));
}

const genAI = new GoogleGenerativeAI(apiKey || "");

// Help debug: List all models available for THIS specific API key
(async () => {
    if (!apiKey) return;
    try {
        const models = await genAI.listModels();
        console.log("📊 Available AI Models for your key:", models.models.map(m => m.name));
    } catch (e) {
        console.warn("Could not list models:", e.message);
    }
})();

async function tryModels(prompt) {
    const modelNames = ["gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-1.5-pro", "gemini-pro", "gemini-1.0-pro"];
    let lastError = null;

    for (const name of modelNames) {
        try {
            console.log(`🤖 Trying AI model: ${name}...`);
            const model = genAI.getGenerativeModel({ model: name });
            const result = await model.generateContent(prompt);
            const text = result.response.text().trim();
            if (text) return text;
        } catch (e) {
            console.warn(`❌ Model ${name} failed:`, e.message);
            lastError = e;
        }
    }
    throw lastError;
}

export async function getJapaneseMeaning(word) {
    if (!word.trim()) return "";

    const prompt = `Translate the following Japanese word or sentence to English. 
  Provide a concise meaning, and if it's a kanji, include the furigana/reading in brackets.
  Format: [Reading] Meaning
  Word: "${word}"`;

    try {
        return await tryModels(prompt);
    } catch (error) {
        console.error("Gemini AI Final Error:", error);
        return `AI Error: ${error.message || "Failed to find a compatible model"}`;
    }
}

export async function processBulkAI(text) {
    if (!text.trim()) return [];

    const prompt = `I have a list of Japanese words, one per line. 
  For each word, provide its English translation and reading.
  Format each result on a new line as: OriginalWord, [Reading] Meaning
  Only return the list of words, no extra text.
  
  List:
  ${text}`;

    try {
        const responseText = await tryModels(prompt);

        // Parse the response lines
        return responseText.split('\n')
            .map(line => {
                const parts = line.split(',');
                if (parts.length >= 2) {
                    return {
                        front: parts[0].trim(),
                        back: parts[1].trim()
                    };
                }
                return null;
            })
            .filter(item => item !== null);
    } catch (error) {
        console.error("Gemini Bulk AI Error:", error);
        throw error;
    }
}
