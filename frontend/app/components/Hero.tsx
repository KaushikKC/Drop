'use client';
import React, { useEffect, useState } from 'react';
import { Search, ArrowRight, Activity, ArrowUpRight } from 'lucide-react';
import Image from 'next/image';

const HERO_IMAGES = [
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1634152962476-4b8a00e1915c?q=80&w=600&auto=format&fit=crop",
];

const KEYWORDS = ["Monetize", "License", "Protect", "Trade"];

interface HeroProps {
    onSearch: (term: string) => void;
    onExplore: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onSearch, onExplore }) => {
    const [keywordIndex, setKeywordIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setKeywordIndex((prev) => (prev + 1) % KEYWORDS.length);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="relative w-full min-h-[85vh] bg-[#F9FAFB] overflow-hidden flex flex-col items-center justify-center">
            
            {/* Minimalist Grid Background */}
            <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#E5E7EB_1px,transparent_1px),linear-gradient(to_bottom,#E5E7EB_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-60"></div>
            </div>

            {/* Floating 3D-ish Elements (CSS only) */}
            <div className="absolute top-20 right-[-10%] w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-50 animate-pulse"></div>
            <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-indigo-100 rounded-full blur-3xl opacity-40"></div>

            {/* Content Container */}
            <div className="relative z-10 w-full max-w-6xl px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center py-4">
                
                {/* Left: Text & Search */}
                <div className="text-left animate-fade-in-up">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-gray-200 shadow-sm mb-8">
                        <Activity className="w-4 h-4 text-[#0033FF]" />
                        <span className="text-xs font-bold text-gray-600 uppercase tracking-widest">Protocol V2 Live</span>
                    </div>

                    <h1 className="text-6xl md:text-8xl font-black text-[#0F172A] leading-[0.9] tracking-tighter mb-6">
                        VISUAL <br/>
                        <span className="text-[#0033FF]">IP LAYER.</span>
                    </h1>

                    {/* Animated Changing Text */}
                    <div className="mb-2 h-16 md:h-14 flex items-start">
                        <div className="relative overflow-hidden inline-block">
                            <div 
                                key={keywordIndex}
                                className="text-3xl md:text-4xl font-black text-[#0033FF] animate-text-change inline-block"
                            >
                                {KEYWORDS[keywordIndex]}
                            </div>
                        </div>
                        <span className="text-3xl md:text-4xl font-black text-[#0F172A] ml-3">
                            Your Assets
                        </span>
                    </div>

                    <p className="text-lg text-gray-600 max-w-lg mb-10 leading-relaxed font-medium">
                        The definitive registry for digital creators. 
                        <span className="text-[#0F172A] font-bold"> Register,</span> 
                        <span className="text-[#0F172A] font-bold"> License,</span> and 
                        <span className="text-[#0F172A] font-bold"> Monetize</span> your creative assets on the Story Protocol.
                    </p>

                    {/* Search Component */}
                    <div className="flex flex-col sm:flex-row gap-4 max-w-lg">
                        <div className="flex-1 relative group">
                            <div className="absolute inset-0 bg-blue-500 rounded-xl blur opacity-20 group-hover:opacity-30 transition duration-500"></div>
                            <div className="relative bg-white flex items-center p-2 rounded-xl border border-gray-200 shadow-sm transition-all focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-500">
                                <Search className="ml-3 w-5 h-5 text-gray-400" />
                                <input 
                                    type="text" 
                                    placeholder="Search assets..." 
                                    className="flex-1 bg-transparent border-none text-[#0F172A] px-4 py-2 focus:ring-0 placeholder-gray-400 font-medium"
                                    onKeyDown={(e) => e.key === 'Enter' && onSearch(e.currentTarget.value)}
                                />
                            </div>
                        </div>
                        <button 
                            onClick={onExplore}
                            className="px-8 py-4 bg-[#0F172A] text-white rounded-xl font-bold hover:bg-[#0033FF] transition-colors shadow-lg shadow-gray-200 flex items-center justify-center gap-2"
                        >
                            Explore
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="mt-12 flex items-center gap-8 text-sm font-bold text-gray-500">
                        <span className="flex items-center gap-2"><div className="w-2 h-2 bg-green-500 rounded-full"></div> 142K+ Assets</span>
                        <span className="flex items-center gap-2"><div className="w-2 h-2 bg-blue-500 rounded-full"></div> $8.2M Volume</span>
                    </div>
                </div>

                {/* Right: Visual Showcase (Cards) */}
                <div className="hidden lg:block relative h-[600px]">
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 flex gap-6 rotate-[-12deg] translate-x-12">
                        {/* Column 1 */}
                        <div className="flex flex-col gap-6 animate-scroll-slow">
                            {HERO_IMAGES.slice(0, 2).map((img, i) => (
                                <div key={i} className="w-64 h-80 bg-white p-2 rounded-2xl shadow-xl border border-gray-100">
                                    <img src={img} className="w-full h-full object-cover rounded-xl" />
                                </div>
                            ))}
                             {HERO_IMAGES.slice(0, 2).map((img, i) => (
                                <div key={`dup-${i}`} className="w-64 h-80 bg-white p-2 rounded-2xl shadow-xl border border-gray-100">
                                    <img src={img} className="w-full h-full object-cover rounded-xl" />
                                </div>
                            ))}
                        </div>
                        
                        {/* Column 2 */}
                        <div className="flex flex-col gap-6 mt-20 animate-scroll-slow-reverse">
                            {HERO_IMAGES.slice(2, 4).map((img, i) => (
                                <div key={i} className="w-64 h-80 bg-white p-2 rounded-2xl shadow-xl border border-gray-100">
                                    <img src={img} className="w-full h-full object-cover rounded-xl" />
                                </div>
                            ))}
                             {HERO_IMAGES.slice(2, 4).map((img, i) => (
                                <div key={`dup-${i}`} className="w-64 h-80 bg-white p-2 rounded-2xl shadow-xl border border-gray-100">
                                    <Image src={img} alt="Hero Image" width={256} height={320} className="w-full h-full object-cover rounded-xl" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

           
        </div>
    );
};