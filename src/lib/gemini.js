const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
    console.warn(" Missing Gemini API Key. AI features will not work.");
} else {
    // We found the working models! gemini-2.5-flash is available.
    console.log("🚀 jpDECK AI Active (REST Mode v2.1)");
}

/**
 * Direct fetch call to Gemini v1 REST API
 */
async function callGemini(model, prompt) {
    const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: prompt
                }]
            }]
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

export async function testAiConnection() {
    if (!apiKey) return "Missing API Key";
    try {
        const text = await callGemini("gemini-2.0-flash", "Say hello in one word");
        return `Success! AI responded: ${text.trim()}`;
    } catch (e) {
        return `AI Error: ${e.message}`;
    }
}

async function tryModels(prompt) {
    // Using the exact names authorized for your API key
    const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"];
    let lastError = null;

    for (const modelName of models) {
        try {
            console.log(` Trying AI model: ${modelName}...`);
            const result = await callGemini(modelName, prompt);
            if (result) {
                console.log(`✅ Success with ${modelName}`);
                return result.trim();
            }
        } catch (e) {
            console.warn(` ${modelName} failed:`, e.message);
            lastError = e;
            if (!e.message.includes("404")) break;
        }
    }
    throw lastError || new Error("All authorized models failed");
}

export async function getJapaneseMeaning(word) {
    if (!word.trim()) return "";

    const prompt = `Translate the Japanese word or sentence "${word}" to English. 
    Provide the reading in brackets if it's Kanji. 
    Format: [Reading] Meaning. 
    Example for "食べる": [たべる] To eat.
    Keep it very short.`;

    try {
        return await tryModels(prompt);
    } catch (error) {
        console.error("AI Final Failure:", error);
        return `AI Error: ${error.message}`;
    }
}

export async function processBulkAI(text) {
    if (!text.trim()) return [];

    const prompt = `Translate this list of Japanese words to English. 
    Format each line exactly as: Word, [Reading] Meaning
    
    List:
    ${text}`;

    try {
        const responseText = await tryModels(prompt);
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
        console.error("Bulk AI Error:", error);
        throw error;
    }
}
