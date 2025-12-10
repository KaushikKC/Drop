/**
 * Payment handler for Base Sepolia network
 * Handles USDC token transfers on Base Sepolia
 */

import { ethers } from 'ethers';

/**
 * Standard ERC20 Token ABI
 * You DON'T need to write contracts - ERC20 is a standard interface!
 * Even if the contract is a proxy (like the one you provided), 
 * you can interact with it using the standard ERC20 ABI.
 * 
 * The ABI you provided is for a proxy contract, but we use the ERC20 ABI
 * because proxies forward calls to the implementation contract.
 */
const ERC20_ABI = [
  // Standard ERC20 functions
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) external returns (bool)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
  'function name() external view returns (string)',
  'function totalSupply() external view returns (uint256)',
  // Events
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
] as const;

// Get Base Sepolia RPC URL
const getRpcUrl = () => {
  return (
    process.env.NEXT_PUBLIC_BASE_RPC_URL ||
    process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL ||
    'https://sepolia.base.org'
  );
};

// Get USDC token address on Base Sepolia
// Using the address you provided: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
const getUsdcAddress = () => {
  return (
    process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS ||
    '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
  );
};

/**
 * Pay for an asset using USDC on Base Sepolia
 * @param challenge Payment challenge from backend
 * @param signer Ethers signer (from Privy wallet)
 * @returns Transaction hash
 */
export async function payForAsset(
  challenge: {
    tokenAddress?: string;
    recipient: string;
    amount: string;
  },
  signer: ethers.Signer
): Promise<string> {
  const tokenAddress = challenge.tokenAddress || getUsdcAddress();
  const recipient = challenge.recipient;
  
  // Validate and convert amount to BigInt
  if (!challenge.amount || challenge.amount === 'undefined' || challenge.amount === 'null') {
    throw new Error('Invalid payment amount: amount is required and must be a valid number string');
  }
  
  let amount: bigint;
  try {
    amount = BigInt(challenge.amount);
    if (amount <= BigInt(0)) {
      throw new Error('Payment amount must be greater than 0');
    }
  } catch (error) {
    throw new Error(`Invalid payment amount: ${challenge.amount}. Must be a valid number string.`);
  }

  // Get provider and token contract
  const provider = signer.provider || new ethers.JsonRpcProvider(getRpcUrl());
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);

  // Check balance
  const address = await signer.getAddress();
  const balance = await tokenContract.balanceOf(address);

  if (balance < amount) {
    const decimals = await tokenContract.decimals();
    const balanceFormatted = Number(balance) / 10 ** decimals;
    const amountFormatted = Number(amount) / 10 ** decimals;
    throw new Error(
      `Insufficient USDC balance. You have ${balanceFormatted} USDC, need ${amountFormatted} USDC`
    );
  }

  // Transfer tokens
  try {
    const tx = await tokenContract.transfer(recipient, amount);
    const receipt = await tx.wait();

    if (!receipt) {
      throw new Error('Transaction failed - no receipt');
    }

    return receipt.hash;
  } catch (error: any) {
    if (error.code === 'ACTION_REJECTED') {
      throw new Error('Transaction rejected by user');
    }
    throw new Error(`Payment failed: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Complete payment flow: pay and verify
 * @param challenge Payment challenge
 * @param signer Ethers signer
 * @param paymentRequestToken Token from challenge
 * @param assetId Asset ID
 * @returns Access token
 */
export async function payAndVerify(
  challenge: {
    tokenAddress?: string;
    recipient: string;
    amount: string;
    paymentRequestToken?: string;
    expiresAt?: number; // Unix timestamp (optional)
  },
  signer: ethers.Signer,
  paymentRequestToken: string,
  assetId: string
): Promise<{ accessToken: string }> {
  // 1. Make payment
  const txHash = await payForAsset(challenge, signer);

  // 2. Verify payment (import dynamically to avoid circular deps)
  const { verifyPayment } = await import('./api-client');
  const result = await verifyPayment({
    signature: txHash,
    paymentRequestToken,
    imageId: assetId,
    challenge: challenge.expiresAt ? {
      expiresAt: challenge.expiresAt,
    } : undefined,
  });

  return result;
}

/**
 * Get USDC balance for an address
 */
export async function getUsdcBalance(address: string): Promise<string> {
  const provider = new ethers.JsonRpcProvider(getRpcUrl());
  const tokenAddress = getUsdcAddress();
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

  const balance = await tokenContract.balanceOf(address);
  const decimals = await tokenContract.decimals();

  return (Number(balance) / 10 ** decimals).toFixed(6);
}

