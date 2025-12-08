'use client';
import React, { useState } from 'react';
import { X, Share2, Shield, Heart, Check, Box, Cpu, Download } from 'lucide-react';
import { Asset, PriceTier } from '../types';

interface AssetModalProps {
    asset: Asset;
    onClose: () => void;
    onPurchase: (tier: PriceTier) => void;
}

export const AssetModal: React.FC<AssetModalProps> = ({ asset, onClose, onPurchase }) => {
    const [activeTab, setActiveTab] = useState<'details' | 'license'>('details');
    const [purchasing, setPurchasing] = useState(false);

    const handleBuy = (tier: PriceTier) => {
        setPurchasing(true);
        setTimeout(() => {
            setPurchasing(false);
            onPurchase(tier);
        }, 1500);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
            <div 
                className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            ></div>

            <div className="relative bg-white rounded-3xl w-full max-w-7xl h-[90vh] flex overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                
                {/* Close Button */}
                <button onClick={onClose} className="absolute top-6 right-6 z-20 bg-white/80 hover:bg-white text-black p-2 rounded-full transition-all shadow-md">
                    <X className="w-5 h-5" />
                </button>

                {/* Left: Image Canvas */}
                <div className="w-full lg:w-2/3 bg-[#F3F4F6] flex items-center justify-center relative p-8 group">
                    <img 
                        src={asset.imageUrl} 
                        alt={asset.title} 
                        className="max-h-full max-w-full object-contain shadow-2xl rounded-lg"
                    />

                    <div className="absolute bottom-8 left-8 z-10">
                         <div className="bg-white/90 backdrop-blur border border-gray-200 px-4 py-2 rounded-full flex items-center gap-3 shadow-lg">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">Story Protocol Verified</span>
                         </div>
                    </div>
                </div>

                {/* Right: Info Panel */}
                <div className="w-full lg:w-1/3 bg-white border-l border-gray-100 flex flex-col overflow-y-auto relative">
                    
                    {/* Header */}
                    <div className="p-8 border-b border-gray-100">
                        <h2 className="text-3xl font-black text-[#0F172A] mb-2 leading-tight">{asset.title}</h2>
                        <div className="flex items-center gap-3 mb-8">
                            <img src={asset.creator.avatar} className="w-10 h-10 rounded-full border border-gray-200" />
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-[#0F172A]">{asset.creator.name}</span>
                                <span className="text-xs text-gray-500 font-medium">{asset.creator.wallet}</span>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-8 border-b border-gray-100">
                            <button 
                                onClick={() => setActiveTab('details')} 
                                className={`pb-4 text-sm font-bold tracking-widest uppercase transition-all ${activeTab === 'details' ? 'text-[#0033FF] border-b-2 border-[#0033FF]' : 'text-gray-400 hover:text-black'}`}
                            >
                                Details
                            </button>
                            <button 
                                onClick={() => setActiveTab('license')} 
                                className={`pb-4 text-sm font-bold tracking-widest uppercase transition-all ${activeTab === 'license' ? 'text-[#0033FF] border-b-2 border-[#0033FF]' : 'text-gray-400 hover:text-black'}`}
                            >
                                License
                            </button>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="p-8 flex-1 bg-gray-50/50">
                        {activeTab === 'details' && (
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                        <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Type</p>
                                        <p className="text-sm text-[#0F172A] font-bold">{asset.mimeType}</p>
                                    </div>
                                    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                        <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Size</p>
                                        <p className="text-sm text-[#0F172A] font-bold">{asset.width} x {asset.height}</p>
                                    </div>
                                    <div className="col-span-2 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                        <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Fingerprint</p>
                                        <p className="text-xs text-[#0033FF] font-mono break-all bg-blue-50 p-2 rounded">{asset.fingerprint}</p>
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                                    <h3 className="text-sm font-bold text-[#0F172A] mb-3 flex items-center gap-2">
                                        <Cpu className="w-4 h-4 text-[#0033FF]" />
                                        AI Data Permissions
                                    </h3>
                                    <p className="text-xs text-gray-500 leading-relaxed">
                                        <span className="text-green-600 font-bold bg-green-50 px-1 rounded">GRANTED</span> 
                                        Opted-in for generative training. License holders earn programmatic royalties from derivative models.
                                    </p>
                                </div>
                            </div>
                        )}

                        {activeTab === 'license' && (
                            <div className="space-y-4">
                                {asset.priceTiers.map((tier) => (
                                    <div 
                                        key={tier.tier} 
                                        onClick={() => handleBuy(tier)}
                                        className="group cursor-pointer bg-white border-2 border-transparent hover:border-[#0033FF] p-6 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300"
                                    >
                                        <div className="flex justify-between items-center mb-3">
                                            <h4 className="font-bold text-[#0F172A] text-lg capitalize">{tier.label}</h4>
                                            <span className="text-[#0033FF] font-black text-xl">{tier.price} SOL</span>
                                        </div>
                                        <ul className="space-y-2 mb-6">
                                            {tier.features.map((f, i) => (
                                                <li key={i} className="flex items-center text-xs font-medium text-gray-500">
                                                    <Check className="w-4 h-4 text-[#0033FF] mr-2" />
                                                    {f}
                                                </li>
                                            ))}
                                        </ul>
                                        <button className="w-full py-3 bg-gray-100 group-hover:bg-[#0033FF] text-[#0F172A] group-hover:text-white font-bold text-sm uppercase tracking-widest rounded-xl transition-colors">
                                            {purchasing ? 'Processing...' : 'Purchase License'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};