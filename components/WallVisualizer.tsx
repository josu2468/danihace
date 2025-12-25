'use client';

import React, { useState } from 'react';
import WallCalibrator from './WallCalibrator';
import IllustrationRenderer from './IllustrationRenderer';
import { Camera, Image as ImageIcon, ArrowLeft } from 'lucide-react';

const SIZES = [
    { width: 13, height: 18, label: '13x18' },
    { width: 21, height: 30, label: '21x30' },
    { width: 30, height: 40, label: '30x40' },
    { width: 50, height: 70, label: '50x70' },
];

export default function WallVisualizer() {
    const [step, setStep] = useState<'upload' | 'calibrate' | 'view'>('upload');
    const [wallImage, setWallImage] = useState<string | null>(null);
    const [wallPoints, setWallPoints] = useState<{ x: number, y: number }[]>([]);
    const [wallHeightCm, setWallHeightCm] = useState(250);

    // Container dimensions for calibration context
    const [containerDims, setContainerDims] = useState({ w: 0, h: 0 });

    const [selectedIllustration, setSelectedIllustration] = useState('/ilustraciones/demo.jpg');
    const [showFrame, setShowFrame] = useState(false);
    const [frameColor, setFrameColor] = useState('#1a1a1a');
    // Hardcoded for MVP, ideally fetched from API or file system in a real app
    const [availableIllustrations, setAvailableIllustrations] = useState<string[]>([]);
    const [selectedSize, setSelectedSize] = useState(SIZES[2]);

    // Fetch illustrations on mount
    React.useEffect(() => {
        const fetchIllustrations = async () => {
            const { getIllustrations } = await import('@/app/actions/get-illustrations');
            const files = await getIllustrations();
            if (files.length > 0) {
                const urls = files.map(f => f.src);
                setAvailableIllustrations(urls);
                setSelectedIllustration(urls[0]);
            }
        };
        fetchIllustrations();
    }, []);

    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        let imageUrl = '';

        // 1. Get Image URL (HEIC or Standard)
        if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
            try {
                setWallImage('converting');
                const heic2any = (await import('heic2any')).default;
                const blob = await heic2any({ blob: file, toType: 'image/jpeg' });
                const finalBlob = Array.isArray(blob) ? blob[0] : blob;
                imageUrl = URL.createObjectURL(finalBlob);
            } catch (error) {
                console.error("Error converting HEIC:", error);
                alert("Error al procesar la imagen HEIC. Intenta con JPG/PNG.");
                setWallImage(null);
                return;
            }
        } else {
            imageUrl = URL.createObjectURL(file);
        }

        setWallImage(imageUrl);
        setIsAnalyzing(true);

        try {
            // 2. Fetch Blob for AI
            const response = await fetch(imageUrl);
            const blob = await response.blob();

            // 3. Convert to Base64
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64 = reader.result as string;

                try {
                    // 4. Call AI
                    const { detectWall } = await import('@/app/actions/detect-wall');
                    const result = await detectWall(base64);

                    if (result && result.points && !result.error && result.points.length === 4) {
                        // 5. Success
                        const newPoints = result.points.map((p: any) => ({ x: p.x, y: p.y }));
                        setWallPoints(newPoints);
                        if (result.wallHeightCm) setWallHeightCm(result.wallHeightCm);
                        setStep('view');
                    } else {
                        throw new Error(result?.error || "AI returned invalid points");
                    }
                } catch (aiError: any) {
                    console.error("AI Detection Error:", aiError);
                    alert("No se pudo detectar la pared automáticamente. Pasando a modo manual.");
                    setStep('calibrate');
                } finally {
                    setIsAnalyzing(false);
                }
            };
            reader.onerror = () => {
                throw new Error("Failed to read image file");
            };
            reader.readAsDataURL(blob);

        } catch (e) {
            console.error("General Upload Error:", e);
            alert("Ocurrió un error al procesar la imagen. Por favor intenta de nuevo.");
            setStep('calibrate'); // Fallback to calibrate, but check if wallImage is valid?
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="flex flex-col h-screen w-full bg-[#FCFCFC] text-[#103948] font-sans overflow-hidden">
            {/* Fullscreen View Mode */}
            {step === 'view' && wallImage ? (
                <div className="relative w-full h-full flex flex-col bg-[#FCFCFC]">

                    {/* Top Header Menu - Static Block to prevent overlap */}
                    <div className="w-full h-20 z-50 flex items-center justify-between px-6 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm flex-shrink-0">

                        {/* Logo */}
                        <div className="mix-blend-multiply opacity-90 hover:opacity-100 transition-opacity cursor-pointer">
                            <img src="/DaniHace.avif" alt="DaniHace" className="h-10 w-auto object-contain" />
                        </div>

                        {/* Center Menu - Size Selector */}
                        <div className="bg-gray-50/80 border border-gray-200/50 rounded-full px-4 py-1.5 flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-2 hidden md:block">Tamaño</span>
                            <div className="flex gap-1">
                                {SIZES.map(s => (
                                    <button
                                        key={s.label}
                                        onClick={() => setSelectedSize(s)}
                                        className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${selectedSize.label === s.label ? 'bg-[#103948] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}
                                    >
                                        {s.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Right Actions */}
                        <div>
                            <button
                                onClick={() => setStep('upload')}
                                className="bg-white hover:bg-gray-50 text-[#103948] w-10 h-10 flex items-center justify-center rounded-full shadow-sm border border-gray-200 transition-all group"
                                title="Nueva Foto"
                            >
                                <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
                            </button>
                        </div>
                    </div>

                    {/* Visualizer Container - Takes remaining space */}
                    <div className="relative flex-1 bg-[#f0f0f0] w-full overflow-hidden flex items-center justify-center p-4">
                        {/* 
                           Container that fits within the view but maintains aspect ratio.
                        */}
                        <div className="relative max-w-full max-h-full shadow-2xl transition-all duration-300 ease-out" style={{ aspectRatio: 'auto' }}>
                            {/* Background Layer */}
                            <img
                                src={wallImage}
                                alt="Room"
                                className="max-w-full max-h-[calc(100vh-140px)] object-contain block mx-auto"
                            />

                            {/* Perspective Layer */}
                            <div className="absolute inset-0 z-10 overflow-hidden">
                                <IllustrationRenderer
                                    wallPoints={wallPoints}
                                    illustrationSrc={selectedIllustration}
                                    wallHeightCm={wallHeightCm}
                                    containerWidth={100}
                                    containerHeight={100}
                                    isPercentagePoints={true}
                                    showFrame={showFrame}
                                    frameColor={frameColor}
                                    targetWidthCm={selectedSize.width}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Auto-Hiding Controls - Bottom */}
                    {/* The "group" hover trigger area at the bottom */}
                    <div className="absolute bottom-0 left-0 right-0 h-32 flex items-end justify-center z-40 group pointer-events-none">

                        {/* The Actual Menu - Translates up on hover of the parent group, or self */}
                        <div className="w-full max-w-5xl mx-auto bg-white/90 backdrop-blur-xl border border-gray-200 shadow-2xl rounded-t-3xl p-6 transform translate-y-[85%] group-hover:translate-y-0 transition-transform duration-500 ease-out pointer-events-auto">

                            {/* Hover Handle/Indicator */}
                            <div className="absolute -top-6 left-0 right-0 flex justify-center pb-2 opacity-50 group-hover:opacity-0 transition-opacity">
                                <div className="bg-white/80 backdrop-blur px-4 py-1 rounded-t-xl text-xs font-medium shadow-sm">
                                    Menu
                                </div>
                            </div>

                            <div className="flex flex-col md:flex-row gap-8 items-center justify-between">
                                {/* Frame Controls */}
                                <div className="flex flex-col gap-3 min-w-[200px]">
                                    <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">Marco</h3>
                                    <div className="flex items-center gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity select-none">
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${showFrame ? 'bg-[#103948] border-[#103948]' : 'bg-white border-gray-300'}`}>
                                                {showFrame && <div className="w-2 h-2 bg-white rounded-full" />}
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={showFrame}
                                                onChange={(e) => setShowFrame(e.target.checked)}
                                                className="hidden"
                                            />
                                            <span className="font-semibold text-sm">Activar</span>
                                        </label>

                                        {showFrame && (
                                            <div className="flex gap-2 animate-in fade-in slide-in-from-left-2">
                                                {['#1a1a1a', '#ffffff', '#8b5a2b', '#d4af37'].map(c => (
                                                    <button
                                                        key={c}
                                                        onClick={() => setFrameColor(c)}
                                                        className={`w-6 h-6 rounded-full border border-gray-200 shadow-sm transition-transform ${frameColor === c ? 'scale-125 ring-2 ring-[#103948] ring-offset-1' : 'hover:scale-110'}`}
                                                        style={{ backgroundColor: c }}
                                                        title={c}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Gallery */}
                                <div className="flex-1 w-full overflow-hidden flex flex-col gap-3">
                                    <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">Galería</h3>
                                    <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide mask-fade-right">
                                        {availableIllustrations.map((src, i) => (
                                            <button
                                                key={i}
                                                onClick={() => setSelectedIllustration(src)}
                                                className={`relative min-w-[80px] h-20 rounded-lg overflow-hidden transition-all duration-300 ${selectedIllustration === src ? 'ring-2 ring-[#103948] ring-offset-2 scale-105 shadow-md' : 'opacity-70 hover:opacity-100 hover:scale-105'}`}
                                            >
                                                <img src={src} alt="Art" className="w-full h-full object-cover" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* Upload / Calibrate Mode (Not Fullscreen View) */
                <div className="flex flex-col h-full relative">
                    {/* Header for Upload Mode */}
                    <header className="p-6 flex items-center justify-between z-10">
                        <img src="/DaniHace.avif" alt="DaniHace" className="h-10 w-auto object-contain mix-blend-multiply" />
                        {step !== 'upload' && (
                            <button onClick={() => setStep('upload')} className="text-sm text-gray-500 hover:text-[#103948] flex items-center gap-1 transition-colors">
                                <ArrowLeft size={16} /> Volver
                            </button>
                        )}
                    </header>

                    <main className="flex-1 flex flex-col relative overflow-hidden">
                        {step === 'upload' && (
                            <div className="flex flex-col items-center justify-center h-full gap-10 p-6 text-center animate-in fade-in zoom-in duration-500">
                                <div className="space-y-4 max-w-xl">
                                    <h2 className="text-5xl font-bold text-[#103948] tracking-tight font-poppins">Visualiza mi arte<br />en tu espacio.</h2>
                                    <p className="text-gray-500 text-lg leading-relaxed">Sube una foto de tu pared y descubre cómo combinan mis ilustraciones con tu decoración antes de comprar.</p>
                                </div>

                                <div className="grid gap-6 w-full max-w-sm">
                                    <div className="relative flex items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer hover:border-[#FCB9C9] hover:bg-[#FCB9C9]/5 transition-all group bg-white">
                                        <div className="flex flex-col items-center gap-3 pointer-events-none transition-transform group-hover:scale-105">
                                            <div className="p-3 bg-gray-50 rounded-full group-hover:bg-[#FCB9C9]/20 transition-colors">
                                                <Camera className="w-6 h-6 text-gray-400 group-hover:text-[#103948]" />
                                            </div>
                                            <span className="text-sm font-semibold text-gray-500 group-hover:text-[#103948]">Subir foto de la habitación</span>
                                        </div>
                                        <input
                                            type="file"
                                            accept="image/*,.heic,.heif"
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                            onChange={handleImageUpload}
                                        />
                                    </div>

                                    {/* Status Message */}
                                    {wallImage === 'converting' && (
                                        <p className="text-sm text-yellow-600 animate-pulse font-medium">Procesando formato HEIC...</p>
                                    )}
                                    {isAnalyzing && (
                                        <div className="fixed inset-0 bg-white/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
                                            <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-100 border-t-[#FCB9C9] mb-4"></div>
                                            <p className="text-[#103948] font-bold text-lg animate-pulse">Analizando tu pared...</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {step === 'calibrate' && wallImage && wallImage !== 'converting' && (
                            <div className="flex-1 bg-gray-50 p-4">
                                <WallCalibrator
                                    imageSrc={wallImage}
                                    onConfirm={handleCalibrationConfirm}
                                />
                            </div>
                        )}
                    </main>
                </div>
            )}
        </div>
    );
}
