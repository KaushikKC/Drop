'use client';
import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Wallet, Activity, Users, ArrowUpRight, Loader, Image as ImageIcon } from 'lucide-react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { getCreatorDashboard } from '@/lib/api-client';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { TopNav } from '../components/Navbar';
import { getProxyIpfsUrl } from '@/lib/ipfs-utils';

const data = [
  { name: 'M', value: 2.4 },
  { name: 'T', value: 1.8 },
  { name: 'W', value: 3.6 },
  { name: 'T', value: 2.2 },
  { name: 'F', value: 4.8 },
  { name: 'S', value: 3.1 },
  { name: 'S', value: 2.5 },
];

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
    created_at?: string;
    createdAt?: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ onDisconnect }) => {
    const { logout } = usePrivy();
    const { wallets } = useWallets();
    const router = useRouter();
    const [assets, setAssets] = useState<Asset[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<any>({});
    const [earnings, setEarnings] = useState<any>({});

    useEffect(() => {
        const fetchDashboard = async () => {
            if (!wallets[0]?.address) return;
            
            setLoading(true);
            try {
                const data = await getCreatorDashboard(wallets[0].address);
                setAssets(data.assets || []);
                setStats(data.stats || {});
                setEarnings(data.earnings || {});
            } catch (error) {
                console.error('Failed to fetch dashboard:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboard();
    }, [wallets]);

    const handleDisconnect = async () => {
        try {
            await logout();
            // Call optional callback to handle view change in parent
            if (onDisconnect) {
                onDisconnect();
            } else {
                router.push('/');
            }
        } catch (error) {
            console.error('Error disconnecting wallet:', error);
        }
    };

    return (
        <div className="min-h-screen bg-[#F9FAFB]">
            <TopNav currentView="dashboard" onChangeView={() => {}} />
            <div className="max-w-[1600px] mx-auto px-6 py-12">
            <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
                <div>
                    <h1 className="text-4xl font-black text-[#0F172A] tracking-tight mb-2">DASHBOARD</h1>
                    <p className="text-gray-500 font-medium text-sm">Overview of your registered IP and revenue.</p>
                </div>
                <div className="flex gap-4">
                    <button className="px-6 py-3 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:text-black hover:shadow-md transition-all">
                        Export Report
                    </button>
                    <button className="px-6 py-3 bg-[#0F172A] text-white font-bold rounded-lg text-sm hover:bg-[#0033FF] shadow-lg hover:shadow-blue-500/30 transition-all">
                        Withdraw 42.5 SOL
                    </button>
                    <button 
                        onClick={handleDisconnect}
                        className="px-6 py-3 bg-red-500 text-white font-bold rounded-lg text-sm hover:bg-red-600 shadow-lg hover:shadow-red-500/30 transition-all"
                    >
                        Disconnect
                    </button>
                </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
                {[
                    { 
                        label: 'Revenue', 
                        val: earnings.summary ? `${(Number(earnings.summary.total_earnings_wei || 0) / 1e6).toFixed(2)} USDC` : '0 USDC', 
                        icon: Wallet, 
                        change: '+12.5%', 
                        color: 'text-[#0033FF]' 
                    },
                    { 
                        label: 'Licenses', 
                        val: stats.licenses_minted || '0', 
                        icon: Activity, 
                        change: '+3.2%', 
                        color: 'text-purple-600' 
                    },
                    { 
                        label: 'Total Assets', 
                        val: stats.total_assets || '0', 
                        icon: Users, 
                        change: '+8.1%', 
                        color: 'text-orange-500' 
                    },
                    { 
                        label: 'Total Sales', 
                        val: stats.total_sales || '0', 
                        icon: ArrowUpRight, 
                        change: '+1.5%', 
                        color: 'text-green-600' 
                    },
                ].map((stat, i) => (
                    <div key={i} className="bg-white border border-gray-100 p-8 rounded-2xl shadow-sm hover:shadow-lg transition-all relative overflow-hidden group">
                        <div className={`absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity ${stat.color}`}>
                            <stat.icon className="w-12 h-12" />
                        </div>
                        <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">{stat.label}</p>
                        <h3 className="text-3xl font-black text-[#0F172A] mb-2">{stat.val}</h3>
                        <span className={`text-xs font-bold ${stat.color} bg-gray-50 px-2 py-1 rounded`}>{stat.change}</span>
                    </div>
                ))}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Chart */}
                <div className="lg:col-span-2 bg-white border border-gray-100 p-8 rounded-2xl shadow-sm">
                    <h3 className="text-lg font-bold text-[#0F172A] mb-8">Revenue Analytics</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data}>
                                <XAxis 
                                    dataKey="name" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{fill: '#94A3B8', fontSize: 12, fontWeight: 600}} 
                                    dy={10}
                                />
                                <Tooltip 
                                    cursor={{fill: '#F3F4F6'}}
                                    contentStyle={{ background: '#fff', border: 'none', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar 
                                    dataKey="value" 
                                    fill="#0F172A" 
                                    radius={[4, 4, 0, 0]} 
                                    barSize={40}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* My Assets */}
                <div className="bg-white border border-gray-100 p-8 rounded-2xl shadow-sm flex flex-col">
                    <h3 className="text-lg font-bold text-[#0F172A] mb-6">My Assets</h3>
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader className="w-6 h-6 animate-spin text-[#0033FF]" />
                        </div>
                    ) : assets.length === 0 ? (
                        <div className="text-center py-8">
                            <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-sm text-gray-500 font-medium">No assets uploaded yet</p>
                            <p className="text-xs text-gray-400 mt-1">Upload your first asset to get started</p>
                        </div>
                    ) : (
                    <div className="space-y-2 flex-1 overflow-y-auto pr-2">
                            {assets.slice(0, 6).map((asset) => (
                                <div key={asset.id} className="flex items-center gap-4 py-3 px-3 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer group">
                                    <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                                        {asset.thumbnail_ipfs_url || asset.thumbnailUrl ? (
                                            <Image
                                                src={getProxyIpfsUrl(asset.thumbnail_ipfs_url || asset.thumbnailUrl || '')}
                                                alt={asset.title}
                                                width={64}
                                                height={64}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <ImageIcon className="w-6 h-6 text-gray-400" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-[#0F172A] truncate">{asset.title}</p>
                                        <p className="text-xs text-gray-400 font-medium">
                                            {asset.price ? `${asset.price} ${asset.currency}` : `${Number(asset.price_wei) / 1e6} ${asset.currency}`}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Assets Grid */}
            <div className="mt-8">
                <h3 className="text-2xl font-black text-[#0F172A] mb-6">All Assets</h3>
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader className="w-8 h-8 animate-spin text-[#0033FF]" />
                    </div>
                ) : assets.length === 0 ? (
                    <div className="text-center py-20 bg-white border border-gray-100 rounded-2xl">
                        <ImageIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-lg font-bold text-gray-500 mb-2">No assets yet</p>
                        <p className="text-sm text-gray-400">Upload your first asset to start monetizing</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {assets.map((asset) => (
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
                                    <p className="text-xs text-gray-500 font-medium">
                                        {asset.price ? `${asset.price} ${asset.currency}` : `${Number(asset.price_wei) / 1e6} ${asset.currency}`}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            </div>
        </div>
    );
};

export default Dashboard;