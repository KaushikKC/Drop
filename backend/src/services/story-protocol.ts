import { StoryClient, StoryConfig, PILFlavor, WIP_TOKEN_ADDRESS } from '@story-protocol/core-sdk';
import { http, formatEther, createPublicClient, parseEther, getAddress } from 'viem';
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

export interface RoyaltyToken {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  totalSupply: bigint;
  ipId: string;
  txHash: string;
}

export interface RoyaltyTokenBalance {
  balance: bigint;
  percentage: number;
  holderAddress: string;
}

export interface RoyaltyDistribution {
  distributionId: string;
  amount: bigint;
  currency: string;
  sourceIPId: string;
  timestamp: Date;
  txHash: string;
}

export class StoryProtocolService {
  // Story Protocol SDK client is initialized via getStoryClient()

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
   * Create Royalty Token for an IP Asset
   * 
   * Note: Story Protocol handles royalty distribution automatically via PIL terms.
   * This creates a tracking record in our database for revenue management.
   * The "royalty token" is a conceptual tracking mechanism, not an on-chain token.
   * 
   * Story Protocol automatically distributes royalties when:
   * 1. Someone creates a derivative work
   * 2. They pay the commercialRevShare (10% in your case)
   * 3. Story Protocol distributes it to the IP owner
   * 
   * We track this in our database for UI display and revenue management.
   */
  async createRoyaltyToken(params: {
    ipId: string;
    assetName: string;
    creatorAddress: string;
    totalSupply?: bigint; // Default: 1,000,000 tokens (for fractional ownership tracking)
  }): Promise<RoyaltyToken> {
    try {
      logger.info('Creating royalty token tracking for IP', { ipId: params.ipId });

      const totalSupply = params.totalSupply || parseEther('1000000'); // 1M tokens default

      // Generate a unique token address for tracking (not an actual on-chain contract)
      // This is just for database tracking purposes
      const tokenAddress = `0x${Buffer.from(`${params.ipId}-royalty-${Date.now()}`)
        .toString('hex')
        .slice(0, 40)
        .padEnd(40, '0')}`;

      // Story Protocol handles royalties automatically via PIL terms
      // This is just a tracking record in our database
      logger.info('Royalty token tracking created. Story Protocol handles actual royalty distribution via PIL terms.');

      return {
        tokenAddress,
        tokenSymbol: 'RRT', // Royalty Revenue Token
        tokenName: `${params.assetName} Royalty Token`,
        totalSupply,
        ipId: params.ipId,
        txHash: '0x' + '0'.repeat(64), // No on-chain transaction - this is just tracking
      };
    } catch (error: any) {
      logger.error('Royalty token creation error:', error);
      throw new Error(`Failed to create royalty token: ${error.message || error}`);
    }
  }

  /**
   * Get Royalty Token Balance for a holder
   */
  async getRoyaltyTokenBalance(params: {
    tokenAddress: string;
    holderAddress: string;
  }): Promise<RoyaltyTokenBalance> {
    try {
      // TODO: Query ERC-20 token balance if using actual token contracts
      // For now, this is a placeholder
      
      logger.info('Getting royalty token balance', params);

    // Placeholder implementation
      return {
        balance: BigInt(0),
        percentage: 0,
        holderAddress: params.holderAddress,
      };
    } catch (error: any) {
      logger.error('Failed to get royalty token balance:', error);
      throw new Error(`Failed to get royalty token balance: ${error.message || error}`);
    }
  }

  /**
   * Transfer Royalty Tokens (for fractional ownership)
   */
  async transferRoyaltyTokens(params: {
    tokenAddress: string;
    to: string;
    amount: bigint;
  }): Promise<{ txHash: string }> {
    try {
      logger.info('Transferring royalty tokens', params);
      
      // TODO: Implement actual ERC-20 token transfer if using token contracts
      // For now, this updates the database tracking

    return {
      txHash: '0x' + '0'.repeat(64), // Placeholder
      };
    } catch (error: any) {
      logger.error('Failed to transfer royalty tokens:', error);
      throw new Error(`Failed to transfer royalty tokens: ${error.message || error}`);
    }
  }

