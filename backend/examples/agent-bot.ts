/**
 * Example Agent Bot
 * 
 * This agent discovers assets by tags and auto-purchases + downloads them.
 * Demonstrates the agent-to-agent micro-economy capabilities.
 */

import { ethers } from 'ethers';
import { discover, payAndFetch, createNegotiation } from '../../sdk/src';
import { xmtpService } from '../src/services/xmtp';

interface AgentConfig {
  privateKey: string;
  rpcUrl: string;
  apiBaseUrl: string;
  tags: string[];
  maxPrice: number; // in USDC
  autoPurchase: boolean;
  enableNegotiation: boolean;
}

class AgentBot {
  private signer: ethers.Wallet;
  private provider: ethers.Provider;
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.signer = new ethers.Wallet(config.privateKey, this.provider);
  }

  /**
   * Discover assets by tags
   */
  async discoverAssets(): Promise<any[]> {
    const response = await fetch(`${this.config.apiBaseUrl}/api/agent/discover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tags: this.config.tags,
        maxPrice: this.config.maxPrice * 1e6, // Convert to wei (6 decimals for USDC)
        limit: 50,
      }),
    });

    if (!response.ok) {
      throw new Error(`Discovery failed: ${response.status}`);
    }

    const data = await response.json();
    return data.assets || [];
  }

  /**
   * Process a single asset
   */
  async processAsset(asset: any): Promise<void> {
    console.log(`\n📦 Processing asset: ${asset.title} (${asset.id})`);

    try {
      // Discover the asset to get payment challenge
      const assetUrl = `${this.config.apiBaseUrl}/api/asset/${asset.id}`;
      const discoverResult = await discover(assetUrl);

      if (discoverResult.type === 'free') {
        console.log('✅ Asset is free, downloading...');
        // Download free asset
        return;
      }

      const challenge = discoverResult.challenge;
      const priceInUSDC = parseFloat(challenge.amount) / 1e6;

      console.log(`💰 Price: ${priceInUSDC} USDC`);

      // Check if within budget
      if (priceInUSDC > this.config.maxPrice) {
        console.log(`❌ Price exceeds max budget (${this.config.maxPrice} USDC)`);

        // Try negotiation if enabled
        if (this.config.enableNegotiation) {
          await this.negotiateAsset(asset.id, priceInUSDC);
        }
        return;
      }

      // Auto-purchase if enabled
      if (this.config.autoPurchase) {
        console.log('🛒 Auto-purchasing asset...');
        const result = await payAndFetch(assetUrl, this.signer, {
          baseUrl: this.config.apiBaseUrl,
        });

        console.log('✅ Purchase successful!');
        console.log(`📥 Download URL: ${result.downloadUrl}`);
        console.log(`⏰ Expires at: ${new Date(result.expiresAt).toISOString()}`);

        // Record transaction
        await this.recordTransaction(asset.id, challenge.amount);
      } else {
        console.log('⏸️  Auto-purchase disabled, skipping...');
      }
    } catch (error) {
      console.error(`❌ Error processing asset ${asset.id}:`, error);
    }
  }

  /**
   * Negotiate for a better price
   */
  async negotiateAsset(assetId: string, currentPrice: number): Promise<void> {
    console.log(`💬 Attempting negotiation for asset ${assetId}...`);

    try {
      const negotiationAmount = (currentPrice * 0.8).toFixed(6); // 20% discount request

      const result = await createNegotiation(
        {
          assetId,
          requestedAmount: negotiationAmount,
          requestedLicenseType: 'commercial',
          message: `Bulk purchase request. Budget: ${negotiationAmount} USDC`,
          expiresInHours: 24,
        },
        this.config.privateKey,
        { baseUrl: this.config.apiBaseUrl }
      );

      console.log(`✅ Negotiation created: ${result.negotiationId}`);
      console.log(`📧 Waiting for creator response...`);
    } catch (error) {
      console.error('❌ Negotiation failed:', error);
    }
  }

  /**
   * Record agent transaction
   */
  async recordTransaction(assetId: string, amount: string): Promise<void> {
    // In a real implementation, this would store transaction history
    console.log(`📝 Recording transaction: ${assetId} - ${amount} wei`);
  }

  /**
   * Listen for XMTP messages (negotiation responses)
   */
  async listenForMessages(): Promise<void> {
    console.log('👂 Listening for XMTP messages...');

    await xmtpService.listenForMessages(
      this.config.privateKey,
      async (message) => {
        console.log(`📨 Received message from ${message.from}:`);
        console.log(`   Content: ${message.content}`);

        try {
          const data = JSON.parse(message.content);
          if (data.type === 'negotiation_response') {
            await this.handleNegotiationResponse(data);
          }
        } catch {
          // Not JSON, ignore
        }
      }
    );
  }

  /**
   * Handle negotiation response
   */
  async handleNegotiationResponse(response: any): Promise<void> {
    console.log(`\n💬 Negotiation response received:`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Negotiation ID: ${response.negotiationId}`);

    if (response.status === 'accepted') {
      console.log('✅ Negotiation accepted! Proceeding with purchase...');
      // Proceed with payment at negotiated price
    } else if (response.status === 'countered') {
      console.log(`💰 Counter offer: ${response.counterAmount} USDC`);
      // Decide whether to accept counter offer
    } else {
      console.log('❌ Negotiation rejected');
    }
  }

  /**
   * Run the agent
   */
  async run(): Promise<void> {
    console.log('🤖 Agent Bot Starting...');
    console.log(`📍 Address: ${await this.signer.getAddress()}`);
    console.log(`🏷️  Tags: ${this.config.tags.join(', ')}`);
    console.log(`💰 Max Price: ${this.config.maxPrice} USDC`);
    console.log(`🛒 Auto-purchase: ${this.config.autoPurchase ? 'Enabled' : 'Disabled'}`);

    // Start listening for messages in background
    if (this.config.enableNegotiation) {
      this.listenForMessages().catch(console.error);
    }

    // Main loop: discover and process assets
    while (true) {
      try {
        console.log('\n🔍 Discovering assets...');
        const assets = await this.discoverAssets();
        console.log(`📦 Found ${assets.length} assets`);

        for (const asset of assets) {
          await this.processAsset(asset);
          // Small delay between assets
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        // Wait before next discovery cycle
        console.log('\n⏳ Waiting 60 seconds before next discovery cycle...');
        await new Promise((resolve) => setTimeout(resolve, 60000));
      } catch (error) {
        console.error('❌ Error in main loop:', error);
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
    }
  }
}

// Example usage
async function main() {
  const config: AgentConfig = {
    privateKey: process.env.AGENT_PRIVATE_KEY || '',
    rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://sepolia.infura.io/v3/YOUR_KEY',
    apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
    tags: ['ai', 'art', 'digital'],
    maxPrice: 0.1, // 0.1 USDC
    autoPurchase: true,
    enableNegotiation: true,
  };

  if (!config.privateKey) {
    console.error('❌ AGENT_PRIVATE_KEY environment variable is required');
    process.exit(1);
  }

  const agent = new AgentBot(config);
  await agent.run();
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { AgentBot };

