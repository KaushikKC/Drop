import chalk from 'chalk';
import ora from 'ora';
import axios from 'axios';
import { getEffectiveConfig } from '../config.js';

export async function receiptCommand(
  transactionHash: string,
  options: {
    assetId?: string;
    wallet?: string;
  }
) {
  const spinner = ora('Generating X402 receipt...').start();

  try {
    const config = await getEffectiveConfig();
    const backendUrl = config.backendUrl || 'http://localhost:3001';

    const response = await axios.post(
      `${backendUrl}/api/receipt`,
      {
        signature: transactionHash,
        assetId: options.assetId,
        wallet: options.wallet || config.walletAddress,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    spinner.succeed(chalk.green('Receipt generated!'));

    console.log(chalk.cyan('\n🧾 X402 Receipt:'));
    console.log(`  Transaction: ${chalk.bold(transactionHash)}`);
    console.log(`  Asset ID: ${chalk.bold(response.data.assetId)}`);
    console.log(`  Amount: ${chalk.bold(response.data.amount)} ${response.data.currency || 'USDC'}`);
    console.log(`  Payer: ${chalk.bold(response.data.payer)}`);
    console.log(`  Recipient: ${chalk.bold(response.data.recipient)}`);
    
    if (response.data.explorerUrl) {
      console.log(`  Explorer: ${chalk.cyan(response.data.explorerUrl)}`);
    }

    if (response.data.accessToken) {
      console.log(`  Access Token: ${chalk.gray(response.data.accessToken.substring(0, 50))}...`);
    }

    return response.data;
  } catch (error: any) {
    spinner.fail(chalk.red('Receipt generation failed'));

    if (error.response) {
      console.error(chalk.red(`\nError: ${error.response.data?.error || error.response.data?.message || error.response.statusText}`));
    } else if (error.message) {
      console.error(chalk.red(`\nError: ${error.message}`));
    } else {
      console.error(chalk.red('\nUnknown error occurred'));
    }

    process.exit(1);
  }
}

