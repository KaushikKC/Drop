import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

const CONFIG_DIR = join(homedir(), '.drop');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export interface DropConfig {
  backendUrl?: string;
  walletAddress?: string;
  privateKey?: string;
  storyProtocolRpcUrl?: string;
}

export async function loadConfig(): Promise<DropConfig> {
  try {
    const content = await readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

export async function saveConfig(config: Partial<DropConfig>): Promise<void> {
  try {
    await mkdir(CONFIG_DIR, { recursive: true });
    const existing = await loadConfig();
    const updated = { ...existing, ...config };
    await writeFile(CONFIG_FILE, JSON.stringify(updated, null, 2));
  } catch (error) {
    throw new Error(`Failed to save config: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getConfigValue(key: keyof DropConfig): Promise<string | undefined> {
  const config = await loadConfig();
  return config[key];
}

export function getEnvConfig(): DropConfig {
  return {
    backendUrl: process.env.DROP_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:3001',
    walletAddress: process.env.DROP_WALLET_ADDRESS,
    privateKey: process.env.DROP_PRIVATE_KEY,
    storyProtocolRpcUrl: process.env.STORY_PROTOCOL_RPC_URL,
  };
}

export async function getEffectiveConfig(): Promise<DropConfig> {
  const fileConfig = await loadConfig();
  const envConfig = getEnvConfig();
  return { ...fileConfig, ...envConfig };
}

