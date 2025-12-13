import { ethers } from "ethers";
import { config } from "../config";
import pino from "pino";

const logger = pino({ level: process.env.LOG_LEVEL || "info" });

// ERC20 ABI (minimal - just what we need)
const ERC20_ABI = [
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];

let provider: ethers.Provider | null = null;
let wallet: ethers.Wallet | null = null;

export function getProvider(): ethers.Provider {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(config.ethereum.rpcUrl);
  }
  return provider;
}

export function getWallet(): ethers.Wallet {
  if (!wallet && config.ethereum.privateKey) {
    wallet = new ethers.Wallet(config.ethereum.privateKey, getProvider());
  }
  return wallet!;
}

export async function verifyERC20Transfer(
  txHash: string,
  expectedRecipient: string,
  expectedAmount: bigint,
  tokenAddress: string
): Promise<{
  valid: boolean;
  from?: string;
  to?: string;
  amount?: bigint;
  error?: string;
}> {
  try {
    const provider = getProvider();
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt) {
      return { valid: false, error: "Transaction not found" };
    }

    if (receipt.status !== 1) {
      return { valid: false, error: "Transaction failed" };
    }

    // Get the transaction to see the actual transfer
    const tx = await provider.getTransaction(txHash);
    if (!tx) {
      return { valid: false, error: "Transaction details not found" };
    }

    // Create contract instance to parse logs
    const tokenContract = new ethers.Contract(
      tokenAddress,
      ERC20_ABI,
      provider
    );

    // Parse Transfer events from logs
    const transferEvents = receipt.logs
      .map((log) => {
        try {
          const parsed = tokenContract.interface.parseLog(log);
          if (parsed && parsed.name === "Transfer") {
            const args = parsed.args as any;
            if (
              args &&
              typeof args.from === "string" &&
              typeof args.to === "string" &&
              args.value !== undefined
            ) {
              return {
                name: parsed.name,
                args: {
                  from: args.from as string,
                  to: args.to as string,
                  value: BigInt(args.value.toString()),
                },
              };
            }
          }
          return null;
        } catch {
          return null;
        }
      })
      .filter(
        (
          event
        ): event is {
          name: string;
          args: { from: string; to: string; value: bigint };
        } => {
          return event !== null;
        }
      );

    // Find transfer to expected recipient
    const relevantTransfer = transferEvents.find(
      (event) => event.args.to.toLowerCase() === expectedRecipient.toLowerCase()
    );

    if (!relevantTransfer) {
      return {
        valid: false,
        error: "No transfer found to expected recipient",
      };
    }

    const { from, to, value } = relevantTransfer.args;

    // Verify amount matches (allow small tolerance for rounding)
    const amountDiff =
      value > expectedAmount ? value - expectedAmount : expectedAmount - value;
    const tolerance = expectedAmount / BigInt(10000); // 0.01% tolerance

    if (amountDiff > tolerance) {
      return {
        valid: false,
        error: `Amount mismatch: expected ${expectedAmount.toString()}, got ${value.toString()}`,
        from,
        to,
        amount: value,
      };
    }

    return {
      valid: true,
      from,
      to,
      amount: value,
    };
  } catch (error) {
    logger.error("Error verifying ERC20 transfer:", error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getERC20Balance(
  address: string,
  tokenAddress: string
): Promise<bigint> {
  const provider = getProvider();
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  return await tokenContract.balanceOf(address);
}

export async function getERC20Decimals(tokenAddress: string): Promise<number> {
  const provider = getProvider();
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  return await tokenContract.decimals();
}

export function parseEther(amount: string, decimals: number = 18): bigint {
  return ethers.parseUnits(amount, decimals);
}

export function formatEther(amount: bigint, decimals: number = 18): string {
  return ethers.formatUnits(amount, decimals);
}
