'use client';
import React, { useState } from 'react';
import { Upload, X, Check, Zap, Scan } from 'lucide-react';

interface UploadFlowProps {
    onComplete: () => void;
}

export const UploadFlow: React.FC<UploadFlowProps> = ({ onComplete }) => {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [scanning, setScanning] = useState(false);
    const [scanComplete, setScanComplete] = useState(false);
    const [title, setTitle] = useState('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) processFile(e.target.files[0]);
    };

    const processFile = (f: File) => {
        setFile(f);
        setPreview(URL.createObjectURL(f));
        setTitle(f.name.split('.')[0]);
        setScanning(true);
        setTimeout(() => {
            setScanning(false);
            setScanComplete(true);
        }, 2500);
    }

    if (!file) {
        return (
            <div className="min-h-[calc(100vh-80px)] flex items-center justify-center p-6 bg-[#F9FAFB]">
                <div className="w-full max-w-3xl h-[400px] border-2 border-dashed border-gray-300 hover:border-[#0033FF] rounded-3xl bg-white flex flex-col items-center justify-center relative transition-all group cursor-pointer hover:shadow-2xl hover:bg-blue-50/10">
                    <input type="file" className="absolute inset-0 opacity-0 z-10 cursor-pointer" onChange={handleFileChange} />
                    
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-sm border border-gray-100">
                        <Upload className="w-8 h-8 text-gray-400 group-hover:text-[#0033FF] transition-colors" />
                    </div>
                    <h2 className="text-2xl font-black text-[#0F172A] mb-2">Upload Asset</h2>
                    <p className="text-gray-500 font-medium">Drag & drop or click to browse</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 bg-[#F9FAFB] flex flex-col">
            {/* Header */}
            <div className="h-16 border-b border-gray-200 flex items-center justify-between px-8 bg-white">
                 <div className="flex items-center gap-4">
                    <button onClick={() => setFile(null)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-black transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                    <span className="font-bold text-sm text-[#0033FF] bg-blue-50 px-3 py-1 rounded-full uppercase tracking-wider">Studio</span>
                 </div>
                 <button 
                    onClick={onComplete}
                    disabled={!scanComplete}
                    className={`px-8 py-2.5 rounded-lg font-bold text-sm uppercase tracking-wide transition-all shadow-lg ${
                        scanComplete 
                        ? 'bg-[#0033FF] text-white hover:bg-blue-700 hover:shadow-blue-500/30' 
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                    }`}
                 >
                    {scanComplete ? 'Publish IP' : 'Analyzing...'}
                 </button>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Preview Canvas */}
                <div className="flex-1 bg-gray-50 relative flex items-center justify-center p-12">
                    <div className="relative shadow-2xl rounded-lg p-2 bg-white">
                        <img src={preview!} className="max-h-[60vh] max-w-full opacity-100 rounded" />
                        
                        {/* Scanning Effect */}
                        {scanning && (
                            <div className="absolute inset-0 z-20 overflow-hidden rounded">
                                <div className="w-full h-1 bg-[#0033FF] shadow-[0_0_20px_#0033FF] absolute top-0 animate-[scan_2s_ease-in-out_infinite]"></div>
                                <div className="absolute bottom-4 right-4 bg-black/80 text-white px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 backdrop-blur-md">
                                    <Scan className="w-4 h-4 animate-spin" /> Generating Fingerprint...
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar */}
                <div className="w-[400px] bg-white border-l border-gray-200 flex flex-col shadow-xl z-10">
                    <div className="p-8 space-y-8 overflow-y-auto">
                        
                        {/* Status */}
                        <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-xs font-black text-gray-400 uppercase tracking-wider">IP Protocol Status</span>
                                {scanComplete ? <div className="bg-green-500 text-white p-1 rounded-full"><Check className="w-3 h-3"/></div> : <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>}
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between text-xs font-bold">
                                    <span className="text-gray-500">Hash Generation</span>
                                    <span className={scanComplete ? 'text-[#0F172A]' : 'text-gray-400'}>{scanComplete ? '0x82...9A2' : 'Pending'}</span>
                                </div>
                                <div className="flex justify-between text-xs font-bold">
                                    <span className="text-gray-500">Uniqueness</span>
                                    <span className={scanComplete ? 'text-green-600' : 'text-gray-400'}>{scanComplete ? '100% Unique' : 'Checking...'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Inputs */}
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Title</label>
                                <input 
                                    type="text" 
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full bg-white border border-gray-200 rounded-lg p-3 text-[#0F172A] font-bold focus:border-[#0033FF] focus:ring-1 focus:ring-[#0033FF] outline-none transition-all"
                                />
                            </div>
                        </div>

                        {/* Selection */}
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-3">License Type</label>
                            <div className="grid gap-3">
                                <div className="p-4 border-2 border-[#0033FF] bg-blue-50/30 rounded-xl cursor-pointer">
                                    <div className="flex justify-between mb-1">
                                        <span className="text-sm font-black text-[#0F172A]">Commercial</span>
                                        <Zap className="w-4 h-4 text-[#0033FF]" />
                                    </div>
                                    <span className="text-xs text-gray-500 font-medium">Standard royalty model. 0.5 SOL</span>
                                </div>
                                <div className="p-4 border border-gray-200 bg-white rounded-xl cursor-pointer hover:border-gray-400">
                                    <div className="flex justify-between mb-1">
                                        <span className="text-sm font-black text-gray-500">Exclusive</span>
                                    </div>
                                    <span className="text-xs text-gray-400 font-medium">Full ownership transfer.</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

         
        </div>
    );
};