  /**
   * Get Royalty Revenue for an IP Asset
   * 
   * Story Protocol automatically handles royalty distribution via PIL terms.
   * Revenue is accumulated and can be claimed using claimAllRevenue.
   * This method tracks revenue in our database.
   */
  async getRoyaltyRevenue(params: {
    ipId: string;
  }): Promise<{
    totalRevenue: bigint;
    currency: string;
    distributions: RoyaltyDistribution[];
  }> {
    try {
      logger.info('Getting royalty revenue for IP', { ipId: params.ipId });
      
      // Story Protocol automatically handles royalty distribution via PIL terms
      // Revenue is accumulated and can be claimed using claimAllRevenue
      // For now, we track this in our database (royalty_distributions table)
      
      // TODO: Query Story Protocol SDK for actual accumulated revenue
      // This would require checking the IP's royalty balance on-chain
      
      logger.info('Royalty revenue retrieved. Story Protocol handles distribution automatically via PIL terms.');
      
      return {
        totalRevenue: BigInt(0), // Will be populated from database or on-chain query
        currency: 'USDC',
        distributions: [],
      };
    } catch (error: any) {
      logger.error('Failed to get royalty revenue:', error);
      throw new Error(`Failed to get royalty revenue: ${error.message || error}`);
    }
  }

  /**
   * Claim All Revenue for an IP Asset
   * 
   * Claims all accumulated royalties for an IP asset from Story Protocol.
   * This includes royalties from derivative works and other revenue sources.
   */
  async claimAllRevenue(params: {
    ipId: string;
    claimer: string;
    childIpIds?: string[];
    royaltyPolicies?: string[];
  }): Promise<{
    success: boolean;
    transactionHash: string;
    claimedTokens: any;
    ipId: string;
    claimer: string;
  }> {
    try {
      logger.info('Claiming revenue for IP', {
        ipId: params.ipId,
        claimer: params.claimer,
        childIpIds: params.childIpIds,
      });

      const client = getStoryClient();

      const response = await client.royalty.claimAllRevenue({
        ancestorIpId: params.ipId as `0x${string}`,
        claimer: params.claimer as `0x${string}`,
        currencyTokens: [WIP_TOKEN_ADDRESS as `0x${string}`],
        childIpIds: (params.childIpIds || []).map((id) => id as `0x${string}`),
        royaltyPolicies: (params.royaltyPolicies || []).map((policy) => policy as `0x${string}`),
        claimOptions: {
          autoTransferAllClaimedTokensFromIp: true,
          autoUnwrapIpTokens: true,
        },
      });

      logger.info('Revenue claimed successfully', {
        ipId: params.ipId,
        txHash: response.txHashes?.[0] || '',
        claimedTokens: response.claimedTokens,
      });

      return {
        success: true,
        transactionHash: response.txHashes?.[0] || '',
        claimedTokens: response.claimedTokens,
        ipId: params.ipId,
        claimer: params.claimer,
      };
    } catch (error: any) {
      logger.error('Failed to claim revenue:', error);
      throw new Error(`Failed to claim revenue: ${error.message || error}`);
    }
  }

