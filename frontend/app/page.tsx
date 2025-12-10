'use client';
import React, { useState, useEffect } from 'react';
import { TopNav } from './components/Navbar';
import { Hero } from './components/Hero';
import { MasonryGrid } from './components/MasonryGrid';
import { AssetModal } from './components/AssetModal';
import { Asset, ViewState } from './types';
import { getAllAssets, searchAssets } from '@/lib/api-client';
import { Check, Loader } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('home');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const router = useRouter();

  // Fetch assets from backend
  useEffect(() => {
    const fetchAssets = async () => {
      try {
        setLoading(true);
        const data = await getAllAssets();
        // Transform backend data to frontend Asset format
        if (data && Array.isArray(data) && data.length > 0) {
          // Transform backend assets to frontend format
          const transformedAssets = data.map((item: any) => {
            // Convert price_wei (string) to USDC (divide by 1e6 for 6 decimals)
            let priceInUSDC = 0.01; // Default fallback
            if (item.price_wei) {
              const priceWeiNum = typeof item.price_wei === 'string' 
                ? parseInt(item.price_wei, 10) 
                : Number(item.price_wei);
              if (!isNaN(priceWeiNum) && priceWeiNum > 0) {
                priceInUSDC = priceWeiNum / 1e6; // USDC has 6 decimals
              }
            } else if (item.price) {
              const parsedPrice = parseFloat(item.price);
              if (!isNaN(parsedPrice) && parsedPrice > 0) {
                priceInUSDC = parsedPrice;
              }
            }
            
            const currency = item.currency || 'USDC';
            // Extract creator address - backend returns it as creator.address or we can use recipient_address
            const creatorAddress = item.creator?.address || 
                                  item.creator_address || 
                                  item.creator?.recipient ||
                                  item.recipient_address || 
                                  item.recipient || 
                                  'default';
            
            // Generate avatar URL - use creator address as seed for consistent avatar
            const avatarSeed = creatorAddress && creatorAddress !== 'unknown' && creatorAddress !== 'default' 
              ? creatorAddress 
              : `asset-${item.id || 'default'}`;
            const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(avatarSeed)}`;
            
            return {
              id: item.id || item.assetId,
              title: item.title || 'Untitled',
              creator: {
                id: creatorAddress,
                name: item.creator?.name || '',
                avatar: avatarUrl,
                wallet: creatorAddress !== 'default' ? creatorAddress : (item.recipient || item.recipient_address || '0x...'),
              },
              // Use preview URL (watermarked) for gallery, full quality after payment
              imageUrl: item.previewUrl || item.thumbnailUrl || item.thumbnail_ipfs_url || item.thumbnail_url || '',
              previewUrl: item.previewUrl || item.thumbnailUrl || item.thumbnail_ipfs_url || '',
              fullQualityUrl: item.ipfsUrl || item.ipfs_url || '', // Full quality (only after payment)
              width: item.width || 800,
              height: item.height || 600,
              mimeType: item.file_type || item.fileType || item.mimeType || 'image/jpeg',
              cid: item.ipfsCid || item.ipfs_cid || '',
              ipId: item.storyIPId || item.story_ip_id || '',
              fingerprint: item.fingerprint || item.perceptual_hash || '',
              hash: item.hash || '',
              authScore: 0.95,
              tags: item.tags || [],
              likes: 0,
              views: 0,
              priceTiers: [
                {
                  tier: 'preview' as const,
                  label: 'Personal Use',
                  price: priceInUSDC || 0.01,
                  currency: currency,
                  features: ['4K Resolution', 'No watermark', 'Personal Use']
                }
              ],
              createdAt: item.created_at || item.createdAt || new Date().toISOString()
            };
          });
          setAssets(transformedAssets);
        } else {
          // No assets found - show empty state
          setAssets([]);
        }
      } catch (error) {
        console.error('Failed to fetch assets:', error);
        // Set empty array on error - don't break the UI
        setAssets([]);
        // Optionally show error toast
        if (error instanceof Error) {
          console.error('Error details:', error.message);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchAssets();
  }, []);

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
    router.push('/dashboard');
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
        onChangeView={(v) => {
          setView(v);
          if (v === 'upload') router.push('/upload-flow');
          else if (v === 'dashboard') router.push('/dashboard');
          else if (v === 'home') router.push('/');
        }}
      />

      <main>
        {view === 'home' && (
          <>
            <Hero 
                onSearch={(term) => { console.log(term); router.push('/dashboard'); }}
                onExplore={() => router.push('/dashboard')}
            />
            <div className="border-t border-gray-100 bg-white">
                <div className="max-w-[1800px] mx-auto px-6 py-12">
                    <div className="flex items-center gap-4 mb-8">
                        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Trending Now</h2>
                        <div className="h-px bg-gray-100 flex-1"></div>
                    </div>
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader className="w-8 h-8 animate-spin text-[#0033FF]" />
                        </div>
                    ) : (
                        <MasonryGrid assets={assets.slice(0, 10)} onAssetClick={handleAssetClick} />
                    )}
                </div>
            </div>
          </>
        )}

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