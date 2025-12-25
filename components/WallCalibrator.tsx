'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Move, Loader2, Sparkles } from 'lucide-react';
import { detectWall } from '@/app/actions/detect-wall';

interface Point {
    x: number;
    y: number;
}

interface WallCalibratorProps {
    imageSrc: string;
    onConfirm: (points: Point[], wallHeightCm: number) => void;
}

export default function WallCalibrator({ imageSrc, onConfirm }: WallCalibratorProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    // Default points (roughly a square in the middle)
    const [points, setPoints] = useState<Point[]>([
        { x: 100, y: 100 }, // TL
        { x: 300, y: 100 }, // TR
        { x: 300, y: 300 }, // BR
        { x: 100, y: 300 }, // BL
    ]);
    const [wallHeight, setWallHeight] = useState(250); // Default 2.5m
    const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
    const [isAnalysing, setIsAnalysing] = useState(false);

    // Initialize points relative to container size on first load
    useEffect(() => {
        if (containerRef.current) {
            const { width, height } = containerRef.current.getBoundingClientRect();
            const margin = Math.min(width, height) * 0.2;
            setPoints([
                { x: margin, y: margin },
                { x: width - margin, y: margin },
                { x: width - margin, y: height - margin },
                { x: margin, y: height - margin },
            ]);
        }
    }, [imageSrc]); // removed points dependency to avoid loop

    const handleAutoDetect = async () => {
        if (!containerRef.current) return;
        setIsAnalysing(true);

        try {
            // Fetch image and convert to base64
            const response = await fetch(imageSrc);
            const blob = await response.blob();

            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64 = reader.result as string;

                const result = await detectWall(base64);

                if (result && result.points && containerRef.current) {
                    const { width, height } = containerRef.current.getBoundingClientRect();

                    const newPoints = result.points.map((p: any) => ({
                        x: (p.x / 100) * width,
                        y: (p.y / 100) * height
                    }));

                    setPoints(newPoints);
                    if (result.wallHeightCm) setWallHeight(result.wallHeightCm);
                } else {
                    const msg = result?.error ? `Error IA: ${result.error}` : "No se pudo detectar la pared automáticamente. Inténtalo de nuevo.";
                    alert(msg);
                }
                setIsAnalysing(false);
            };
            reader.readAsDataURL(blob);
        } catch (e: any) {
            console.error(e);
            setIsAnalysing(false);
            alert(`Error de conexión con la IA: ${e.message}`);
        }
    };

    const handlePointerDown = (index: number, e: React.PointerEvent) => {
        e.preventDefault();
        setDraggingIdx(index);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (draggingIdx === null || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = Math.min(Math.max(0, e.clientX - rect.left), rect.width);
        const y = Math.min(Math.max(0, e.clientY - rect.top), rect.height);

        setPoints(prev => {
            const newPoints = [...prev];
            newPoints[draggingIdx] = { x, y };
            return newPoints;
        });
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        setDraggingIdx(null);
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    };

    return (
        <div className="flex flex-col gap-4 w-full h-full">
            <div className="bg-slate-800 p-4 rounded-lg text-white">
                <h2 className="text-xl font-bold mb-2">Paso 1: Define tu Pared</h2>
                <div className="flex justify-between items-start mb-4">
                    <p className="text-sm opacity-80 max-w-[70%]">
                        Arrastra los 4 círculos azules para marcar las esquinas de tu pared o usa la IA para detectarla.
                    </p>
                    <button
                        onClick={handleAutoDetect}
                        disabled={isAnalysing}
                        className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 px-3 py-1.5 rounded-md text-xs font-bold transition-all disabled:opacity-50 shadow-lg"
                    >
                        {isAnalysing ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                        {isAnalysing ? 'Analizando...' : 'Auto-IA'}
                    </button>
                </div>

                <div className="flex items-center gap-4">
                    <label className="text-sm">
                        Altura estimada de esta pared (cm):
                        <input
                            type="number"
                            value={wallHeight}
                            onChange={(e) => setWallHeight(Number(e.target.value))}
                            className="ml-2 p-1 rounded text-black w-24"
                        />
                    </label>
                    <button
                        onClick={() => onConfirm(points, wallHeight)}
                        className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded font-bold"
                    >
                        Confirmar Calibración
                    </button>
                </div>
            </div>

            <div
                ref={containerRef}
                className="relative w-full flex-1 bg-black overflow-hidden rounded-lg shadow-2xl border border-gray-700"
                onPointerMove={handlePointerMove}
            >
                {/* Background Image */}
                <img
                    src={imageSrc}
                    alt="Room"
                    className="w-full h-full object-contain pointer-events-none select-none"
                />

                {/* SVG Overlay for Lines */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    <polygon
                        points={points.map(p => `${p.x},${p.y}`).join(' ')}
                        fill="rgba(59, 130, 246, 0.2)"
                        stroke="#3b82f6"
                        strokeWidth="2"
                        strokeDasharray="5,5"
                    />
                </svg>

                {/* Draggable Points */}
                {points.map((p, i) => (
                    <div
                        key={i}
                        className="absolute w-6 h-6 -ml-3 -mt-3 bg-blue-500 rounded-full border-2 border-white cursor-grab active:cursor-grabbing shadow-lg flex items-center justify-center z-10 hover:scale-110 transition-transform"
                        style={{ left: p.x, top: p.y }}
                        onPointerDown={(e) => handlePointerDown(i, e)}
                        onPointerUp={handlePointerUp}
                    >
                        <Move size={12} className="text-white" />
                    </div>
                ))}
            </div>
        </div>
    );
}
