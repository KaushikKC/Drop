import chalk from 'chalk';
import ora from 'ora';
import axios from 'axios';
import { getEffectiveConfig } from '../config.js';

export async function licensesCommand(options: {
  wallet: string;
  format?: string;
}) {
  const spinner = ora('Fetching license history...').start();

  try {
    const config = await getEffectiveConfig();
    const backendUrl = config.backendUrl || 'http://localhost:3001';

    const response = await axios.get(
      `${backendUrl}/api/user/licenses?wallet=${encodeURIComponent(options.wallet)}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    spinner.succeed(chalk.green('License history retrieved!'));

    const licenses = response.data.licenses || [];

    if (licenses.length === 0) {
      console.log(chalk.yellow('\nNo licenses found for this wallet.'));
      return;
    }

    if (options.format === 'json') {
      console.log(JSON.stringify(licenses, null, 2));
    } else {
      console.log(chalk.cyan(`\n📚 License History (${licenses.length} licenses):\n`));
      
      licenses.forEach((license: any, index: number) => {
        console.log(chalk.bold(`${index + 1}. ${license.asset?.title || 'Untitled'}`));
        console.log(`   Asset ID: ${chalk.gray(license.asset?.id)}`);
        console.log(`   License Type: ${chalk.bold(license.license?.type || 'personal')}`);
        console.log(`   Purchased: ${chalk.gray(new Date(license.purchasedAt).toLocaleString())}`);
        
        if (license.transaction?.hash) {
          console.log(`   Transaction: ${chalk.cyan(license.transaction.hash)}`);
        }
        
        if (license.license?.storyLicenseId) {
          console.log(`   Story License ID: ${chalk.bold(license.license.storyLicenseId)}`);
        }
        
        console.log('');
      });
    }

    return licenses;
  } catch (error: any) {
    spinner.fail(chalk.red('Failed to fetch licenses'));

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

