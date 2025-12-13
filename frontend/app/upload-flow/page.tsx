"use client";
import React, { useState } from "react";
import { Upload, X, Check, Zap, Scan, AlertCircle } from "lucide-react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { uploadAsset, checkImageHash } from "@/lib/api-client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { TopNav } from "../components/Navbar";

const UploadFlow = () => {
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("0.01");
  const [imageHash, setImageHash] = useState<string>("");
  const [hashDisplay, setHashDisplay] = useState<string>("");
  const [isUnique, setIsUnique] = useState<boolean>(true);
  const [duplicateInfo, setDuplicateInfo] = useState<{
    type: "exact" | "similar";
    assetId: string;
    title: string;
    creator: string;
  } | null>(null);
  const [storyIPId, setStoryIPId] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) processFile(e.target.files[0]);
  };

  const processFile = async (f: File) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setTitle(f.name.split(".")[0]);
    setError(null);
    setScanning(true);
    setScanComplete(false);
    setImageHash("");
    setHashDisplay("");
    setIsUnique(true);
    setDuplicateInfo(null);

    try {
      // Check image hash and uniqueness
      const result = await checkImageHash(f);
      setImageHash(result.hash);
      setHashDisplay(result.hashDisplay);
      setIsUnique(result.isUnique);

      if (result.duplicateInfo) {
        setDuplicateInfo(result.duplicateInfo);
        setError(
          result.duplicateInfo.type === "exact"
            ? `Duplicate image detected! An identical image "${result.duplicateInfo.title}" already exists.`
            : `Similar image detected! A very similar image "${result.duplicateInfo.title}" already exists.`
        );
      }

      setScanComplete(true);
    } catch (err: any) {
      console.error("Hash check error:", err);
      setError(err.message || "Failed to analyze image");
      setScanComplete(false);
    } finally {
      setScanning(false);
    }
  };

  const handlePublish = async () => {
    if (!file || !title.trim()) {
      setError("Please provide a title");
      return;
    }

    if (!authenticated || !wallets[0]) {
      setError("Please connect your wallet first");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const walletAddress = wallets[0].address;
      const result = await uploadAsset(file, {
        title: title.trim(),
        description: description.trim(),
        price: parseFloat(price) || 0.01,
        recipient: walletAddress,
        tags: [], // Can add tag input later
        registerOnStory: true, // Enable Story Protocol registration
      });

      console.log("✅ Upload successful!", result);
      console.log("📦 Asset ID:", result.assetId);
      console.log("🔗 IPFS URL:", result.ipfsUrl);
      console.log(
        "📝 Story Protocol IP ID:",
        result.storyIPId || "Not registered"
      );

      if (result.storyIPId) {
        setStoryIPId(result.storyIPId);
        setUploadSuccess(true);
        console.log(
          "🌐 View on Story Protocol:",
          `https://aeneid.explorer.story.foundation/ipa/${result.storyIPId}`
        );
      } else {
        console.warn("⚠️  Story Protocol registration was not completed.");
        console.warn(
          "   Reason: Wallet has insufficient funds on Aeneid testnet"
        );
        console.warn(
          "   Wallet address: Check backend logs for your wallet address"
        );
        console.warn("   Solution: Get testnet tokens from a faucet");
        console.warn(
          "   - Story Foundation Faucet (Gitcoin Passport score 5+)"
        );
        console.warn("   - QuickNode Faucet (requires 0.001 ETH on mainnet)");
        console.warn("   - FaucetMe Pro (Discord connection)");
      }

      // Show success message for 3 seconds, then redirect
      setTimeout(() => {
        router.push("/dashboard");
      }, 3000);
    } catch (err: any) {
      console.error("❌ Upload error:", err);
      setError(err.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  if (!file) {
    return (
      <div className="min-h-screen bg-[#F9FAFB]">
        <TopNav currentView="upload" onChangeView={() => {}} />
        <div className="min-h-[calc(100vh-80px)] flex items-center justify-center p-6">
          <div className="w-full max-w-3xl h-[400px] border-2 border-dashed border-gray-300 hover:border-[#0033FF] rounded-3xl bg-white flex flex-col items-center justify-center relative transition-all group cursor-pointer hover:shadow-2xl hover:bg-blue-50/10">
            <input
              type="file"
              className="absolute inset-0 opacity-0 z-10 cursor-pointer"
              onChange={handleFileChange}
            />

            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-sm border border-gray-100">
              <Upload className="w-8 h-8 text-gray-400 group-hover:text-[#0033FF] transition-colors" />
            </div>
            <h2 className="text-2xl font-black text-[#0F172A] mb-2">
              Upload Asset
            </h2>
            <p className="text-gray-500 font-medium">
              Drag & drop or click to browse
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      <TopNav currentView="upload" onChangeView={() => {}} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-16 border-b border-gray-200 flex items-center justify-between px-8 bg-white">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setFile(null)}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-black transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <span className="font-bold text-sm text-[#0033FF] bg-blue-50 px-3 py-1 rounded-full uppercase tracking-wider">
              Studio
            </span>
          </div>
          <button
            onClick={handlePublish}
            disabled={!scanComplete || uploading || !authenticated || !isUnique}
            className={`px-8 py-2.5 rounded-lg font-bold text-sm uppercase tracking-wide transition-all shadow-lg ${
              scanComplete && authenticated && !uploading && isUnique
                ? "bg-[#0033FF] text-white hover:bg-blue-700 hover:shadow-blue-500/30"
                : "bg-gray-100 text-gray-400 cursor-not-allowed shadow-none"
            }`}
          >
            {uploading
              ? "Uploading..."
              : !isUnique
              ? "Duplicate Detected"
              : scanComplete
              ? "Publish IP"
              : "Analyzing..."}
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Preview Canvas */}
          <div className="flex-1 bg-gray-50 relative flex items-center justify-center p-12">
            <div className="relative shadow-2xl rounded-lg p-2 bg-white">
              <Image
                src={preview!}
                alt={title || "Preview"}
                className="max-h-[60vh] max-w-full opacity-100 rounded"
                width={1000}
                height={1000}
              />

              {/* Scanning Effect */}
              {scanning && (
                <div className="absolute inset-0 z-20 overflow-hidden rounded">
                  <div className="w-full h-1 bg-[#0033FF] shadow-[0_0_20px_#0033FF] absolute top-0 animate-[scan_2s_ease-in-out_infinite]"></div>
                  <div className="absolute bottom-4 right-4 bg-black/80 text-white px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 backdrop-blur-md">
                    <Scan className="w-4 h-4 animate-spin" /> Generating
                    Fingerprint...
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-[400px] bg-white border-l border-gray-200 flex flex-col shadow-xl z-10">
            <div className="p-8 space-y-8 overflow-y-auto">
              {/* Status */}
              <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-xs font-black text-gray-400 uppercase tracking-wider">
                    IP Protocol Status
                  </span>
                  {scanComplete ? (
                    <div className="bg-green-500 text-white p-1 rounded-full">
                      <Check className="w-3 h-3" />
                    </div>
                  ) : (
                    <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>
                  )}
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-gray-500">Hash Generation</span>
                    <span
                      className={
                        scanComplete
                          ? "text-[#0F172A] font-mono"
                          : "text-gray-400"
                      }
                    >
                      {scanComplete ? hashDisplay || "N/A" : "Pending"}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-gray-500">Uniqueness</span>
                    <span
                      className={
                        scanComplete
                          ? isUnique
                            ? "text-green-600"
                            : "text-red-600"
                          : "text-gray-400"
                      }
                    >
                      {scanComplete
                        ? isUnique
                          ? "100% Unique"
                          : "Not Unique"
                        : "Checking..."}
                    </span>
                  </div>
                  {duplicateInfo && scanComplete && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs">
                      <p className="text-red-700 font-medium">
                        {duplicateInfo.type === "exact"
                          ? "Exact duplicate"
                          : "Similar image"}{" "}
                        found:
                      </p>
                      <p className="text-red-600 mt-1">
                        "{duplicateInfo.title}" by{" "}
                        {duplicateInfo.creator.slice(0, 6)}...
                        {duplicateInfo.creator.slice(-4)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Success Message */}
              {uploadSuccess && storyIPId && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <p className="text-sm text-green-700 font-bold">
                      IP Registered on Story Protocol!
                    </p>
                  </div>
                  <div className="ml-8">
                    <p className="text-xs text-gray-600 font-medium mb-1">
                      IP ID:
                    </p>
                    <p className="text-xs text-[#0033FF] font-mono bg-blue-50 p-2 rounded break-all">
                      {storyIPId}
                    </p>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-700 font-medium">{error}</p>
                </div>
              )}

              {/* Inputs */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-2">
                    Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={uploading}
                    className="w-full bg-white border border-gray-200 rounded-lg p-3 text-[#0F172A] font-bold focus:border-[#0033FF] focus:ring-1 focus:ring-[#0033FF] outline-none transition-all disabled:opacity-50"
                    placeholder="Enter asset title"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-2">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={uploading}
                    rows={3}
                    className="w-full bg-white border border-gray-200 rounded-lg p-3 text-[#0F172A] font-medium focus:border-[#0033FF] focus:ring-1 focus:ring-[#0033FF] outline-none transition-all disabled:opacity-50 resize-none"
                    placeholder="Describe your asset..."
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-2">
                    Price (USDC)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    disabled={uploading}
                    className="w-full bg-white border border-gray-200 rounded-lg p-3 text-[#0F172A] font-bold focus:border-[#0033FF] focus:ring-1 focus:ring-[#0033FF] outline-none transition-all disabled:opacity-50"
                    placeholder="0.01"
                  />
                </div>
              </div>

              {/* Selection */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-3">
                  License Type
                </label>
                <div className="grid gap-3">
                  <div className="p-4 border-2 border-[#0033FF] bg-blue-50/30 rounded-xl cursor-pointer">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-black text-[#0F172A]">
                        Personal use
                      </span>
                      <Zap className="w-4 h-4 text-[#0033FF]" />
                    </div>
                    <span className="text-xs text-gray-500 font-medium">
                      Standard royalty model for personal use
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadFlow;
