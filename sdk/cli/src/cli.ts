#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { uploadCommand } from './commands/upload.js';
import { registerCommand } from './commands/register.js';
import { receiptCommand } from './commands/receipt.js';
import { verifyCommand } from './commands/verify.js';
import { licensesCommand } from './commands/licenses.js';
import { configCommand } from './commands/config.js';

const program = new Command();

program
  .name('drop')
  .description('Drop CLI - Developer tool for IP asset management')
  .version('1.0.0');

// Config command
program
  .command('config')
  .description('Configure Drop CLI settings')
  .option('-s, --set <key=value>', 'Set a configuration value')
  .option('-g, --get <key>', 'Get a configuration value')
  .option('-l, --list', 'List all configuration')
  .action(configCommand);

// Upload command
program
  .command('upload <file>')
  .description('Upload an asset to Drop')
  .option('-t, --title <title>', 'Asset title')
  .option('-d, --description <description>', 'Asset description')
  .option('-p, --price <price>', 'Price in USDC (default: 0.01)', '0.01')
  .option('-r, --recipient <address>', 'Recipient wallet address')
  .option('--no-register', 'Skip Story Protocol registration')
  .option('--tags <tags>', 'Comma-separated tags')
  .action(uploadCommand);

// Register IP command
program
  .command('register <assetId>')
  .description('Register an asset on Story Protocol')
  .action(registerCommand);

// Generate receipt command
program
  .command('receipt <transactionHash>')
  .description('Generate X402 receipt for a payment')
  .option('-a, --asset-id <assetId>', 'Asset ID')
  .option('-w, --wallet <address>', 'Wallet address')
  .action(receiptCommand);

// Verify payment command
program
  .command('verify <transactionHash>')
  .description('Verify a payment transaction')
  .requiredOption('-a, --asset-id <assetId>', 'Asset ID')
  .requiredOption('-t, --token <token>', 'Payment request token')
  .action(verifyCommand);

// Licenses command
program
  .command('licenses')
  .description('Retrieve license history')
  .requiredOption('-w, --wallet <address>', 'Wallet address')
  .option('--format <format>', 'Output format (json, table)', 'table')
  .action(licensesCommand);

program.parse();

