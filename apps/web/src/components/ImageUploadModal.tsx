import { useState, useRef } from "react";
import axios from "axios";

interface Props {
  unitId: string;
  onClose: () => void;
  onUploadSuccess: () => void;
}

export default function ImageUploadModal({ unitId, onClose, onUploadSuccess }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [type, setType] = useState("PHOTO");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(selectedFile.type)) {
      setError("Only JPEG, PNG, and WebP images are allowed");
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("File size must be less than 10MB");
      return;
    }

    setFile(selectedFile);
    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      const input = fileInputRef.current;
      if (input) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(droppedFile);
        input.files = dataTransfer.files;
        handleFileSelect({ target: input } as any);
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("caption", caption);
      formData.append("type", type);

      await axios.post(`/api/units/${unitId}/images`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setFile(null);
      setCaption("");
      setType("PHOTO");
      setPreview(null);
      onUploadSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-900">Upload Image</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
            type="button"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Drop Zone */}
          <div
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.currentTarget.classList.remove("bg-blue-50");
              handleDrop(e);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.currentTarget.classList.add("bg-blue-50");
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.currentTarget.classList.remove("bg-blue-50");
            }}
            className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer transition-colors relative"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />

            {preview ? (
              <div>
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full h-40 object-cover rounded-lg mb-3"
                />
                <p className="text-sm text-slate-600">
                  {file?.name}
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setFile(null);
                    setPreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="text-blue-600 hover:text-blue-800 text-xs mt-2 font-medium"
                >
                  Change file
                </button>
              </div>
            ) : (
              <div>
                <p className="text-2xl mb-2">📸</p>
                <p className="text-sm font-medium text-slate-900 mb-1">
                  Drop image here or click to select
                </p>
                <p className="text-xs text-slate-500">
                  JPEG, PNG, or WebP up to 10MB
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </div>

          {/* Caption */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Caption (optional)
            </label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="e.g. Living room view"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>

          {/* Image Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Image Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            >
              <option value="PHOTO">Photo</option>
              <option value="FLOOR_PLAN">Floor Plan</option>
              <option value="FLOOR_MAP">Floor Location Map</option>
            </select>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-3 border-t border-slate-100 flex gap-2">
          <button
            onClick={onClose}
            disabled={uploading}
            className="flex-1 px-3 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="flex-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}
