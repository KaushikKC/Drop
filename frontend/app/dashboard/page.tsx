'use client';
import React, { useEffect, useState } from 'react';
import { Wallet, Loader, Image as ImageIcon, Shield, Download, ExternalLink, Calendar, TrendingUp, Users } from 'lucide-react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { getCreatorDashboard, /* getUserLicenses, */ getCreatorTransactions, getRoyaltyToken, createRoyaltyToken, getRoyaltyRevenue, type RoyaltyToken } from '@/lib/api-client';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { TopNav } from '../components/Navbar';
import { getProxyIpfsUrl } from '@/lib/ipfs-utils';

interface DashboardProps {
    onDisconnect?: () => void;
}

interface Asset {
    id: string;
    title: string;
    description?: string;
    thumbnail_ipfs_url?: string;
    thumbnailUrl?: string;
    price_wei: string;
    price?: number;
    currency: string;
    ipfs_cid?: string;
    story_ip_id?: string;
    created_at?: string;
    createdAt?: string;
}

interface Transaction {
    id: string;
    transactionHash: string;
    amount: string;
    amountWei: string;
    blockNumber: number | null;
    verified: boolean;
    verifiedAt: string | null;
    createdAt: string;
    type: 'received' | 'sent'; // 'received' = someone bought your asset, 'sent' = you bought someone's asset
    asset: {
        id: string;
        title: string;
        thumbnailUrl?: string;
        storyIPId?: string;
        creatorAddress?: string;
        recipientAddress?: string;
    };
    buyer: {
        address: string;
    };
    seller: {
        address: string;
    };
    license: {
        type?: string;
        storyLicenseId?: string;
    };
}

