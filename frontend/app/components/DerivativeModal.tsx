'use client';
import React, { useState } from 'react';
import { X, Upload, Loader, AlertCircle, Info } from 'lucide-react';
import { Asset } from '../types';
import { registerDerivative } from '@/lib/api-client';
import { useWallets } from '@privy-io/react-auth';

interface DerivativeModalProps {
  parentAsset: Asset;
  onClose: () => void;
  onSuccess: (derivativeId: string) => void;
}

export const DerivativeModal: React.FC<DerivativeModalProps> = ({
  parentAsset,
  onClose,
  onSuccess,
}) => {
  const { wallets } = useWallets();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [derivationType, setDerivationType] = useState<'remix' | 'edit' | 'enhancement' | 'composite'>('remix');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      setError('Please select a file');
      return;
    }

    if (!title.trim()) {
      setError('Please enter a title');
      return;
    }

    if (!wallets[0]?.address) {
      setError('Please connect your wallet');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const result = await registerDerivative({
        parentAssetId: parentAsset.id,
        derivedFile: file,
        derivedFileName: file.name,
        derivationType,
        title: title.trim(),
        description: description.trim() || undefined,
        creatorAddress: wallets[0].address,
        revenueSplitPercentage: 10, // Default 10% to parent
      });

      console.log('✅ Derivative registered successfully!', result);
      onSuccess(result.derivedAssetId);
      onClose();
    } catch (err: any) {
      console.error('❌ Derivative registration failed:', err);
      setError(err.message || 'Failed to register derivative. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-[#0F172A]">Create Remix</h2>
            <p className="text-sm text-gray-500 mt-1">Create a derivative work from "{parentAsset.title}"</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={uploading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Revenue Split Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-bold text-blue-900 mb-1">Revenue Split</p>
                <p className="text-xs text-blue-700">
                  When your remix is sold, <span className="font-bold">10%</span> of the revenue will automatically go to the original creator ({parentAsset.creator?.name || 'Original Creator'}), and you'll receive <span className="font-bold">90%</span>. This is enforced by Story Protocol.
                </p>
              </div>
            </div>
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Upload Your Remix <span className="text-red-500">*</span>
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-[#0033FF] transition-colors">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                id="derivative-file"
                disabled={uploading}
              />
              <label
                htmlFor="derivative-file"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                {preview ? (
                  <div className="relative w-full max-w-md mx-auto">
                    <img
                      src={preview}
                      alt="Preview"
                      className="w-full h-auto rounded-lg max-h-64 object-contain"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                        setPreview(null);
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-12 h-12 text-gray-400" />
                    <p className="text-sm text-gray-600 font-medium">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-gray-500">PNG, JPG, WEBP up to 10MB</p>
                  </>
                )}
              </label>
            </div>
            {file && (
              <p className="text-xs text-gray-500 mt-2">
                Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Sunset with Quote"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0033FF] focus:border-transparent"
              required
              disabled={uploading}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your remix..."
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0033FF] focus:border-transparent resize-none"
              disabled={uploading}
            />
          </div>

          {/* Derivation Type */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Type
            </label>
            <select
              value={derivationType}
              onChange={(e) => setDerivationType(e.target.value as any)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0033FF] focus:border-transparent"
              disabled={uploading}
            >
              <option value="remix">Remix (additions/modifications)</option>
              <option value="edit">Edit (color correction, cropping)</option>
              <option value="enhancement">Enhancement (upscaling, style transfer)</option>
              <option value="composite">Composite (combining multiple assets)</option>
            </select>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition-colors"
              disabled={uploading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-[#0033FF] text-white font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              disabled={uploading || !file || !title.trim()}
            >
              {uploading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Registering...
                </>
              ) : (
                'Register Derivative'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

