# x402 Protocol Integration

This project now uses the official **x402 protocol** for payments, replacing the custom Solana-based implementation.

## What is x402?

x402 is an open protocol for HTTP 402 Payment Required responses, enabling seamless micropayments for APIs and services. It's built on Base (EVM) and Solana networks.

## Integration Details

### Backend (Seller)

The backend uses x402-compatible 402 responses:

1. **402 Response Format**: When a payment is required, the server returns HTTP 402 with a challenge object containing:
   - Payment amount
   - Recipient address
   - Network (base-sepolia for testnet, base for mainnet)
   - Token address (USDC)
   - Expiration time

2. **Payment Verification**: The x402 facilitator verifies payments automatically. The backend checks for the `X-PAYMENT` header which contains proof of payment.

3. **Routes**:
   - `GET /api/asset/:id` - Returns 402 if no payment, asset data if paid
   - `GET /api/unlock/:layerId` - Returns 402 for unlock layers

### SDK (Buyer)

The SDK uses `x402-fetch` which automatically:

1. **Detects 402 responses** from the server
2. **Parses payment challenges** 
3. **Creates payment transactions** using the provided wallet
4. **Retries the request** with the `X-PAYMENT` header

## Usage

### For Buyers

```typescript
import { wrapFetchWithPayment } from 'x402-fetch';
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount('0xYourPrivateKey');
const fetchWithPayment = wrapFetchWithPayment(fetch, account);

// Automatically handles 402 and payment
const response = await fetchWithPayment('https://api.example.com/api/asset/123');
const data = await response.json();
```

### For Sellers

The backend automatically returns 402 responses when payment is required. No additional configuration needed beyond setting up your recipient address.

## Networks

- **Testnet**: Base Sepolia (`base-sepolia`)
- **Mainnet**: Base (`base`)

## Facilitator

- **Testnet**: Uses public facilitator at `https://x402.org/facilitator`
- **Mainnet**: Use `@coinbase/x402` package facilitator (requires CDP API keys)

## Migration Notes

The integration maintains backward compatibility with JWT tokens for existing clients, but new clients should use the x402 protocol for better interoperability.

## Resources

- [x402 Documentation](https://docs.cdp.coinbase.com/x402/docs)
- [x402-fetch Package](https://www.npmjs.com/package/x402-fetch)
- [x402-express Package](https://www.npmjs.com/package/x402-express)

