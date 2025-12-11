import { Web3Storage, File } from 'web3.storage';
import { config } from '../config';
import pino from 'pino';
import axios from 'axios';
import FormData from 'form-data';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

let storageClient: Web3Storage | null = null;

// Pinata upload function
async function uploadToPinata(
  file: Buffer | File,
  filename: string
): Promise<{ cid: string; url: string }> {
  if (!config.ipfs.pinataApiKey || !config.ipfs.pinataApiSecret) {
    throw new Error('PINATA_API_KEY and PINATA_API_SECRET are required');
  }

  const formData = new FormData();
  
  // Convert File to Buffer if needed
  let fileBuffer: Buffer;
  if (Buffer.isBuffer(file)) {
    fileBuffer = file;
  } else {
    const arrayBuffer = await file.arrayBuffer();
    fileBuffer = Buffer.from(arrayBuffer);
  }

  formData.append('file', fileBuffer, {
    filename: filename,
    contentType: 'application/octet-stream',
  });

  // Pinata metadata
  const metadata = JSON.stringify({
    name: filename,
  });
  formData.append('pinataMetadata', metadata);

  // Pinata options
  const pinataOptions = JSON.stringify({
    cidVersion: 0,
  });
  formData.append('pinataOptions', pinataOptions);

  try {
    const response = await axios.post(
      'https://api.pinata.cloud/pinning/pinFileToIPFS',
      formData,
      {
        maxBodyLength: Infinity,
        headers: {
          ...formData.getHeaders(),
          pinata_api_key: config.ipfs.pinataApiKey,
          pinata_secret_api_key: config.ipfs.pinataApiSecret,
        },
      }
    );

    const cid = response.data.IpfsHash;
    // Use public IPFS gateway that supports CORS better
    // Fallback to multiple gateways for better availability
    const url = `https://ipfs.io/ipfs/${cid}`;
    // Alternative: `https://gateway.pinata.cloud/ipfs/${cid}` (has CORS issues)

    logger.info('Uploaded to Pinata IPFS', { cid, url, filename });
    return { cid, url };
  } catch (error: any) {
    logger.error('Pinata upload failed:', error.response?.data || error.message);
    throw new Error(`Pinata upload failed: ${error.response?.data?.error || error.message}`);
  }
}

// Web3.Storage client (legacy support)
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
    // Use Pinata if configured, otherwise fall back to Web3.Storage
    if (config.ipfs.provider === 'pinata') {
      return await uploadToPinata(file, filename);
    }

    // Web3.Storage (legacy)
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
    
    // Provide more helpful error messages
    if (error instanceof Error) {
      if (error.message.includes('PINATA') || error.message.includes('Pinata')) {
        throw new Error('IPFS upload failed: Pinata API keys are missing or invalid. Please set PINATA_API_KEY and PINATA_API_SECRET in your .env file.');
      }
      if (error.message.includes('WEB3_STORAGE') || error.message.includes('token')) {
        throw new Error('IPFS upload failed: Web3.Storage token is missing or invalid. Please set WEB3_STORAGE_TOKEN in your .env file.');
      }
    }
    
    throw error;
  }
}

export async function uploadMultipleToIPFS(
  files: Array<{ buffer: Buffer; filename: string }>
): Promise<Array<{ cid: string; url: string; filename: string }>> {
  try {
    // Use Pinata if configured
    if (config.ipfs.provider === 'pinata') {
      // Upload files individually to Pinata
      const uploadPromises = files.map(({ buffer, filename }) =>
        uploadToPinata(buffer, filename)
      );
      const results = await Promise.all(uploadPromises);
      
      return results.map((result, index) => ({
        cid: result.cid,
        url: result.url,
        filename: files[index].filename,
      }));
    }

    // Web3.Storage (legacy)
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

/**
 * Upload JSON object to IPFS
 */
export async function uploadJSONToIPFS(
  jsonObject: any,
  filename: string = 'metadata.json'
): Promise<{ cid: string; url: string }> {
  const jsonString = JSON.stringify(jsonObject, null, 2);
  const jsonBuffer = Buffer.from(jsonString, 'utf-8');
  return await uploadToIPFS(jsonBuffer, filename);
}

