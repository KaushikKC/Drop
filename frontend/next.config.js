/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    // Exclude Solana modules from bundling
    config.resolve.alias = {
      ...config.resolve.alias,
      '@solana-program/system': false,
      '@solana/web3.js': false,
      '@solana/spl-token': false,
      '@solana/wallet-adapter-base': false,
      '@solana/wallet-adapter-react': false,
    };
    
    // Ignore Solana-related modules
    config.resolve.fallback = {
      ...config.resolve.fallback,
      '@solana-program/system': false,
      '@solana/web3.js': false,
      '@solana/spl-token': false,
    };
    
    return config;
  },
}

module.exports = nextConfig

