import dotenv from 'dotenv';

dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  ethereum: {
    rpcUrl: process.env.ETHEREUM_RPC_URL || '',
    network: process.env.ETHEREUM_NETWORK || 'sepolia',
    usdcTokenAddress: process.env.USDC_TOKEN_ADDRESS || '',
    privateKey: process.env.PRIVATE_KEY || '',
  },
  storyProtocol: {
    rpcUrl: process.env.STORY_PROTOCOL_RPC_URL || process.env.ETHEREUM_RPC_URL || '',
    moduleAddress: process.env.STORY_PROTOCOL_MODULE_ADDRESS || '',
    registryAddress: process.env.STORY_PROTOCOL_REGISTRY_ADDRESS || '',
    licenseRegistryAddress: process.env.STORY_PROTOCOL_LICENSE_REGISTRY_ADDRESS || '',
  },
  ipfs: {
    web3StorageToken: process.env.WEB3_STORAGE_TOKEN || '',
  },
  xmtp: {
    env: (process.env.XMTP_ENV || 'dev') as 'dev' | 'production',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-in-production',
  },
  database: {
    url: process.env.DATABASE_URL || '',
  },
};

// Validate required config
if (!config.ethereum.rpcUrl) {
  throw new Error('ETHEREUM_RPC_URL is required');
}

if (!config.database.url) {
  throw new Error('DATABASE_URL is required');
}

