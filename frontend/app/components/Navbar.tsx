'use client';
import React, { useState } from 'react';
import { Search, Menu, X, Bell, Wallet } from 'lucide-react';
import { NavProps } from '../types';
import Image from 'next/image';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useRouter, usePathname } from 'next/navigation';

export const TopNav: React.FC<Omit<NavProps, 'walletConnected' | 'onConnectWallet'>> = ({ currentView, onChangeView }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();
  const router = useRouter();
  const pathname = usePathname();
  
  const walletConnected = authenticated;
  const walletAddress = wallets[0]?.address;

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200 px-6 py-4 flex items-center justify-between transition-all duration-300">
      
        {/* Left: Branding */}
        <div className="flex items-center gap-10">
          {/* Custom Drop Logo - Hollow Drop (Border Only) + Filled Inner Circle */}
          <div 
            className="cursor-pointer group flex items-center gap-3" 
            onClick={() => router.push('/')}
          >
            <div className="relative w-8 h-8 flex items-center justify-center transition-transform duration-300 ">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Outline Water Drop - Black Border */}
                    <path 
                        d="M12 2C12 2 4.5 11 4.5 16C4.5 20.1421 7.85786 23.5 12 23.5C16.1421 23.5 19.5 20.1421 19.5 16C19.5 11 12 2 12 2Z" 
                        stroke="#0F172A" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                        fill="none" 
                    />
                    {/* Solid Inner Circle - Electric Blue */}
                    <circle cx="12" cy="16" r="3" fill="#000000"/>
                </svg>
            </div>
            <span className="text-2xl font-black tracking-tight hidden md:block text-[#0F172A]">DROP</span>
        </div>

        {/* Desktop Nav Links */}
        <div className="hidden md:flex items-center gap-8">
            <button 
                onClick={() => router.push('/')}
                className={`text-sm font-bold uppercase tracking-wider transition-all duration-200 relative ${
                    pathname === '/' 
                    ? 'text-[#0033FF]' 
                    : 'text-gray-500 hover:text-[#0F172A]'
                }`}
            >
                Home
                {pathname === '/' && <span className="absolute -bottom-6 left-0 w-full h-0.5 bg-[#0033FF]"></span>}
            </button>
            <button 
                onClick={() => router.push('/dashboard')}
                className={`text-sm font-bold uppercase tracking-wider transition-all duration-200 relative ${
                    pathname === '/dashboard' 
                    ? 'text-[#0033FF]' 
                    : 'text-gray-500 hover:text-[#0F172A]'
                }`}
            >
                Dashboard
                {pathname === '/dashboard' && <span className="absolute -bottom-6 left-0 w-full h-0.5 bg-[#0033FF]"></span>}
            </button>
            <button 
                onClick={() => router.push('/upload-flow')}
                className={`text-sm font-bold uppercase tracking-wider transition-all duration-200 relative ${
                    pathname === '/upload-flow' 
                    ? 'text-[#0033FF]' 
                    : 'text-gray-500 hover:text-[#0F172A]'
                }`}
            >
                Create
                {pathname === '/upload-flow' && <span className="absolute -bottom-6 left-0 w-full h-0.5 bg-[#0033FF]"></span>}
            </button>
        </div>
      </div>

      {/* Center: Search Bar (Clean Light Style) */}
      <div className="flex-1 px-12 max-w-[600px] hidden lg:block">
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400 group-focus-within:text-[#0033FF] transition-colors" />
          </div>
          <input
            type="text"
            className="block w-full pl-11 pr-4 py-2.5 rounded-lg bg-gray-100 border border-transparent text-gray-900 placeholder-gray-500 focus:outline-none focus:bg-white focus:border-gray-300 focus:ring-4 focus:ring-gray-100 transition-all text-sm font-medium"
            placeholder="Search assets, IP, or creators..."
          />
          <div className="absolute inset-y-0 right-3 flex items-center">
             <span className="text-[10px] font-bold text-gray-400 bg-white px-2 py-1 rounded border border-gray-200 shadow-sm">⌘ K</span>
          </div>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-6">
        {/* Notifications */}
        <button className="hidden sm:flex p-2 relative text-gray-400 hover:text-[#0F172A] transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-[#0033FF] rounded-full border border-white"></span>
        </button>

        {/* Wallet / Profile */}
        {!walletConnected ? (
             <button
                onClick={login}
                className="bg-[#0F172A] hover:bg-[#0033FF] text-white px-6 py-2.5 rounded-lg text-sm font-bold tracking-wide transition-all duration-300 flex items-center shadow-lg hover:shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <Wallet className="w-4 h-4 mr-2" />
                Connect Wallet
            </button>
        ) : (
            <div className="flex items-center pl-6 border-l border-gray-200">
                 <button 
                    onClick={() => router.push('/dashboard')}
                    className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                 >
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-bold text-[#0F172A] leading-none">
                            {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Wallet'}
                        </p>
                        {/* <p className="text-[11px] text-[#0033FF] font-bold mt-1">EVM Wallet</p> */}
                    </div>
                    {/* <div className="w-10 h-10 rounded-full bg-gray-100 p-0.5 border border-gray-200">
                        <Image 
                            src={walletAddress ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${walletAddress}` : '/avatar.png'} 
                            alt={walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Profile'} 
                            width={40} 
                            height={40} 
                            className="w-full h-full object-cover rounded-full" 
                        />
                    </div> */}
                 </button>
            </div>
        )}

         {/* Mobile Menu Toggle */}
         <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-[#0F172A]"
         >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
         </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="absolute top-[73px] left-0 right-0 bg-white border-b border-gray-200 md:hidden flex flex-col p-6 animate-in slide-in-from-top-2 shadow-xl">
            <button onClick={() => { router.push('/'); setIsMobileMenuOpen(false); }} className="text-left py-3 font-bold text-lg text-[#0F172A]">Home</button>
            <button onClick={() => { router.push('/dashboard'); setIsMobileMenuOpen(false); }} className="text-left py-3 font-bold text-lg text-[#0F172A]">Dashboard</button>
            <button onClick={() => { router.push('/upload-flow'); setIsMobileMenuOpen(false); }} className="text-left py-3 font-bold text-lg text-[#0F172A]">Create</button>
        </div>
      )}
    </nav>
  );
};