export const Dashboard: React.FC<DashboardProps> = ({ onDisconnect }) => {
    const { logout } = usePrivy();
    const { wallets } = useWallets();
    const router = useRouter();
    const [createdAssets, setCreatedAssets] = useState<Asset[]>([]);
    // const [purchasedAssets, setPurchasedAssets] = useState<any[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalAssets, setTotalAssets] = useState(0);
    const [totalRevenue, setTotalRevenue] = useState(0);
    const [royaltyTokens, setRoyaltyTokens] = useState<Map<string, RoyaltyToken>>(new Map());
    const [royaltyLoading, setRoyaltyLoading] = useState<Map<string, boolean>>(new Map());
    const [totalRoyaltyRevenue, setTotalRoyaltyRevenue] = useState(0);

    useEffect(() => {
        const fetchDashboard = async () => {
            if (!wallets[0]?.address) {
                console.log('⚠️ No wallet address, skipping dashboard fetch');
                return;
            }
            
            console.log('🔄 Fetching dashboard for wallet:', wallets[0].address);
            setLoading(true);
            try {
                // Fetch creator dashboard (uploaded assets)
                const data = await getCreatorDashboard(wallets[0].address);
                setCreatedAssets(data.assets || []);
                setTotalAssets(data.stats?.total_assets || 0);
                console.log('✅ Created assets fetched:', data.assets?.length || 0);

                // Calculate total revenue from transactions (only received transactions)
                try {
                    const transactionsData = await getCreatorTransactions(wallets[0].address);
                    const allTransactions = transactionsData.transactions || [];
                    
                    console.log('📊 Transactions fetched:', {
                        total: allTransactions.length,
                        received: allTransactions.filter((t: Transaction) => t.type === 'received').length,
                        sent: allTransactions.filter((t: Transaction) => t.type === 'sent').length,
                        transactions: allTransactions,
                        rawData: transactionsData,
                    });
                    
                    setTransactions(allTransactions);
                    
                    // Calculate revenue: Only sum up 'received' transactions (when someone buys your asset)
                    // 'sent' transactions are when you buy someone else's asset (not revenue for you)
                    // Use creator_amount_wei (what creator actually receives after platform fee)
                    const receivedTxs = allTransactions.filter((tx: Transaction) => tx.type === 'received');
                    const revenue = receivedTxs.reduce((sum: number, tx: Transaction) => {
                        const amount = parseFloat(tx.amount || '0');
                        console.log(`💰 Adding revenue from transaction ${tx.id}: ${amount} USDC (type: ${tx.type})`);
                        return sum + amount;
                    }, 0) || 0;
                    
                    console.log('💰 Total License Revenue calculated:', revenue, 'USDC', `(from ${receivedTxs.length} received transactions)`);
                    setTotalRevenue(revenue);
                } catch (txError) {
                    console.error('❌ Failed to fetch transactions:', txError);
                    setTransactions([]);
                    setTotalRevenue(0);
                }

                // Fetch purchased licenses - DISABLED
                // try {
                //     const licensesData = await getUserLicenses(wallets[0].address);
                //     console.log('Purchased licenses fetched:', licensesData); // Debug log
                //     // Handle both { licenses: [...] } and direct array response
                //     const licenses = licensesData?.licenses || licensesData || [];
                //     setPurchasedAssets(Array.isArray(licenses) ? licenses : []);
                // } catch (error) {
                //     console.error('Failed to fetch purchased licenses:', error);
                //     setPurchasedAssets([]); // Set empty array on error
                // }

                // Fetch royalty tokens for created assets
                const royaltyTokensMap = new Map<string, RoyaltyToken>();
                let totalRoyalty = 0;
                
                for (const asset of data.assets || []) {
                    if (asset.story_ip_id) {
                        try {
                            const royaltyToken = await getRoyaltyToken(asset.id);
                            if (royaltyToken) {
                                royaltyTokensMap.set(asset.id, royaltyToken);
                                totalRoyalty += parseFloat(royaltyToken.totalRevenue || '0') / 1e6; // Convert from wei to USDC
                            }
                        } catch (error) {
                            console.error(`Failed to fetch royalty token for asset ${asset.id}:`, error);
                        }
                    }
                }
                
                setRoyaltyTokens(royaltyTokensMap);
                setTotalRoyaltyRevenue(totalRoyalty);
            } catch (error) {
                console.error('❌ Failed to fetch dashboard:', error);
                setTransactions([]);
                setTotalRevenue(0);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboard();
        
        // Refresh every 30 seconds to catch new transactions
        const refreshInterval = setInterval(() => {
            if (wallets[0]?.address && !loading) {
                console.log('🔄 Auto-refreshing dashboard...');
                fetchDashboard();
            }
        }, 30000); // 30 seconds
        
        return () => clearInterval(refreshInterval);
    }, [wallets]);

    const handleDisconnect = async () => {
        try {
            await logout();
            if (onDisconnect) {
                onDisconnect();
            } else {
                router.push('/');
            }
        } catch (error) {
            console.error('Error disconnecting wallet:', error);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatAddress = (address: string) => {
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    };

    return (
        <div className="min-h-screen bg-[#F9FAFB]">
            <TopNav currentView="dashboard" onChangeView={() => {}} />
        <div className="max-w-[1600px] mx-auto px-6 py-12">
                {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
                <div>
                    <h1 className="text-4xl font-black text-[#0F172A] tracking-tight mb-2">DASHBOARD</h1>
                        <p className="text-gray-500 font-medium text-sm">Overview of your IP assets and transactions.</p>
                </div>
                    <button 
                        onClick={handleDisconnect}
                        className="px-6 py-3 bg-red-500 text-white font-bold rounded-lg text-sm hover:bg-red-600 shadow-lg hover:shadow-red-500/30 transition-all"
                    >
                        Disconnect
                    </button>
            </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    <div className="bg-white border border-gray-100 p-8 rounded-2xl shadow-sm hover:shadow-lg transition-all">
                        <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Total Assets</p>
                        <h3 className="text-3xl font-black text-[#0F172A] mb-2">
                            {loading ? <Loader className="w-6 h-6 animate-spin inline" /> : totalAssets}
                        </h3>
                        <p className="text-xs text-gray-500">Assets you've created and uploaded</p>
                    </div>
                    <div className="bg-white border border-gray-100 p-8 rounded-2xl shadow-sm hover:shadow-lg transition-all">
                        <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">License Revenue</p>
                        <h3 className="text-3xl font-black text-[#0F172A] mb-2">
                            {loading ? <Loader className="w-6 h-6 animate-spin inline" /> : `${totalRevenue.toFixed(2)} USDC`}
                        </h3>
                        <p className="text-xs text-gray-500">Total earnings from license sales</p>
                    </div>
                    <div className="bg-white border border-gray-100 p-8 rounded-2xl shadow-sm hover:shadow-lg transition-all">
                        <div className="flex items-center gap-2 mb-2">
                            <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Royalty Revenue</p>
                        </div>
                        <h3 className="text-3xl font-black text-[#0F172A] mb-2">
                            {loading ? <Loader className="w-6 h-6 animate-spin inline" /> : `${totalRoyaltyRevenue.toFixed(2)} USDC`}
                        </h3>
                        <p className="text-xs text-gray-500">Earnings from derivative works</p>
                    </div>
                </div>

                {/* Transaction History */}
                <div className="mb-12">
                    <h3 className="text-2xl font-black text-[#0F172A] mb-6">Transaction History</h3>
                    {loading ? (
                        <div className="flex items-center justify-center py-20 bg-white border border-gray-100 rounded-2xl">
                            <Loader className="w-8 h-8 animate-spin text-[#0033FF]" />
                        </div>
                    ) : transactions.length === 0 ? (
                        <div className="text-center py-20 bg-white border border-gray-100 rounded-2xl">
                            <Wallet className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <p className="text-lg font-bold text-gray-500 mb-2">No transactions yet</p>
                            <p className="text-sm text-gray-400">Transactions will appear here when someone purchases your assets or when you purchase licenses</p>
                        </div>
                    ) : (
                        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Asset</th>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Counterparty</th>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Amount</th>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">License</th>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Transaction</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {transactions.map((tx) => (
                                            <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    {tx.type === 'received' ? (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                            Received
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                            Sent
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        {tx.asset.thumbnailUrl ? (
                                                            <Image
                                                                src={getProxyIpfsUrl(tx.asset.thumbnailUrl)}
                                                                alt={tx.asset.title}
                                                                width={40}
                                                                height={40}
                                                                className="w-10 h-10 rounded-lg object-cover"
                                                            />
                                                        ) : (
                                                            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                                                                <ImageIcon className="w-5 h-5 text-gray-400" />
                                                            </div>
                                                        )}
                                                        <div>
                                                            <p className="text-sm font-bold text-[#0F172A]">{tx.asset.title}</p>
                                                            {tx.asset.storyIPId && (
                                                                <a
                                                                    href={`https://https://aeneid.explorer.story.foundation/ipa/${tx.asset.storyIPId}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-xs text-[#0033FF] hover:underline flex items-center gap-1"
                                                                >
                                                                    <Shield className="w-3 h-3" />
                                                                    View IP
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {tx.type === 'received' ? (
                                                        <div>
                                                            <p className="text-xs text-gray-500 mb-1">Buyer:</p>
                                                            <p className="text-sm font-mono text-gray-700" title={tx.buyer.address}>{formatAddress(tx.buyer.address)}</p>
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <p className="text-xs text-gray-500 mb-1">Creator:</p>
                                                            <p className="text-sm font-mono text-gray-700" title={tx.asset.creatorAddress || tx.seller.address}>
                                                                {formatAddress(tx.asset.creatorAddress || tx.seller.address)}
                                                            </p>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className={`text-sm font-bold ${tx.type === 'received' ? 'text-green-600' : 'text-red-600'}`}>
                                                        {tx.type === 'received' ? '+' : '-'}{parseFloat(tx.amount).toFixed(2)} USDC
                                                    </p>
                                                    {tx.type === 'received' && (
                                                        <p className="text-xs text-gray-400 mt-1">You received</p>
                                                    )}
                                                    {tx.type === 'sent' && (
                                                        <p className="text-xs text-gray-400 mt-1">You paid</p>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                                                        {tx.license.type || 'personal'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                                        <Calendar className="w-4 h-4" />
                                                        {formatDate(tx.createdAt)}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <a
                                                        href={`https://sepolia.basescan.org/tx/${tx.transactionHash}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-[#0033FF] hover:underline flex items-center gap-1 text-sm font-medium"
                                                    >
                                                        View
                                                        <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Created Assets Section */}
                <div className="mb-12">
                    <h3 className="text-2xl font-black text-[#0F172A] mb-6">Created Assets</h3>
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader className="w-8 h-8 animate-spin text-[#0033FF]" />
                        </div>
                    ) : createdAssets.length === 0 ? (
                        <div className="text-center py-20 bg-white border border-gray-100 rounded-2xl">
                            <ImageIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <p className="text-lg font-bold text-gray-500 mb-2">No assets created yet</p>
                            <p className="text-sm text-gray-400">Upload your first asset to start monetizing</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {createdAssets.map((asset) => (
                                <div key={asset.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all group cursor-pointer">
                                    <div className="relative aspect-square bg-gray-100 overflow-hidden">
                                        {asset.thumbnail_ipfs_url || asset.thumbnailUrl ? (
                                            <Image
                                                src={getProxyIpfsUrl(asset.thumbnail_ipfs_url || asset.thumbnailUrl || '')}
                                                alt={asset.title}
                                                width={400}
                                                height={400}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <ImageIcon className="w-12 h-12 text-gray-300" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-4">
                                        <h4 className="text-sm font-bold text-[#0F172A] mb-1 truncate">{asset.title}</h4>
                                        <p className="text-xs text-gray-500 font-medium mb-2">
                                            {asset.price ? `${asset.price} ${asset.currency}` : `${Number(asset.price_wei) / 1e6} ${asset.currency}`}
                                        </p>
                                        {asset.story_ip_id && (
                                            <>
                                                <a
                                                    href={`https://aeneid.explorer.story.foundation/ipa/${asset.story_ip_id}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs text-[#0033FF] hover:underline flex items-center gap-1 mb-2"
                                                >
                                                    <Shield className="w-3 h-3" />
                                                    View IP on Story Protocol
                                                </a>
                                                
                                                {/* Royalty Token Section */}
                                                <div className="mt-3 pt-3 border-t border-gray-100">
                                                    {royaltyTokens.has(asset.id) ? (
                                                        <div className="space-y-1">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                                                    Royalty Token
                                                                </span>
                                                                <span className="text-xs font-bold text-[#0033FF]">
                                                                    {royaltyTokens.get(asset.id)?.tokenSymbol || 'RRT'}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs text-gray-500">Revenue:</span>
                                                                <span className="text-xs font-bold text-green-600">
                                                                    {(parseFloat(royaltyTokens.get(asset.id)?.totalRevenue || '0') / 1e6).toFixed(2)} USDC
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs text-gray-500">Holders:</span>
                                                                <span className="text-xs font-medium text-gray-700">
                                                                    {royaltyTokens.get(asset.id)?.holdersCount || 0}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                if (royaltyLoading.get(asset.id)) return;
                                                                
                                                                setRoyaltyLoading(prev => new Map(prev).set(asset.id, true));
                                                                try {
                                                                    const token = await createRoyaltyToken(asset.id);
                                                                    setRoyaltyTokens(prev => new Map(prev).set(asset.id, token));
                                                                    setTotalRoyaltyRevenue(prev => prev + parseFloat(token.totalRevenue || '0') / 1e6);
                                                                } catch (error: any) {
                                                                    console.error('Failed to create royalty token:', error);
                                                                    alert(error.message || 'Failed to create royalty token');
                                                                } finally {
                                                                    setRoyaltyLoading(prev => {
                                                                        const newMap = new Map(prev);
                                                                        newMap.delete(asset.id);
                                                                        return newMap;
                                                                    });
                                                                }
                                                            }}
                                                            disabled={royaltyLoading.get(asset.id)}
                                                            className="w-full text-xs px-3 py-1.5 bg-[#0033FF] text-white font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                                                        >
                                                            {royaltyLoading.get(asset.id) ? (
                                                                <>
                                                                    <Loader className="w-3 h-3 animate-spin" />
                                                                    Creating...
                                                                </>
                                                            ) : (
                                                                <>
                                                                    Create Royalty Token
                                                                </>
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                        {asset.ipfs_cid && (
                                            <p className="text-xs text-gray-400 font-mono mt-1 truncate" title={asset.ipfs_cid}>
                                                CID: {asset.ipfs_cid.substring(0, 12)}...
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Purchased Licenses Section - DISABLED */}
                {/* <div className="mb-12">
                    <h3 className="text-2xl font-black text-[#0F172A] mb-6">Purchased Licenses</h3>
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader className="w-8 h-8 animate-spin text-[#0033FF]" />
                        </div>
                    ) : purchasedAssets.length === 0 ? (
                        <div className="text-center py-20 bg-white border border-gray-100 rounded-2xl">
                            <ImageIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <p className="text-lg font-bold text-gray-500 mb-2">No licenses purchased yet</p>
                            <p className="text-sm text-gray-400">Purchase licenses to access premium content</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {purchasedAssets.map((purchase) => (
                                <div key={purchase.purchaseId} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all">
                                    <div className="relative aspect-square bg-gray-100 overflow-hidden">
                                        {purchase.asset.thumbnailUrl ? (
                                            <Image
                                                src={getProxyIpfsUrl(purchase.asset.thumbnailUrl)}
                                                alt={purchase.asset.title}
                                                width={400}
                                                height={400}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <ImageIcon className="w-12 h-12 text-gray-300" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-4">
                                        <h4 className="text-sm font-bold text-[#0F172A] mb-2 truncate">{purchase.asset.title}</h4>
                                        <div className="space-y-2 text-xs mb-3">
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">License:</span>
                                                <span className="font-medium text-[#0033FF] capitalize">{purchase.license.type}</span>
                                            </div>
                                            {purchase.license.storyLicenseId && (
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">License ID:</span>
                                                    <span className="font-mono text-gray-600 text-[10px]">
                                                        {purchase.license.storyLicenseId.substring(0, 8)}...
                                                    </span>
                                                </div>
                                            )}
                                            {purchase.transaction.hash && (
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">TX:</span>
                                                    <a
                                                        href={`https://sepolia.basescan.org/tx/${purchase.transaction.hash}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="font-mono text-[#0033FF] hover:underline text-[10px]"
                                                    >
                                                        {purchase.transaction.hash.substring(0, 8)}...
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                        {purchase.asset.storyIPId && (
                                            <div className="mb-3 pt-2 border-t border-gray-100">
                                                <a
                                                    href={`https://https://aeneid.explorer.story.foundation/ipa/${purchase.asset.storyIPId}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[#0033FF] font-bold text-xs hover:underline flex items-center gap-1"
                                                >
                                                    <Shield className="w-3 h-3" />
                                                    View License Onchain
                                                </a>
                                            </div>
                                        )}
                                        <button
                                            onClick={async () => {
                                                if (!purchase.accessToken || !wallets[0]?.address) {
                                                    console.error('Access token or wallet not available');
                                                    return;
                                                }

                                                try {
                                                    // Use downloadAsset function for secure download
                                                    const { downloadAsset } = await import('@/lib/api-client');
                                                    const downloadInfo = await downloadAsset(
                                                        purchase.asset.id,
                                                        wallets[0].address,
                                                        purchase.accessToken
                                                    );

                                                    // Fetch the file as a blob
                                                    const response = await fetch(getProxyIpfsUrl(downloadInfo.downloadUrl || purchase.asset.ipfsUrl), {
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
                                                    const fileExt = downloadInfo.fileType?.split('/')[1] || purchase.asset.fileType?.split('/')[1] || 'jpg';
                                                    link.download = downloadInfo.fileName || `${purchase.asset.title || 'asset'}.${fileExt}`;
                                                    document.body.appendChild(link);
                                                    link.click();
                                                    
                                                    // Cleanup
                                                    document.body.removeChild(link);
                                                    window.URL.revokeObjectURL(url);
                                                } catch (err: any) {
                                                    console.error('Download error:', err);
                                                    // Fallback to opening in new tab if download fails
                                                    window.open(getProxyIpfsUrl(purchase.asset.ipfsUrl), '_blank');
                                                }
                                            }}
                                            className="w-full mt-3 px-4 py-2 bg-[#0033FF] text-white font-bold rounded-lg hover:bg-blue-700 transition-colors text-xs flex items-center justify-center gap-2"
                                        >
                                            <Download className="w-3 h-3" />
                                            Download
                                        </button>
                                    </div>
                            </div>
                        ))}
                    </div>
                    )}
                </div> */}
            </div>
        </div>
    );
};

export default Dashboard;
