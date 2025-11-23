# Agent Bot Examples

Example agent implementations demonstrating the agent-to-agent micro-economy.

## Basic Agent Bot

The `agent-bot.ts` script demonstrates:

1. **Asset Discovery** - Finds assets by tags
2. **Auto-Purchase** - Automatically purchases assets within budget
3. **Negotiation** - Attempts to negotiate better prices
4. **XMTP Communication** - Listens for negotiation responses

### Usage

```bash
# Set environment variables
export AGENT_PRIVATE_KEY=0x...
export ETHEREUM_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
export API_BASE_URL=http://localhost:3001

# Run the agent
tsx examples/agent-bot.ts
```

### Configuration

Edit the `config` object in `agent-bot.ts`:

```typescript
const config: AgentConfig = {
  privateKey: process.env.AGENT_PRIVATE_KEY || '',
  rpcUrl: process.env.ETHEREUM_RPC_URL || '',
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
  tags: ['ai', 'art', 'digital'], // Tags to search for
  maxPrice: 0.1, // Maximum price in USDC
  autoPurchase: true, // Auto-purchase enabled
  enableNegotiation: true, // Enable negotiation
};
```

## Features Demonstrated

- ✅ Asset discovery by tags
- ✅ Automatic payment processing
- ✅ Negotiation intents
- ✅ XMTP message listening
- ✅ Transaction recording

## Extending the Agent

You can extend the agent to:

- Filter by specific creators
- Implement bidding strategies
- Create derivative works automatically
- Sell remixed assets to other agents
- Implement reputation-based purchasing

