/**
 * Example: Using Stream402 SDK with x402 protocol
 */

import { wrapFetchWithPayment } from 'x402-fetch';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { uploadAsset, payAndFetch, discover } from '../src';

async function main() {
  // Create account from private key
  const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

  // Example 1: Upload an asset
  console.log('📤 Uploading asset...');
  const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });
  
  const uploadResult = await uploadAsset(
    file,
    {
      title: 'My Digital Art',
      price: 0.01,
      recipient: account.address,
      tags: ['art', 'digital'],
      registerOnStory: true,
    },
    undefined, // No signer needed for upload
    {
      baseUrl: 'http://localhost:3001',
    }
  );

  console.log('✅ Upload successful:', uploadResult);

  // Example 2: Discover and pay for an asset
  console.log('\n🔍 Discovering asset...');
  const assetUrl = `http://localhost:3001/api/asset/${uploadResult.assetId}`;
  
  const discoverResult = await discover(assetUrl);
  
  if (discoverResult.type === 'payment_required') {
    console.log('💰 Payment required:', discoverResult.challenge);
    
    // Pay and fetch using x402-fetch
    console.log('\n💳 Paying for asset...');
    const result = await payAndFetch(assetUrl, account, {
      baseUrl: 'http://localhost:3001',
    });

    console.log('✅ Payment successful!');
    console.log('📥 Download URL:', result.downloadUrl);
  } else {
    console.log('✅ Asset is free:', discoverResult.url);
  }

  // Example 3: Using x402-fetch directly
  console.log('\n🔄 Using x402-fetch directly...');
  const fetchWithPayment = wrapFetchWithPayment(fetch, account);
  
  const response = await fetchWithPayment(assetUrl);
  const data = await response.json();
  
  console.log('✅ Response:', data);
}

main().catch(console.error);


