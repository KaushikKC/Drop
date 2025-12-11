import React from 'react';
import { Asset } from '../types';
import { Heart, Shield } from 'lucide-react';
import Image from 'next/image';
import { getProxyIpfsUrl } from '@/lib/ipfs-utils';

interface MasonryGridProps {
  assets: Asset[];
  onAssetClick: (asset: Asset) => void;
}

export const MasonryGrid: React.FC<MasonryGridProps> = ({ assets, onAssetClick }) => {
  return (
    <div className="w-full max-w-[1800px] mx-auto px-4 py-12">
      <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-8 space-y-8">
        {assets.map((asset) => (
          <div 
            key={asset.id} 
            className="group relative mb-8 break-inside-avoid"
            onClick={() => onAssetClick(asset)}
          >
            {/* Card Content */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 cursor-pointer">
                
                {/* Image */}
                <div className="relative overflow-hidden">
                    <Image 
                      width={500}
                      height={500}
                      src={getProxyIpfsUrl(asset.imageUrl)} 
                      alt={asset.title} 
                      loading="lazy"
                      className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    
                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                         <div className="flex justify-between items-center">
                             <span className="bg-white text-black text-xs font-bold px-3 py-1.5 rounded-full">
                                {asset.priceTiers && asset.priceTiers.length > 0 && asset.priceTiers[0] 
                                  ? (() => {
                                      const tier = asset.priceTiers[0];
                                      const price = typeof tier.price === 'number' && !isNaN(tier.price) 
                                        ? tier.price.toFixed(3) 
                                        : '0.01';
                                      const currency = tier.currency || 'USDC';
                                      return `${price} ${currency}`;
                                    })()
                                  : '0.01 USDC'}
                             </span>
                             <button className="bg-white/20 backdrop-blur-md p-2 rounded-full text-white hover:bg-white hover:text-red-500 transition-colors">
                                <Heart className="w-4 h-4 fill-current" />
                             </button>
                         </div>
                    </div>
                </div>

                {/* Details Footer */}
                <div className="p-4">
                    <h3 className="text-[#0F172A] font-bold text-sm tracking-tight mb-1 truncate">{asset.title}</h3>
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                             <img 
                                src={asset.creator.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${asset.creator.id || 'default'}`} 
                                alt={asset.creator.name || 'Creator'} 
                                className="w-5 h-5 rounded-full bg-gray-200" 
                             />
                             <span className="text-xs text-gray-500 font-medium truncate max-w-[100px]">{asset.creator.id}</span>
                        </div>
                        {asset.authScore > 0.9 && (
                            <div className="flex items-center gap-1 text-[#0033FF] bg-blue-50 px-1.5 py-0.5 rounded">
                                <Shield className="w-3 h-3" />
                                <span className="text-[10px] font-bold">IP</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};