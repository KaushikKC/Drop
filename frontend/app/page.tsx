'use client';
import React, { useState } from 'react';
import { TopNav } from './components/Navbar';
import { Hero } from './components/Hero';
import { MasonryGrid } from './components/MasonryGrid';
import { AssetModal } from './components/AssetModal';
import { UploadFlow } from './upload-flow/page';
import { Dashboard } from './dashboard/page';
import { Asset, ViewState } from './types';
import { MOCK_ASSETS } from './constants';
import { Check } from 'lucide-react';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('home');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [walletConnected, setWalletConnected] = useState(false);
  const [assets, setAssets] = useState<Asset[]>(MOCK_ASSETS);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleAssetClick = (asset: Asset) => {
    setSelectedAsset(asset);
  };

  const handlePurchase = (tier: any) => {
    setTimeout(() => {
        setSelectedAsset(null);
        triggerToast(`Success: ${tier.label} Purchased`);
    }, 500);
  };

  const handleUploadComplete = () => {
    triggerToast("IP Registered Successfully");
    setView('gallery');
  };

  const handleConnectWallet = () => {
      setWalletConnected(true);
      triggerToast("Wallet Connected");
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-[#0F172A]">
      
      {/* Premium Light Toast */}
      <div className={`fixed bottom-8 right-8 z-[200] transition-all duration-500 transform ${showToast ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <div className="bg-[#0F172A] text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3">
             <div className="bg-[#0033FF] p-1 rounded-full text-white">
                 <Check className="w-4 h-4" />
             </div>
             <span className="font-bold text-sm tracking-wide">{toastMessage}</span>
          </div>
      </div>

      <TopNav 
        currentView={view} 
        onChangeView={setView} 
        walletConnected={walletConnected} 
        onConnectWallet={handleConnectWallet}
      />

      <main>
        {view === 'home' && (
          <>
            <Hero 
                onSearch={(term) => { console.log(term); setView('gallery'); }}
                onExplore={() => setView('gallery')}
            />
            <div className="border-t border-gray-100 bg-white">
                <div className="max-w-[1800px] mx-auto px-6 py-12">
                    <div className="flex items-center gap-4 mb-8">
                        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Trending Now</h2>
                        <div className="h-px bg-gray-100 flex-1"></div>
                    </div>
                    <MasonryGrid assets={assets.slice(0, 10)} onAssetClick={handleAssetClick} />
                </div>
            </div>
          </>
        )}

        {view === 'gallery' && (
          <div className="animate-in fade-in duration-500">
             <div className="sticky top-[73px] z-40 bg-white/80 backdrop-blur-md border-b border-gray-200 py-4 px-8 flex justify-between items-center">
                <h1 className="text-xl font-black tracking-tight text-[#0F172A]">EXPLORE</h1>
                <div className="flex gap-4">
                    <button className="text-xs font-bold text-[#0033FF] bg-blue-50 px-3 py-1 rounded-full">All Assets</button>
                    <button className="text-xs font-bold text-gray-500 hover:text-black transition-colors px-3 py-1">Newest</button>
                </div>
             </div>
             <MasonryGrid assets={assets} onAssetClick={handleAssetClick} />
          </div>
        )}

        {view === 'upload' && <UploadFlow onComplete={handleUploadComplete} />}

        {view === 'dashboard' && <Dashboard />}
      </main>

      {selectedAsset && (
        <AssetModal 
            asset={selectedAsset} 
            onClose={() => setSelectedAsset(null)} 
            onPurchase={handlePurchase}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-12">
         <div className="max-w-[1600px] mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
             <div className="text-center md:text-left">
                 <h4 className="font-black text-[#0F172A] text-lg tracking-tight">DROP</h4>
                 <p className="text-xs text-gray-400 font-bold mt-1 uppercase">Visual IP Layer</p>
             </div>
             <div className="flex gap-8 text-xs font-bold text-gray-400 uppercase tracking-wider">
                 <a href="#" className="hover:text-[#0033FF] transition-colors">Documentation</a>
                 <a href="#" className="hover:text-[#0033FF] transition-colors">Terms</a>
                 <a href="#" className="hover:text-[#0033FF] transition-colors">Twitter</a>
             </div>
         </div>
      </footer>
    </div>
  );
};

export default App;