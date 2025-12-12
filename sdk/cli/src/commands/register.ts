import chalk from 'chalk';
import ora from 'ora';
import axios from 'axios';
import { getEffectiveConfig } from '../config.js';

export async function registerCommand(assetId: string) {
  const spinner = ora('Registering IP on Story Protocol...').start();

  try {
    const config = await getEffectiveConfig();
    const backendUrl = config.backendUrl || 'http://localhost:3001';

    const response = await axios.post(
      `${backendUrl}/api/asset/${assetId}/register-story`,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    spinner.succeed(chalk.green('IP registered on Story Protocol!'));

    console.log(chalk.cyan('\n📝 Story Protocol Details:'));
    console.log(`  IP ID: ${chalk.bold(response.data.ipId)}`);
    console.log(`  Asset ID: ${chalk.bold(assetId)}`);

    if (response.data.licenseId) {
      console.log(`  License ID: ${chalk.bold(response.data.licenseId)}`);
    }

    return response.data;
  } catch (error: any) {
    spinner.fail(chalk.red('Registration failed'));

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

