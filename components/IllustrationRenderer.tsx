'use client';

import React, { useState, useRef, useEffect } from 'react';
import { getPerspectiveTransform } from '@/lib/geometry';

interface Point {
    x: number;
    y: number;
}

interface IllustrationSize {
    width: number;
    height: number;
    label: string;
}

interface IllustrationRendererProps {
    wallPoints: Point[];
    illustrationSrc: string;
    wallHeightCm: number;
    containerWidth: number;
    containerHeight: number;
    isPercentagePoints?: boolean;
    showFrame?: boolean;
    frameColor?: string;
    targetWidthCm?: number; // New prop
}

export default function IllustrationRenderer({
    wallPoints,
    illustrationSrc,
    wallHeightCm,
    containerWidth,
    containerHeight,
    isPercentagePoints = false,
    showFrame = false,
    frameColor = '#000000',
    targetWidthCm = 30 // Default
}: IllustrationRendererProps) {
    const [position, setPosition] = useState({ x: 50, y: 50 }); // % position on the wall plane
    const [isDragging, setIsDragging] = useState(false);
    const wallPlaneRef = useRef<HTMLDivElement>(null);

    // Virtual Wall Calculations
    const VIRTUAL_WALL_HEIGHT = 1000;

    // We need to resolve wallPoints to PIXELS if they are percentages
    // But we need the CONTAINER size that contains the background image.
    // wallPlaneRef is the VIRTUAL wall, not the background container.
    // The background image renders "object-contain" in "w-full h-full".

    // We need a ref to the PARENT container to measure it
    const [realPoints, setRealPoints] = useState<Point[]>([]);

    useEffect(() => {
        if (!isPercentagePoints) {
            setRealPoints(wallPoints);
            return;
        }

        // If percentage, we need to wait for measure
        const measure = () => {
            if (wallPlaneRef.current?.parentElement) {
                const rect = wallPlaneRef.current.parentElement.getBoundingClientRect();
                // Map % to pixels
                const converted = wallPoints.map(p => ({
                    x: (p.x / 100) * rect.width,
                    y: (p.y / 100) * rect.height
                }));
                // Only update if changes to avoid loops
                // Simple JSON string check
                setRealPoints(converted);
            }
        };

        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [wallPoints, isPercentagePoints]);

    const getQuadDimensions = () => {
        if (realPoints.length < 4) return { avgWidth: 100, avgHeight: 100 };
        // Top width
        const w1 = Math.hypot(realPoints[1].x - realPoints[0].x, realPoints[1].y - realPoints[0].y);
        // Bottom width
        const w2 = Math.hypot(realPoints[2].x - realPoints[3].x, realPoints[2].y - realPoints[3].y);
        // Left height
        const h1 = Math.hypot(realPoints[3].x - realPoints[0].x, realPoints[3].y - realPoints[0].y);
        // Right height
        const h2 = Math.hypot(realPoints[2].x - realPoints[1].x, realPoints[2].y - realPoints[1].y);

        return {
            avgWidth: (w1 + w2) / 2,
            avgHeight: (h1 + h2) / 2
        };
    };

    const { avgWidth, avgHeight } = getQuadDimensions();
    const aspectRatio = avgWidth / avgHeight || 1;
    const VIRTUAL_WALL_WIDTH = VIRTUAL_WALL_HEIGHT * aspectRatio;

    // Calculate CSS Transform
    const transform = realPoints.length === 4
        ? getPerspectiveTransform(VIRTUAL_WALL_WIDTH, VIRTUAL_WALL_HEIGHT, realPoints)
        : 'none';

    // Calculate Illustration Size in Pixels relative to Virtual Wall
    const cmPerPixel = wallHeightCm / VIRTUAL_WALL_HEIGHT;

    const [naturalRatio, setNaturalRatio] = useState(0.7); // Default to roughly 5:7

    const currentWidthCm = targetWidthCm;
    const currentHeightCm = currentWidthCm / naturalRatio;

    const illustrationWidthPx = currentWidthCm / cmPerPixel;
    const illustrationHeightPx = currentHeightCm / cmPerPixel;

    const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const img = e.currentTarget;
        if (img.naturalWidth && img.naturalHeight) {
            const ratio = img.naturalWidth / img.naturalHeight;
            setNaturalRatio(ratio);
        }
    };

    // Calculate Inverse Transform for Dragging
    const transformRef = useRef<any>(null); // Keep reference to the transform object

    useEffect(() => {
        if (realPoints.length < 4) return;
        const srcPoints = [
            0, 0,
            VIRTUAL_WALL_WIDTH, 0,
            VIRTUAL_WALL_WIDTH, VIRTUAL_WALL_HEIGHT,
            0, VIRTUAL_WALL_HEIGHT
        ];
        const dstPoints = realPoints.flatMap(p => [p.x, p.y]);
        try {
            // @ts-ignore
            transformRef.current = window.PerspT ? window.PerspT(srcPoints, dstPoints) : null;
        } catch (e) { }
    }, [realPoints, VIRTUAL_WALL_WIDTH, VIRTUAL_WALL_HEIGHT]);

    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    const handlePointerDown = (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging || !wallPlaneRef.current) return;
        e.preventDefault();

        const rect = wallPlaneRef.current.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        // Calculate delta movement in percentage relative to the WALL PLANE bounding box
        const deltaX = e.movementX;
        const deltaY = e.movementY;

        // Convert delta pixels to percentage
        const deltaXPct = (deltaX / rect.width) * 100;
        const deltaYPct = (deltaY / rect.height) * 100;

        setPosition(prev => {
            const newX = prev.x + deltaXPct;
            const newY = prev.y + deltaYPct;

            // Allow slightly out of bounds dragging for better UX
            return {
                x: Math.min(110, Math.max(-10, newX)),
                y: Math.min(110, Math.max(-10, newY))
            };
        });
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        setIsDragging(false);
        try {
            (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        } catch (err) { }
    };

    return (
        <div className="flex flex-col h-full w-full">
            {/* Visualizer Area */}
            <div className="relative flex-1 overflow-hidden select-none">

                {/* The Wall Plane Container - Transformed */}
                <div
                    ref={wallPlaneRef}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: `${VIRTUAL_WALL_WIDTH}px`,
                        height: `${VIRTUAL_WALL_HEIGHT}px`,
                        transformOrigin: 'top left',
                        transform: transform,
                        pointerEvents: 'none',
                    }}
                >
                    {/* Grid lines to visualize perspective (optional) */}
                    <div className="absolute inset-0 opacity-20"
                        style={{
                            backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
                            backgroundSize: '50px 50px'
                        }}
                    />

                    {/* The Illustration with Frame */}
                    <div
                        style={{
                            position: 'absolute',
                            left: `${position.x}%`,
                            top: `${position.y}%`,
                            width: `${illustrationWidthPx}px`,
                            height: `${illustrationHeightPx}px`,
                            transform: 'translate(-50%, -50%)', // Center pivot
                            pointerEvents: 'auto', // Enable interaction
                            cursor: isDragging ? 'grabbing' : 'grab',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                            // Frame Styles
                            border: showFrame ? `12px solid ${frameColor}` : 'none',
                            outline: showFrame ? '1px solid rgba(0,0,0,0.1)' : 'none', // Inner depth
                            backgroundColor: '#fff', // Matting background
                            padding: showFrame ? '0px' : '0' // Could add matting padding here
                        }}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                    >
                        <img
                            src={illustrationSrc}
                            alt="Illustration"
                            onLoad={handleImageLoad}
                            className="w-full h-full object-cover"
                            style={{
                                boxShadow: showFrame ? 'inset 0 0 10px rgba(0,0,0,0.2)' : 'none'
                            }}
                        />
                    </div>
                </div>

            </div>
        </div>
    );
}
