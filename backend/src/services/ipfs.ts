import { Web3Storage, File } from 'web3.storage';
import { config } from '../config';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

let storageClient: Web3Storage | null = null;

function getStorageClient(): Web3Storage {
  if (!storageClient) {
    if (!config.ipfs.web3StorageToken) {
      throw new Error('WEB3_STORAGE_TOKEN is required');
    }
    storageClient = new Web3Storage({ token: config.ipfs.web3StorageToken });
  }
  return storageClient;
}

export async function uploadToIPFS(
  file: Buffer | File,
  filename: string
): Promise<{ cid: string; url: string }> {
  try {
    const client = getStorageClient();

    let fileObj: File;
    if (Buffer.isBuffer(file)) {
      fileObj = new File([file], filename);
    } else {
      fileObj = file;
    }

    const cid = await client.put([fileObj], {
      name: filename,
      wrapWithDirectory: false,
    });

    const url = `https://${cid}.ipfs.w3s.link/${filename}`;

    logger.info('Uploaded to IPFS', { cid, url, filename });

    return { cid, url };
  } catch (error) {
    logger.error('IPFS upload failed:', error);
    throw error;
  }
}

export async function uploadMultipleToIPFS(
  files: Array<{ buffer: Buffer; filename: string }>
): Promise<Array<{ cid: string; url: string; filename: string }>> {
  try {
    const client = getStorageClient();

    const fileObjects = files.map(
      ({ buffer, filename }) => new File([buffer], filename)
    );

    const cid = await client.put(fileObjects, {
      wrapWithDirectory: true,
    });

    return files.map(({ filename }) => ({
      cid,
      url: `https://${cid}.ipfs.w3s.link/${filename}`,
      filename,
    }));
  } catch (error) {
    logger.error('IPFS batch upload failed:', error);
    throw error;
  }
}

