'use client';
import React, { useState, useEffect } from 'react';
import { X, Share2, Shield, Heart, Check, Box, Cpu, Download, AlertCircle, Loader, Copy } from 'lucide-react';
import { Asset, PriceTier } from '../types';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { getAsset, verifyPayment, downloadAsset } from '@/lib/api-client';
import { payAndVerify } from '@/lib/payment';
import { ethers } from 'ethers';
import Image from 'next/image';
import { getProxyIpfsUrl } from '@/lib/ipfs-utils';

interface AssetModalProps {
    asset: Asset;
    onClose: () => void;
    onPurchase: (tier: PriceTier) => void;
}

export const AssetModal: React.FC<AssetModalProps> = ({ asset, onClose, onPurchase }) => {
    const { authenticated } = usePrivy();
    const { wallets } = useWallets();
    const [activeTab, setActiveTab] = useState<'details' | 'license'>('details');
    const [purchasing, setPurchasing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasAccess, setHasAccess] = useState(false);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [paymentChallenge, setPaymentChallenge] = useState<any>(null);
    const [licenseInfo, setLicenseInfo] = useState<any>(null); // Store license info after purchase
    const [downloading, setDownloading] = useState(false);

    // Check if user has access when modal opens
    useEffect(() => {
        const checkAccess = async () => {
            const walletAddress = wallets[0]?.address;
            const storedToken = localStorage.getItem(`access_token_${asset.id}`);
            
            // First, check with wallet address to see if user has existing purchase (permanent license)
            if (walletAddress) {
                try {
                    const result = await getAsset(asset.id, storedToken || undefined, walletAddress);
                    if (!result.requiresPayment) {
                        setHasAccess(true);
                        // Use returned access token or stored token
                        const token = result.data?.accessToken || storedToken;
                        if (token) {
                            setAccessToken(token);
                            localStorage.setItem(`access_token_${asset.id}`, token);
                        }
                        // If this is from existing purchase, don't show payment challenge
                        if (result.data?.hasExistingPurchase) {
                            return; // User already owns this license permanently
                        }
                    }
                } catch (err) {
                    console.error('Error checking existing purchase:', err);
                }
            }
            
            // If no existing purchase found, check stored token
            if (storedToken && !hasAccess) {
                try {
                    const result = await getAsset(asset.id, storedToken, walletAddress);
                    if (!result.requiresPayment) {
                        setHasAccess(true);
                        setAccessToken(storedToken);
                        return;
                    } else {
                        localStorage.removeItem(`access_token_${asset.id}`);
                    }
                } catch (err) {
                    localStorage.removeItem(`access_token_${asset.id}`);
                }
            }
            
            // If no access found, fetch payment challenge
            if (!hasAccess) {
                try {
                    const result = await getAsset(asset.id, undefined, walletAddress);
                    if (result.requiresPayment) {
                        // The challenge is nested: result.challenge contains the challenge object
                        const challenge = result.challenge;
                        if (challenge && challenge.amount) {
                            // Ensure amount is a string for BigInt conversion
                            // Backend returns amount as price_wei (string or number)
                            const amountValue = challenge.amount?.toString() || '';
                            if (!amountValue || amountValue === 'undefined' || amountValue === 'null') {
                                setError('Invalid payment challenge: amount is missing');
                                return;
                            }
                            
                            const normalizedChallenge = {
                                ...challenge,
                                amount: amountValue,
                                tokenAddress: challenge.tokenAddress || undefined,
                                recipient: challenge.recipient || '',
                                paymentRequestToken: challenge.paymentRequestToken || '',
                                // Include platform fee information if available
                                platformFee: challenge.platformFee,
                                creatorAmount: challenge.creatorAmount,
                            };
                            setPaymentChallenge(normalizedChallenge);
                        } else {
                            setError('Invalid payment challenge received: missing amount or recipient');
                        }
                    } else {
                        setHasAccess(true);
                    }
                } catch (err: any) {
                    setError(err.message || 'Failed to load asset');
                }
            }
        };
        checkAccess();
    }, [asset.id]);

    const handleBuy = async (tier: PriceTier) => {
        if (!authenticated || !wallets[0]) {
            setError('Please connect your wallet first');
            return;
        }

        if (!paymentChallenge) {
            setError('Payment challenge not available');
            return;
        }

        setPurchasing(true);
        setError(null);

        try {
            // Get signer from Privy wallet
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();

            // Ensure challenge has required fields
            if (!paymentChallenge?.amount || !paymentChallenge?.recipient) {
                throw new Error('Invalid payment challenge: missing amount or recipient');
            }

            // Ensure amount is a valid string (not undefined)
            const amountStr = paymentChallenge.amount?.toString();
            if (!amountStr || amountStr === 'undefined' || amountStr === 'null') {
                throw new Error('Invalid payment challenge: amount is invalid');
            }

            // Get paymentRequestToken from challenge
            const paymentRequestToken = paymentChallenge.paymentRequestToken || '';

            // Make payment and verify
            const result = await payAndVerify(
                {
                    tokenAddress: paymentChallenge.tokenAddress,
                    recipient: paymentChallenge.recipient,
                    amount: amountStr, // Already validated as string
                    paymentRequestToken: paymentRequestToken,
                    expiresAt: paymentChallenge.expiresAt,
                    // Include platform fee information if available
                    platformFee: paymentChallenge.platformFee,
                    creatorAmount: paymentChallenge.creatorAmount,
                },
                signer,
                paymentRequestToken,
                asset.id
            );

            // Save access token and license info
            localStorage.setItem(`access_token_${asset.id}`, result.accessToken);
            setAccessToken(result.accessToken);
            setHasAccess(true);
            if (result.license) {
                setLicenseInfo(result.license);
                localStorage.setItem(`license_${asset.id}`, JSON.stringify(result.license));
            }
            onPurchase(tier);
        } catch (err: any) {
            console.error('Payment error:', err);
            setError(err.message || 'Payment failed. Please try again.');
        } finally {
            setPurchasing(false);
        }
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
                        src={hasAccess && asset.fullQualityUrl 
                            ? getProxyIpfsUrl(asset.fullQualityUrl) 
                            : getProxyIpfsUrl(asset.previewUrl || asset.imageUrl)} 
                        alt={asset.title} 
                        className="max-h-full max-w-full object-contain shadow-2xl rounded-lg"
                    />
                    {!hasAccess && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/5 pointer-events-none">
                            <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-lg shadow-lg border border-gray-200">
                                <p className="text-sm font-bold text-gray-700">Watermarked Preview</p>
                                <p className="text-xs text-gray-500 mt-1">Purchase to download full quality</p>
                            </div>
                        </div>
                    )}

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
                             <img 
                                src={asset.creator.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${asset.creator.id || 'default'}`} 
                                alt={asset.creator.name || 'Creator'} 
                                className="w-10 h-10 rounded-full border border-gray-200" 
                             />
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
                                        <p className="text-[10px] text-gray-500 uppercase font-bold mb-2">Fingerprint (pHash)</p>
                                        <div className="flex items-center gap-2 bg-blue-50 p-2 rounded">
                                            <p className="text-xs text-[#0033FF] font-mono break-all flex-1">{asset.fingerprint || 'N/A'}</p>
                                            {asset.fingerprint && (
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(asset.fingerprint);
                                                        // Show toast notification
                                                        const toast = document.createElement('div');
                                                        toast.className = 'fixed bottom-4 right-4 bg-[#0F172A] text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2';
                                                        toast.innerHTML = '<span>✓ Copied to clipboard</span>';
                                                        document.body.appendChild(toast);
                                                        setTimeout(() => toast.remove(), 2000);
                                                    }}
                                                    className="p-1.5 hover:bg-blue-100 rounded transition-colors flex-shrink-0"
                                                    title="Copy fingerprint"
                                                >
                                                    <Copy className="w-4 h-4 text-[#0033FF]" />
                                                </button>
                                            )}
                                        </div>
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
                                {error && (
                                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
                                        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                                        <p className="text-sm text-red-700 font-medium">{error}</p>
                                    </div>
                                )}

                                {hasAccess ? (
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center space-y-4">
                                        <Check className="w-12 h-12 text-green-500 mx-auto mb-3" />
                                        <h4 className="font-bold text-green-700 mb-2">Access Granted</h4>
                                        <p className="text-sm text-green-600 mb-4">You have access to this asset</p>
                                        
                                        {/* License Info */}
                                        {licenseInfo && (
                                            <div className="bg-white/50 rounded-lg p-4 mb-4 text-left">
                                                <p className="text-xs font-bold text-gray-500 uppercase mb-2">License Details</p>
                                                <p className="text-xs text-gray-700 mb-1">
                                                    <span className="font-medium">Type:</span> {licenseInfo.type || 'personal'}
                                                </p>
                                                {licenseInfo.storyLicenseId && (
                                                    <p className="text-xs text-gray-700 mb-1">
                                                        <span className="font-medium">License ID:</span> 
                                                        <span className="font-mono text-[#0033FF] ml-1">
                                                            {licenseInfo.storyLicenseId.substring(0, 10)}...{licenseInfo.storyLicenseId.substring(licenseInfo.storyLicenseId.length - 8)}
                                                        </span>
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {/* Action Buttons */}
                                        <div className="flex flex-col gap-3">
                                            <button
                                                onClick={async () => {
                                                    if (!accessToken || !wallets[0]?.address) {
                                                        setError('Access token or wallet not available');
                                                        return;
                                                    }

                                                    setDownloading(true);
                                                    setError(null);

                                                    try {
                                                        // Simplified: Direct download from IPFS (full quality, no watermark)
                                                        const ipfsUrl = asset.fullQualityUrl || asset.imageUrl;
                                                        
                                                        if (!ipfsUrl) {
                                                            throw new Error('Download URL not available');
                                                        }

                                                        // Fetch the file as a blob
                                                        const response = await fetch(getProxyIpfsUrl(ipfsUrl), {
                                                            method: 'GET',
                                                        });

                                                        if (!response.ok) {
                                                            throw new Error('Failed to fetch file');
                                                        }

                                                        const blob = await response.blob();
                                                        
                                                        // Create a download link and trigger download
                                                        const url = window.URL.createObjectURL(blob);
                                                        const link = document.createElement('a');
                                                        link.href = url;
                                                        // Extract file extension from mimeType
                                                        const fileExt = asset.mimeType?.split('/')[1] || 'jpg';
                                                        link.download = `${asset.title || 'asset'}.${fileExt}`;
                                                        document.body.appendChild(link);
                                                        link.click();
                                                        
                                                        // Cleanup
                                                        document.body.removeChild(link);
                                                        window.URL.revokeObjectURL(url);
                                                    } catch (err: any) {
                                                        console.error('Download error:', err);
                                                        setError(err.message || 'Download failed. Please try again.');
                                                    } finally {
                                                        setDownloading(false);
                                                    }
                                                }}
                                                disabled={downloading || !accessToken}
                                                className="w-full px-6 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {downloading ? (
                                                    <>
                                                        <Loader className="w-4 h-4 animate-spin" />
                                                        Downloading...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Download className="w-4 h-4" />
                                                        Download Full Quality
                                                    </>
                                                )}
                                            </button>
                                            
                                            {/* View License Onchain Link */}
                                            {(licenseInfo?.storyLicenseId || asset.ipId) && (
                                                <a
                                                    href={
                                                        licenseInfo?.storyLicenseId
                                                            ? `https://aeneid.explorer.story.foundation/ipa/${asset.ipId || ''}`
                                                            : asset.ipId
                                                                ? `https://aeneid.explorer.story.foundation/ipa/${asset.ipId}`
                                                                : '#'
                                                    }
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="w-full px-6 py-2 bg-[#0033FF] text-white font-bold rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                                                >
                                                    <Shield className="w-4 h-4" />
                                                    View License Onchain
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ) : paymentChallenge ? (
                                    <div className="space-y-4">
                                        {asset.priceTiers.map((tier) => {
                                            // Use tier price directly (already in USDC)
                                            // Fallback to challenge amount if tier price is invalid
                                            let amountInUSDC = 0.01; // Default
                                            if (tier.price && typeof tier.price === 'number' && !isNaN(tier.price) && tier.price > 0) {
                                                amountInUSDC = tier.price;
                                            } else if (paymentChallenge?.amount) {
                                                const challengeAmount = typeof paymentChallenge.amount === 'string' 
                                                    ? parseInt(paymentChallenge.amount, 10) 
                                                    : Number(paymentChallenge.amount);
                                                if (!isNaN(challengeAmount) && challengeAmount > 0) {
                                                    amountInUSDC = challengeAmount / 1e6; // Convert from wei to USDC
                                                }
                                            }
                                            return (
                                    <div 
                                        key={tier.tier} 
                                                    onClick={() => !purchasing && handleBuy(tier)}
                                                    className={`group bg-white border-2 border-transparent hover:border-[#0033FF] p-6 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 ${
                                                        purchasing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                                                    }`}
                                    >
                                        <div className="flex justify-between items-center mb-3">
                                            <h4 className="font-bold text-[#0F172A] text-lg capitalize">{tier.label}</h4>
                                                        <span className="text-[#0033FF] font-black text-xl">{amountInUSDC.toFixed(2)} USDC</span>
                                        </div>
                                        <ul className="space-y-2 mb-6">
                                            {tier.features.map((f, i) => (
                                                <li key={i} className="flex items-center text-xs font-medium text-gray-500">
                                                    <Check className="w-4 h-4 text-[#0033FF] mr-2" />
                                                    {f}
                                                </li>
                                            ))}
                                        </ul>
                                                    <button 
                                                        disabled={purchasing}
                                                        className="w-full py-3 bg-gray-100 group-hover:bg-[#0033FF] text-[#0F172A] group-hover:text-white font-bold text-sm uppercase tracking-widest rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                                    >
                                                        {purchasing ? (
                                                            <>
                                                                <Loader className="w-4 h-4 animate-spin" />
                                                                Processing Payment...
                                                            </>
                                                        ) : (
                                                            'Purchase License'
                                                        )}
                                        </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <Loader className="w-8 h-8 animate-spin text-[#0033FF] mx-auto mb-3" />
                                        <p className="text-sm text-gray-500">Loading payment options...</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};