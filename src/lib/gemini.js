import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
    console.warn("⚠️ Missing Gemini API Key. AI features will not work.");
}

const genAI = new GoogleGenerativeAI(apiKey || "");
// Use gemini-1.5-flash as the primary, fallback happens in the functions
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export async function getJapaneseMeaning(word) {
    if (!word.trim()) return "";

    const prompt = `Translate the following Japanese word or sentence to English. 
  Provide a concise meaning, and if it's a kanji, include the furigana/reading in brackets.
  Format: [Reading] Meaning
  Example for "食べる": [たべる] To eat
  Word: "${word}"`;

    try {
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    } catch (error) {
        console.error("Gemini AI Error:", error);
        return `AI Error: ${error.message || "Failed to get suggestion"}`;
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
        const result = await model.generateContent(prompt);
        const responseText = result.response.text().trim();

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
