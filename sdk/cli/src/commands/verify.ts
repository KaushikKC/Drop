import chalk from 'chalk';
import ora from 'ora';
import axios from 'axios';
import { getEffectiveConfig } from '../config.js';

export async function verifyCommand(
  transactionHash: string,
  options: {
    assetId: string;
    token: string;
  }
) {
  const spinner = ora('Verifying payment...').start();

  try {
    const config = await getEffectiveConfig();
    const backendUrl = config.backendUrl || 'http://localhost:3001';

    const response = await axios.post(
      `${backendUrl}/api/payment/verify`,
      {
        transactionHash,
        assetId: options.assetId,
        paymentRequestToken: options.token,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    spinner.succeed(chalk.green('Payment verified!'));

    console.log(chalk.cyan('\n✅ Payment Verification:'));
    console.log(`  Transaction: ${chalk.bold(transactionHash)}`);
    console.log(`  Asset ID: ${chalk.bold(options.assetId)}`);
    console.log(`  Status: ${chalk.green('VERIFIED')}`);

    if (response.data.accessToken) {
      console.log(`  Access Token: ${chalk.gray(response.data.accessToken.substring(0, 50))}...`);
    }

    if (response.data.license) {
      console.log(chalk.cyan('\n📜 License Details:'));
      console.log(`  Type: ${chalk.bold(response.data.license.type)}`);
      if (response.data.license.storyLicenseId) {
        console.log(`  Story License ID: ${chalk.bold(response.data.license.storyLicenseId)}`);
      }
      if (response.data.license.tokenId) {
        console.log(`  Token ID: ${chalk.bold(response.data.license.tokenId)}`);
      }
    }

    return response.data;
  } catch (error: any) {
    spinner.fail(chalk.red('Payment verification failed'));

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

