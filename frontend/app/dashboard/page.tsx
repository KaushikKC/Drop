import React from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Wallet, Activity, Users, ArrowUpRight } from 'lucide-react';

const data = [
  { name: 'M', value: 2.4 },
  { name: 'T', value: 1.8 },
  { name: 'W', value: 3.6 },
  { name: 'T', value: 2.2 },
  { name: 'F', value: 4.8 },
  { name: 'S', value: 3.1 },
  { name: 'S', value: 2.5 },
];

export const Dashboard: React.FC = () => {
    return (
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
                </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
                {[
                    { label: 'Revenue', val: '42.5 SOL', icon: Wallet, change: '+12.5%', color: 'text-[#0033FF]' },
                    { label: 'Licenses', val: '1,203', icon: Activity, change: '+3.2%', color: 'text-purple-600' },
                    { label: 'Holders', val: '892', icon: Users, change: '+8.1%', color: 'text-orange-500' },
                    { label: 'Avg Price', val: '0.45 SOL', icon: ArrowUpRight, change: '+1.5%', color: 'text-green-600' },
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

                {/* Activity Feed */}
                <div className="bg-white border border-gray-100 p-8 rounded-2xl shadow-sm flex flex-col">
                    <h3 className="text-lg font-bold text-[#0F172A] mb-6">Recent Activity</h3>
                    <div className="space-y-2 flex-1 overflow-y-auto pr-2">
                        {[1,2,3,4,5,6].map((i) => (
                            <div key={i} className="flex items-center justify-between py-3 px-3 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer group">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-blue-50 text-[#0033FF] rounded-full flex items-center justify-center font-bold text-xs group-hover:bg-[#0033FF] group-hover:text-white transition-colors">IP</div>
                                    <div>
                                        <p className="text-sm font-bold text-[#0F172A]">New License</p>
                                        <p className="text-xs text-gray-400 font-medium">0x71...9A2</p>
                                    </div>
                                </div>
                                <span className="text-[#0033FF] text-sm font-bold bg-blue-50 px-2 py-1 rounded group-hover:bg-white transition-colors">+0.5 SOL</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};