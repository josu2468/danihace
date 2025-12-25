
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import mime from 'mime'; // You might need to install 'mime' or use a simple lookup

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const filename = searchParams.get('name');

    if (!filename) {
        return new NextResponse('Filename required', { status: 400 });
    }

    // Security: Prevent directory traversal
    const safeName = path.basename(filename);
    const filePath = path.join(process.cwd(), 'Ilustraciones', safeName);

    if (!fs.existsSync(filePath)) {
        return new NextResponse('File not found', { status: 404 });
    }

    try {
        const fileBuffer = fs.readFileSync(filePath);

        // Simple mime lookup
        const ext = path.extname(safeName).toLowerCase();
        let contentType = 'application/octet-stream';
        if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
        if (ext === '.png') contentType = 'image/png';
        if (ext === '.webp') contentType = 'image/webp';
        if (ext === '.heic') contentType = 'image/heic';

        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=3600'
            }
        });
    } catch (error) {
        return new NextResponse('Error reading file', { status: 500 });
    }
}
