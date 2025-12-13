export interface PriceTier {
    tier: 'preview' | 'personal' | 'commercial';
    label: string;
    price: number;
    currency: string;
    features: string[];
  }
  
  export interface Creator {
    id: string;
    name: string;
    avatar: string;
    wallet: string;
    bio?: string;
    totalEarnings?: number;
  }
  
  export interface Asset {
    id: string;
    title: string;
    creator: Creator;
    imageUrl: string; 
    previewUrl?: string; 
    fullQualityUrl?: string; 
    width: number;
    height: number;
    mimeType: string;
    cid: string;
    ipId: string;
    story_ip_id?: string; 
    fingerprint: string;
    hash: string;
    authScore: number; 
    tags: string[];
    likes: number;
    views: number;
    priceTiers: PriceTier[];
    createdAt: string;
  }
  
  export type ViewState = 'home' | 'gallery' | 'upload' | 'dashboard' | 'wallet';
  
  export interface NavProps {
    currentView: ViewState;
    onChangeView: (view: ViewState) => void;
    walletConnected: boolean;
    onConnectWallet: () => void;
  }
  