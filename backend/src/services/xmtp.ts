import { Client } from '@xmtp/xmtp-js';
import { ethers } from 'ethers';
import { config } from '../config';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// XMTP service for agent-to-agent communication
export class XMTPService {
  private clients: Map<string, Client> = new Map();

  /**
   * Get or create XMTP client for an address
   */
  async getClient(privateKey: string): Promise<Client> {
    const wallet = new ethers.Wallet(privateKey);
    const address = wallet.address.toLowerCase();

    if (this.clients.has(address)) {
      return this.clients.get(address)!;
    }

    const client = await Client.create(wallet, {
      env: config.xmtp.env,
    });

    this.clients.set(address, client);
    return client;
  }

  /**
   * Send a message to another agent
   */
  async sendMessage(
    fromPrivateKey: string,
    toAddress: string,
    message: string
  ): Promise<string> {
    try {
      const client = await this.getClient(fromPrivateKey);
      const conversation = await client.conversations.newConversation(toAddress);
      const sent = await conversation.send(message);
      return sent.id;
    } catch (error) {
      logger.error('Error sending XMTP message:', error);
      throw error;
    }
  }

  /**
   * Send a negotiation intent
   */
  async sendNegotiationIntent(
    fromPrivateKey: string,
    toAddress: string,
    negotiation: {
      assetId: string;
      requestedAmount: string;
      requestedLicenseType: string;
      message: string;
    }
  ): Promise<string> {
    const message = JSON.stringify({
      type: 'negotiation_intent',
      ...negotiation,
      timestamp: Date.now(),
    });

    return await this.sendMessage(fromPrivateKey, toAddress, message);
  }

  /**
   * Send negotiation response (accept/counter/reject)
   */
  async sendNegotiationResponse(
    fromPrivateKey: string,
    toAddress: string,
    response: {
      negotiationId: string;
      status: 'accepted' | 'countered' | 'rejected';
      counterAmount?: string;
      counterLicenseType?: string;
      message?: string;
    }
  ): Promise<string> {
    const message = JSON.stringify({
      type: 'negotiation_response',
      ...response,
      timestamp: Date.now(),
    });

    return await this.sendMessage(fromPrivateKey, toAddress, message);
  }

  /**
   * Listen for messages (for agent bots)
   */
  async listenForMessages(
    privateKey: string,
    onMessage: (message: {
      from: string;
      content: string;
      conversationId: string;
    }) => void
  ): Promise<void> {
    const client = await this.getClient(privateKey);

    // Subscribe to all conversations
    const stream = await client.conversations.stream();
    for await (const conversation of stream) {
      const messages = await conversation.messages();
      for (const message of messages) {
        if (message.senderAddress !== client.address) {
          onMessage({
            from: message.senderAddress,
            content: message.content,
            conversationId: conversation.topic,
          });
        }
      }
    }
  }
}

export const xmtpService = new XMTPService();

