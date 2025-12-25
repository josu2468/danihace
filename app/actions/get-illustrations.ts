'use server';

import fs from 'fs';
import path from 'path';

export async function getIllustrations() {
    try {
        const dir = path.join(process.cwd(), 'Ilustraciones');

        if (!fs.existsSync(dir)) {
            console.error("Directory not found:", dir);
            return [];
        }

        const files = fs.readdirSync(dir);

        // Filter for images
        const images = files.filter(file =>
            /\.(jpg|jpeg|png|webp|heic)$/i.test(file)
        );

        return images.map(file => ({
            name: file,
            // Create a URL for our API route
            src: `/api/illustration?name=${encodeURIComponent(file)}`
        }));
    } catch (error) {
        console.error("Error reading illustrations:", error);
        return [];
    }
}