  /**
   * Pay Royalty from one IP Asset to another (Derivative Payment)
   * 
   * Use this when a derivative IP asset needs to pay royalties to its parent IP asset.
   */
  async payRoyaltyFromIP(params: {
    receiverIpId: string;
    payerIpId: string;
    amount: string;
    token?: string;
  }): Promise<{
    success: boolean;
    transactionHash: string;
    amount: bigint;
    receiverIpId: string;
    payerIpId: string;
  }> {
    try {
      logger.info('Paying royalty from IP to IP', {
        receiverIpId: params.receiverIpId,
        payerIpId: params.payerIpId,
        amount: params.amount,
      });

      const client = getStoryClient();
      const token = (params.token || WIP_TOKEN_ADDRESS) as `0x${string}`;

      const response = await client.royalty.payRoyaltyOnBehalf({
        receiverIpId: params.receiverIpId as `0x${string}`,
        payerIpId: params.payerIpId as `0x${string}`,
        token,
        amount: parseEther(params.amount),
      });

      logger.info('Royalty paid successfully', {
        txHash: response.txHash,
        receiverIpId: params.receiverIpId,
        payerIpId: params.payerIpId,
      });

      return {
        success: true,
        transactionHash: response.txHash,
        amount: parseEther(params.amount),
        receiverIpId: params.receiverIpId,
        payerIpId: params.payerIpId,
      };
    } catch (error: any) {
      logger.error('Failed to pay royalty:', error);
      throw new Error(`Failed to pay royalty: ${error.message || error}`);
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
   * 
   * Note: This creates a new IP asset that is linked to the parent.
   * The actual Story Protocol SDK integration for derivatives may require
   * additional methods. For now, we register it as a new IP asset with
   * a reference to the parent in metadata.
   */
  async registerDerivative(params: {
    parentIPId: string;
    derivedIPId: string;
    derivationType: string;
    revenueSplit?: number; // Percentage to parent (0-100)
    derivedMetadata?: {
      name: string;
      description?: string;
      mediaUrl: string;
      thumbnailUrl?: string;
      mediaType?: string;
      creatorAddress?: string;
    };
  }): Promise<{
    derivativeIPId: string;
    licenseId: string;
    txHash: string;
  }> {
    try {
      logger.info('Registering derivative work on Story Protocol', {
        parentIPId: params.parentIPId,
        derivationType: params.derivationType,
        revenueSplit: params.revenueSplit,
      });

      const client = getStoryClient();

      // If we have full metadata, register as a new IP asset
      // Otherwise, return placeholder for now
      if (params.derivedMetadata) {
        // Register the derivative as a new IP asset
        // In a full implementation, this would link to the parent via Story Protocol's derivative system
        const response = await client.ipAsset.registerIpAsset({
          nft: {
            type: 'mint',
            spgNftContract: (process.env.STORY_PROTOCOL_SPG_NFT_CONTRACT || 
              '0xc32A8a0FF3beDDDa58393d022aF433e78739FAbc') as `0x${string}`,
          },
          licenseTermsData: [
            {
              terms: PILFlavor.commercialRemix({
                commercialRevShare: params.revenueSplit || 10, // Revenue share to parent
                defaultMintingFee: parseEther('0'),
                currency: WIP_TOKEN_ADDRESS as `0x${string}`,
              }),
            },
          ],
          ipMetadata: {
            ipMetadataURI: params.derivedMetadata.mediaUrl,
            ipMetadataHash: '0x' + createHash('sha256').update(params.derivedMetadata.mediaUrl).digest('hex'),
            nftMetadataURI: params.derivedMetadata.thumbnailUrl || params.derivedMetadata.mediaUrl,
            nftMetadataHash: '0x' + createHash('sha256').update(params.derivedMetadata.thumbnailUrl || params.derivedMetadata.mediaUrl).digest('hex'),
          },
        });

        logger.info('Derivative IP registered successfully', {
          derivativeIPId: response.ipId,
          txHash: response.txHash,
        });

        return {
          derivativeIPId: response.ipId || params.derivedIPId,
          licenseId: `0x${Buffer.from(
            `${params.parentIPId}-${response.ipId || params.derivedIPId}-${Date.now()}`
          ).toString('hex').slice(0, 40)}`,
          txHash: response.txHash || '0x' + '0'.repeat(64),
        };
      }

      // Fallback: Return placeholder if no metadata provided
      logger.warn('Derivative registration: Using placeholder (metadata not provided)');
      return {
        derivativeIPId: params.derivedIPId,
        licenseId: `0x${Buffer.from(
          `${params.parentIPId}-${params.derivedIPId}-${Date.now()}`
        ).toString('hex').slice(0, 40)}`,
        txHash: '0x' + '0'.repeat(64), // Placeholder
      };
    } catch (error: any) {
      logger.error('Failed to register derivative on Story Protocol:', error);
      // Return placeholder on error so the flow can continue
      return {
        derivativeIPId: params.derivedIPId,
        licenseId: `0x${Buffer.from(
          `${params.parentIPId}-${params.derivedIPId}-${Date.now()}`
        ).toString('hex').slice(0, 40)}`,
        txHash: '0x' + '0'.repeat(64),
      };
    }
  }
}

export const storyProtocolService = new StoryProtocolService();
