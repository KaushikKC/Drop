/**
 * Payment handler for Base Sepolia network
 * Handles USDC token transfers on Base Sepolia
 */

import { ethers } from 'ethers';

/**
 * Standard ERC20 Token ABI
 */
const ERC20_ABI = [
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "spender",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "value",
				"type": "uint256"
			}
		],
		"name": "approve",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "spender",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "allowance",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "needed",
				"type": "uint256"
			}
		],
		"name": "ERC20InsufficientAllowance",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "sender",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "balance",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "needed",
				"type": "uint256"
			}
		],
		"name": "ERC20InsufficientBalance",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "approver",
				"type": "address"
			}
		],
		"name": "ERC20InvalidApprover",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "receiver",
				"type": "address"
			}
		],
		"name": "ERC20InvalidReceiver",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "sender",
				"type": "address"
			}
		],
		"name": "ERC20InvalidSender",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "spender",
				"type": "address"
			}
		],
		"name": "ERC20InvalidSpender",
		"type": "error"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "owner",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "spender",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "value",
				"type": "uint256"
			}
		],
		"name": "Approval",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "to",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "mint",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "to",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "value",
				"type": "uint256"
			}
		],
		"name": "transfer",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "from",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "to",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "value",
				"type": "uint256"
			}
		],
		"name": "Transfer",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "from",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "to",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "value",
				"type": "uint256"
			}
		],
		"name": "transferFrom",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "owner",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "spender",
				"type": "address"
			}
		],
		"name": "allowance",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "account",
				"type": "address"
			}
		],
		"name": "balanceOf",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "decimals",
		"outputs": [
			{
				"internalType": "uint8",
				"name": "",
				"type": "uint8"
			}
		],
		"stateMutability": "pure",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "name",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "symbol",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "totalSupply",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
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
// Using MockUSDC contract: 0x98dC0e28942A1475FA1923b6415E2783843F68CD
const getUsdcAddress = () => {
  return (
    process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS ||
    '0x98dC0e28942A1475FA1923b6415E2783843F68CD' // MockUSDC on Base Sepolia
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
  console.log('🔍 Checking balance:', {
    walletAddress: address,
    tokenAddress: tokenAddress,
    amount: amount.toString(),
    rpcUrl: getRpcUrl(),
  });

  let balance: bigint;
  let decimals: number;
  try {
    balance = await tokenContract.balanceOf(address);
    decimals = Number(await tokenContract.decimals());
    console.log('💰 Balance check result:', {
      balanceRaw: balance.toString(),
      decimals: decimals,
      balanceFormatted: (Number(balance) / Math.pow(10, decimals)).toFixed(6),
    });
  } catch (error: any) {
    console.error('❌ Balance check failed:', error);
    throw new Error(`Failed to check balance: ${error.message || 'Unknown error'}`);
  }

  if (balance < amount) {
    // Ensure decimals is a number (not BigInt)
    const decimalsNum = Number(decimals);
    // Convert BigInt to Number before division
    const balanceFormatted = Number(balance) / Math.pow(10, decimalsNum);
    const amountFormatted = Number(amount) / Math.pow(10, decimalsNum);
    throw new Error(
      `Insufficient USDC balance. You have ${balanceFormatted.toFixed(6)} USDC, need ${amountFormatted.toFixed(6)} USDC. ` +
      `Token: ${tokenAddress}, Network: ${getRpcUrl()}`
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
): Promise<{
  accessToken: string;
  license?: {
    tokenId?: string;
    storyLicenseId?: string;
    type?: string;
    mintedAt?: string;
  };
  transactionHash?: string;
  assetId?: string;
}> {
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

  return result as {
    accessToken: string;
    license?: {
      tokenId?: string;
      storyLicenseId?: string;
      type?: string;
      mintedAt?: string;
    };
    transactionHash?: string;
    assetId?: string;
  };
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
  // Ensure decimals is a number (not BigInt)
  const decimalsNum = Number(decimals);

  return (Number(balance) / Math.pow(10, decimalsNum)).toFixed(6);
}

