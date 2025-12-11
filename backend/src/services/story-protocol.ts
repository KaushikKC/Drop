import { StoryClient, StoryConfig, PILFlavor, WIP_TOKEN_ADDRESS } from '@story-protocol/core-sdk';
import { http, formatEther, createPublicClient, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { createHash } from 'crypto';
import { config } from '../config';
import pino from 'pino';
import { uploadToIPFS } from './ipfs';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// Story Protocol SDK Client
let storyClient: StoryClient | null = null;

function getStoryClient(): StoryClient {
  if (storyClient) {
    return storyClient;
  }

  if (!config.ethereum.privateKey) {
    throw new Error('PRIVATE_KEY is required for Story Protocol operations');
  }

  const account = privateKeyToAccount(`0x${config.ethereum.privateKey.replace('0x', '')}` as `0x${string}`);
  const rpcUrl = config.storyProtocol.rpcUrl || config.ethereum.rpcUrl;
  
  if (!rpcUrl) {
    throw new Error('STORY_PROTOCOL_RPC_URL or ETHEREUM_RPC_URL is required');
  }

  // Story Protocol uses its own testnet called "aeneid"
  // Supported chain IDs: "aeneid" (testnet), "sonic" (mainnet)
  const chainId = config.storyProtocol.chainId || 'aeneid';
  
  if (!chainId) {
    throw new Error('STORY_PROTOCOL_CHAIN_ID is required. Use "aeneid" for testnet or "sonic" for mainnet');
  }

  logger.info('Initializing Story Protocol client', { chainId, rpcUrl });

  const storyConfig: StoryConfig = {
    account: account,
    transport: http(rpcUrl),
    chainId: chainId as any, // Story Protocol SDK expects specific chain IDs
  };

  storyClient = StoryClient.newClient(storyConfig);
  return storyClient;
}

export interface StoryIPRegistration {
  ipId: string;
  txHash: string;
  blockNumber: number;
}

export interface StoryLicense {
  licenseId: string;
  tokenId: string;
  ipId: string;
  licensee: string;
  licenseType: string;
  txHash: string;
}

export class StoryProtocolService {
  // Story Protocol SDK client is initialized via getStoryClient()

  /**
   * Register an IP asset on Story Protocol
   */
  /**
   * Check wallet balance before registration
   */
  async checkBalance(): Promise<{ balance: bigint; balanceFormatted: string; hasFunds: boolean; address: string }> {
    try {
      const account = privateKeyToAccount(`0x${config.ethereum.privateKey.replace('0x', '')}` as `0x${string}`);
      const rpcUrl = config.storyProtocol.rpcUrl || config.ethereum.rpcUrl;
      
      if (!rpcUrl) {
        throw new Error('STORY_PROTOCOL_RPC_URL is required');
      }

      // Create a public client to check balance
      const publicClient = createPublicClient({
        transport: http(rpcUrl),
      });

      const balance = await publicClient.getBalance({ address: account.address });
      const balanceFormatted = formatEther(balance);
      const hasFunds = balance > BigInt(0);

      logger.info('Wallet balance check', {
        address: account.address,
        balance: balanceFormatted,
        hasFunds,
      });

      return { balance, balanceFormatted, hasFunds, address: account.address };
    } catch (error: any) {
      logger.error('Failed to check balance:', error);
      throw new Error(`Failed to check wallet balance: ${error.message || error}`);
    }
  }

  async registerIP(
    ipMetadata: {
      name: string;
      description?: string;
      mediaUrl: string;
      thumbnailUrl?: string;
      mediaType?: string;
      creatorAddress?: string;
      fingerprint?: string;
    }
  ): Promise<StoryIPRegistration> {
    try {
      logger.info('Registering IP on Story Protocol', { name: ipMetadata.name });

      // Check balance before attempting registration
      const account = privateKeyToAccount(`0x${config.ethereum.privateKey.replace('0x', '')}` as `0x${string}`);
      logger.info('Checking wallet balance before registration', { address: account.address });
      
      try {
        const balanceCheck = await this.checkBalance();
        console.log(`💰 Wallet balance: ${balanceCheck.balanceFormatted} tokens`);
        console.log(`📍 Wallet address: ${balanceCheck.address}`);
        
        if (!balanceCheck.hasFunds) {
          const errorMsg = `Insufficient funds on Aeneid testnet. Wallet ${account.address} has 0 balance. Please get testnet tokens from a faucet.`;
          logger.error(errorMsg);
          throw new Error(errorMsg);
        }
        logger.info(`Wallet has sufficient balance: ${balanceCheck.balanceFormatted} tokens`);
      } catch (balanceError: any) {
        // If balance check fails, log warning but continue (might be RPC issue)
        logger.warn('Balance check failed, proceeding anyway:', balanceError.message);
        console.warn('⚠️  Could not check balance, proceeding with registration attempt...');
      }

      const client = getStoryClient();

      // 1. Create IP Metadata (IPA Metadata Standard)
      const ipMetadataObj = {
        title: ipMetadata.name,
        description: ipMetadata.description || '',
        image: ipMetadata.thumbnailUrl || ipMetadata.mediaUrl,
        imageHash: ipMetadata.thumbnailUrl 
          ? createHash('sha256').update(ipMetadata.thumbnailUrl).digest('hex')
          : '0x0',
        mediaUrl: ipMetadata.mediaUrl,
        mediaHash: createHash('sha256').update(ipMetadata.mediaUrl).digest('hex'),
        mediaType: ipMetadata.mediaType || 'image/jpeg',
        creators: ipMetadata.creatorAddress ? [
          {
            address: ipMetadata.creatorAddress,
            share: 100,
          }
        ] : [],
        fingerprint: ipMetadata.fingerprint || '',
      };

      // 2. Create NFT Metadata (ERC-721 Standard)
      const nftMetadata = {
        name: `IP Asset: ${ipMetadata.name}`,
        description: `NFT representing ownership of ${ipMetadata.name} on Story Protocol`,
        image: ipMetadata.thumbnailUrl || ipMetadata.mediaUrl,
      };

      // 3. Upload metadata to IPFS
      const { uploadJSONToIPFS } = await import('./ipfs');
      const ipIpfsResult = await uploadJSONToIPFS(ipMetadataObj, `ip-metadata-${Date.now()}.json`);
      const nftIpfsResult = await uploadJSONToIPFS(nftMetadata, `nft-metadata-${Date.now()}.json`);

      const ipIpfsHash = ipIpfsResult.cid;
      const nftIpfsHash = nftIpfsResult.cid;

      // 4. Generate metadata hashes
      const ipHash = createHash('sha256')
        .update(JSON.stringify(ipMetadataObj))
        .digest('hex');
      const nftHash = createHash('sha256')
        .update(JSON.stringify(nftMetadata))
        .digest('hex');

      // 5. Get SPG NFT Contract (from environment or use default)
      const spgNftContract = process.env.STORY_PROTOCOL_SPG_NFT_CONTRACT || 
        '0xc32A8a0FF3beDDDa58393d022aF433e78739FAbc'; // Default Aeneid contract

      // 6. Register IP Asset with Story Protocol
      const response = await client.ipAsset.registerIpAsset({
        nft: {
          type: 'mint',
          spgNftContract: spgNftContract as `0x${string}`,
        },
        licenseTermsData: [
          {
            terms: PILFlavor.commercialRemix({
              commercialRevShare: 10, // 10% revenue share (value between 0-100, where 10 = 10%)
              defaultMintingFee: parseEther('0'), // No minting fee (use parseEther for proper formatting)
              currency: WIP_TOKEN_ADDRESS as `0x${string}`,
            }),
          },
        ],
        ipMetadata: {
          ipMetadataURI: `https://ipfs.io/ipfs/${ipIpfsHash}`,
          ipMetadataHash: `0x${ipHash}`,
          nftMetadataURI: `https://ipfs.io/ipfs/${nftIpfsHash}`,
          nftMetadataHash: `0x${nftHash}`,
        },
      });

      logger.info('IP Asset registered successfully', {
        ipId: response.ipId,
        txHash: response.txHash,
        tokenId: response.tokenId,
      });

      return {
        ipId: response.ipId || '',
        txHash: response.txHash || '',
        blockNumber: 0, // Story Protocol SDK doesn't return block number directly
      };
    } catch (error: any) {
      const account = privateKeyToAccount(`0x${config.ethereum.privateKey.replace('0x', '')}` as `0x${string}`);
      
      logger.error('Story Protocol registration failed:', {
        error: error.message || String(error),
        walletAddress: account.address,
      });

      // Provide helpful error messages
      let errorMessage = `Failed to register IP asset: ${error.message || error}`;
      
      if (error.message?.includes('insufficient funds') || error.message?.includes('exceeds the balance')) {
        errorMessage = `Insufficient funds on Aeneid testnet. Wallet ${account.address} needs testnet tokens to pay for gas. ` +
          `Get testnet tokens from: ` +
          `1. Story Foundation Faucet (requires Gitcoin Passport score 5+) ` +
          `2. QuickNode Faucet (requires 0.001 ETH on mainnet) ` +
          `3. FaucetMe Pro (requires Discord connection)`;
      } else if (error.message?.includes('ChainId')) {
        errorMessage = `Chain ID error. Make sure STORY_PROTOCOL_CHAIN_ID=aeneid is set in .env file.`;
      } else if (error.message?.includes('RPC') || error.message?.includes('connection')) {
        errorMessage = `RPC connection failed. Check STORY_PROTOCOL_RPC_URL in .env file.`;
      }

      throw new Error(errorMessage);
    }
  }

  /**
   * Mint a license NFT for a buyer
   */
  async mintLicense(params: {
    ipId: string;
    licensee: string;
    licenseType: 'personal' | 'commercial' | 'derivative';
    terms?: string;
  }): Promise<StoryLicense> {
    // TODO: Integrate with actual Story Protocol SDK
    // This is a placeholder that should be replaced with:
    // const storySDK = new StorySDK(...);
    // const result = await storySDK.license.mint(...);

    logger.info('Minting license on Story Protocol', params);

    // Placeholder implementation
    const mockLicenseId = `0x${Buffer.from(
      `${params.ipId}-${params.licensee}-${Date.now()}`
    ).toString('hex').slice(0, 40)}`;

    const mockTokenId = Math.floor(Math.random() * 1000000).toString();

    return {
      licenseId: mockLicenseId,
      tokenId: mockTokenId,
      ipId: params.ipId,
      licensee: params.licensee,
      licenseType: params.licenseType,
      txHash: '0x' + '0'.repeat(64), // Placeholder
    };
  }

  /**
   * Register a derived work and link it to parent IP
   */
  async registerDerivative(params: {
    parentIPId: string;
    derivedIPId: string;
    derivationType: string;
    revenueSplit?: number; // Percentage to parent (0-100)
  }): Promise<{
    derivativeIPId: string;
    licenseId: string;
    txHash: string;
  }> {
    // TODO: Integrate with actual Story Protocol SDK
    logger.info('Registering derivative work on Story Protocol', params);

    // Placeholder implementation
    return {
      derivativeIPId: params.derivedIPId,
      licenseId: `0x${Buffer.from(
        `${params.parentIPId}-${params.derivedIPId}-${Date.now()}`
      ).toString('hex').slice(0, 40)}`,
      txHash: '0x' + '0'.repeat(64), // Placeholder
    };
  }
}

export const storyProtocolService = new StoryProtocolService();

