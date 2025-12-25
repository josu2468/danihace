'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI('AIzaSyAWmJHQu7mp16FjqHozqeKBxWA2YglAf1Y');

const MODELS = [
    "gemini-2.5-flash",
    "gemini-1.5-flash",
    "gemini-1.5-flash-001",
    "gemini-1.5-pro"
];

export async function detectWall(imageBase64: string) {
    // Sanitize base64
    const data = imageBase64.split(',')[1] || imageBase64;

    let lastError = null;

    for (const modelName of MODELS) {
        try {
            console.log(`Trying model: ${modelName}`);
            const model = genAI.getGenerativeModel({ model: modelName });

            const prompt = `
            Analyze this image of a room. I need to identify the Perspective Plane of the main wall where art could be hung.
            
            Return a JSON object with:
            1. "points": An array of 4 points representing the corners of the wall plane in percentage of image dimensions (0-100). Order: Top-Left, Top-Right, Bottom-Right, Bottom-Left.
            2. "wallHeightCm": Integrated integer estimate of the wall height in real world centimeters (standard is 250, adapt if you see clues).
            
            Format:
            {
                "points": [{ "x": 10, "y": 10 }, { "x": 90, "y": 15 }, { "x": 90, "y": 80 }, { "x": 10, "y": 85 }],
                "wallHeightCm": 250
            }
            
            Return ONLY the JSON. No markdown formatting.
            `;

            const result = await model.generateContent([
                prompt,
                {
                    inlineData: {
                        data,
                        mimeType: "image/jpeg",
                    },
                },
            ]);

            const response = await result.response;
            const text = response.text();

            // Clean markdown
            const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();

            return JSON.parse(jsonStr);
        } catch (error: any) {
            console.error(`Error with model ${modelName}:`, error.message);
            lastError = error;
            // Continue to next model
        }
    }

    return { error: `All models failed. Last error: ${lastError?.message || "Unknown"}` };
}
