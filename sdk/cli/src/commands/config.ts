import chalk from 'chalk';
import { saveConfig, loadConfig, getConfigValue, DropConfig } from '../config.js';

export async function configCommand(options: {
  set?: string;
  get?: string;
  list?: boolean;
}) {
  if (options.set) {
    const [key, ...valueParts] = options.set.split('=');
    const value = valueParts.join('=');
    
    if (!key || !value) {
      console.error(chalk.red('Invalid format. Use: drop config --set key=value'));
      process.exit(1);
    }

    const validKeys: (keyof DropConfig)[] = [
      'backendUrl',
      'walletAddress',
      'privateKey',
      'storyProtocolRpcUrl',
    ];

    if (!validKeys.includes(key as keyof DropConfig)) {
      console.error(chalk.red(`Invalid key. Valid keys: ${validKeys.join(', ')}`));
      process.exit(1);
    }

    try {
      await saveConfig({ [key]: value });
      console.log(chalk.green(`✓ Set ${key} = ${value}`));
    } catch (error) {
      console.error(chalk.red(`Failed to save config: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  } else if (options.get) {
    const value = await getConfigValue(options.get as keyof DropConfig);
    if (value) {
      console.log(value);
    } else {
      console.error(chalk.red(`Config key "${options.get}" not found`));
      console.log(chalk.yellow(`\nTip: Set it with:`));
      console.log(chalk.cyan(`  drop config --set ${options.get}=<value>`));
      console.log(chalk.yellow(`\nOr use environment variable:`));
      console.log(chalk.cyan(`  export DROP_BACKEND_URL=<value>`));
      process.exit(1);
    }
  } else if (options.list) {
    const config = await loadConfig();
    if (Object.keys(config).length === 0) {
      console.log(chalk.yellow('No configuration set. Use --set to configure.'));
    } else {
      console.log(chalk.cyan('\nDrop CLI Configuration:'));
      console.log(JSON.stringify(config, null, 2));
    }
  } else {
    console.error(chalk.red('Please specify --set, --get, or --list'));
    process.exit(1);
  }
}

