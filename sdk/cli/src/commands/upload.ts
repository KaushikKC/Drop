import chalk from 'chalk';
import ora from 'ora';
import { readFile } from 'fs/promises';
import FormData from 'form-data';
import axios from 'axios';
import { getEffectiveConfig } from '../config.js';

export async function uploadCommand(
  filePath: string,
  options: {
    title?: string;
    description?: string;
    price?: string;
    recipient?: string;
    register?: boolean;
    tags?: string;
  }
) {
  const spinner = ora('Uploading asset...').start();

  try {
    const config = await getEffectiveConfig();
    const backendUrl = config.backendUrl || 'http://localhost:3001';

    // Read file
    const fileBuffer = await readFile(filePath);
    const fileName = filePath.split('/').pop() || 'asset';

    // Prepare form data
    const formData = new FormData();
    formData.append('file', fileBuffer, fileName);
    
    if (options.title) {
      formData.append('title', options.title);
    } else {
      formData.append('title', fileName.split('.')[0]);
    }

    if (options.description) {
      formData.append('description', options.description);
    }

    formData.append('price', options.price || '0.01');
    
    if (options.recipient) {
      formData.append('recipient', options.recipient);
    } else if (config.walletAddress) {
      formData.append('recipient', config.walletAddress);
    } else {
      spinner.fail(chalk.red('Recipient address required. Use --recipient or set DROP_WALLET_ADDRESS'));
      process.exit(1);
    }

    if (options.tags) {
      formData.append('tags', options.tags);
    }

    // Register on Story Protocol by default
    formData.append('registerOnStory', (options.register !== false).toString());

    // Upload
    spinner.text = 'Uploading to backend...';
    const response = await axios.post(`${backendUrl}/api/upload`, formData, {
      headers: formData.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    spinner.succeed(chalk.green('Asset uploaded successfully!'));

    const assetId = response.data.assetId || response.data.id;
    const assetTitle = response.data.title || 'Untitled';
    const ipfsCid = response.data.ipfsCid || response.data.cid;
    const ipfsUrl = response.data.ipfsUrl || response.data.url;
    const storyIPId = response.data.storyIPId || response.data.story_ip_id;
    const price = response.data.price || '0.01';
    const currency = response.data.currency || 'USDC';
    const fingerprint = response.data.fingerprint || response.data.perceptual_hash;

    console.log(chalk.cyan('\n📦 Asset Details:'));
    console.log(`  ID: ${chalk.bold(assetId || 'N/A')}`);
    console.log(`  Title: ${chalk.bold(assetTitle)}`);
    console.log(`  IPFS CID: ${chalk.bold(ipfsCid || 'N/A')}`);
    console.log(`  IPFS URL: ${chalk.cyan(ipfsUrl || 'N/A')}`);
    
    if (storyIPId) {
      console.log(`  Story Protocol IP ID: ${chalk.bold(storyIPId)}`);
    }
    
    console.log(`  Price: ${chalk.bold(price)} ${currency}`);
    if (fingerprint) {
      console.log(`  Fingerprint: ${chalk.gray(fingerprint)}`);
    }

    if (response.data.storyIPId) {
      console.log(chalk.green('\n✓ Registered on Story Protocol'));
    }

    return response.data;
  } catch (error: any) {
    spinner.fail(chalk.red('Upload failed'));
    
    if (error.response) {
      console.error(chalk.red(`\nError: ${error.response.data?.error || error.response.data?.message || error.response.statusText}`));
      if (error.response.data?.details) {
        console.error(chalk.gray(JSON.stringify(error.response.data.details, null, 2)));
      }
    } else if (error.message) {
      console.error(chalk.red(`\nError: ${error.message}`));
    } else {
      console.error(chalk.red('\nUnknown error occurred'));
    }
    
    process.exit(1);
  }
}

