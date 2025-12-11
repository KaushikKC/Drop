/**
 * React Example - Using Stream402 SDK in a React component
 */

import React, { useState, useEffect } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import type { WalletAdapter } from "@solana/wallet-adapter-base";
import { discover, payAndFetch, uploadAsset } from "stream402-sdk";

interface AssetViewerProps {
  assetUrl: string;
}

export function AssetViewer({ assetUrl }: AssetViewerProps) {
  const walletContext = useWallet();
  const { connection } = useConnection();
  const [status, setStatus] = useState<
    "loading" | "free" | "payment_required" | "paid" | "error"
  >("loading");
  const [downloadUrl, setDownloadUrl] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [challenge, setChallenge] = useState<any>(null);

  useEffect(() => {
    checkAsset();
  }, [assetUrl]);

  const checkAsset = async () => {
    try {
      setStatus("loading");
      setError("");
      const result = await discover(assetUrl);

      if (result.type === "free") {
        setStatus("free");
        setDownloadUrl(result.url);
      } else {
        setStatus("payment_required");
        setChallenge(result.challenge);
      }
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handlePay = async () => {
    if (!walletContext.connected) {
      try {
        await walletContext.connect();
      } catch (err) {
        setError("Failed to connect wallet");
        return;
      }
    }

    if (!walletContext.publicKey || !walletContext.sendTransaction) {
      setError("Wallet not connected");
      return;
    }

    try {
      setStatus("loading");
      setError("");
      // Create a wallet adapter from the wallet context
      // The payAndFetch function accepts a WalletAdapter, but useWallet returns WalletContextState
      // We need to create an adapter-like object that implements the required interface
      const walletAdapter = {
        name: walletContext.wallet?.adapter?.name || "Wallet",
        url: walletContext.wallet?.adapter?.url || "",
        icon: walletContext.wallet?.adapter?.icon || "",
        readyState:
          walletContext.wallet?.adapter?.readyState || ("Installed" as any),
        publicKey: walletContext.publicKey,
        connecting: walletContext.connecting,
        connected: walletContext.connected,
        connect: walletContext.connect,
        disconnect: walletContext.disconnect,
        sendTransaction: walletContext.sendTransaction,
      } as WalletAdapter;
      const result = await payAndFetch(assetUrl, walletAdapter, connection);
      setStatus("paid");
      setDownloadUrl(result.downloadUrl);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="asset-viewer">
      {status === "loading" && <p>Loading asset...</p>}
      {status === "error" && <p className="error">Error: {error}</p>}
      {status === "free" && (
        <div>
          <p>This asset is free to access</p>
          <a href={downloadUrl} download>
            Download
          </a>
        </div>
      )}
      {status === "payment_required" && challenge && (
        <div>
          <p>Payment Required</p>
          <p>
            Amount: {challenge.amount / 10 ** challenge.decimals}{" "}
            {challenge.currency}
          </p>
          <button onClick={handlePay} disabled={!walletContext.connected}>
            {walletContext.connected ? "Pay & Download" : "Connect Wallet"}
          </button>
        </div>
      )}
      {status === "paid" && (
        <div>
          <p>Payment successful!</p>
          <a href={downloadUrl} download>
            Download
          </a>
        </div>
      )}
    </div>
  );
}

interface UploadComponentProps {
  onUploadComplete?: (assetId: string) => void;
}

export function UploadComponent({ onUploadComplete }: UploadComponentProps) {
  const walletContext = useWallet();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<any>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!walletContext.connected || !walletContext.publicKey) {
      setError("Please connect your wallet first");
      return;
    }

    try {
      setUploading(true);
      setError("");
      const uploadResult = await uploadAsset(file, {
        title: file.name,
        price: 0.01,
        tags: [],
        recipient: walletContext.publicKey.toBase58(),
      });
      setResult(uploadResult);
      onUploadComplete?.(uploadResult.assetId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="upload-component">
      <input
        type="file"
        onChange={handleFileChange}
        disabled={uploading || !walletContext.connected}
      />
      {uploading && <p>Uploading...</p>}
      {error && <p className="error">Error: {error}</p>}
      {result && (
        <div>
          <p>Upload successful!</p>
          <p>Asset ID: {result.assetId}</p>
          <a href={result.url}>View Asset</a>
        </div>
      )}
    </div>
  );
}
