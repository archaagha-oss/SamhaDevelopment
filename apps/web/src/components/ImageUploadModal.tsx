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
      <div className="bg-card rounded-2xl w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-bold text-foreground">Upload Image</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-2xl leading-none"
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
              e.currentTarget.classList.remove("bg-info-soft");
              handleDrop(e);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.currentTarget.classList.add("bg-info-soft");
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.currentTarget.classList.remove("bg-info-soft");
            }}
            className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer transition-colors relative"
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
                <p className="text-sm text-muted-foreground">
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
                  className="text-primary hover:text-primary text-xs mt-2 font-medium"
                >
                  Change file
                </button>
              </div>
            ) : (
              <div>
                <p className="text-2xl mb-2">📸</p>
                <p className="text-sm font-medium text-foreground mb-1">
                  Drop image here or click to select
                </p>
                <p className="text-xs text-muted-foreground">
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
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Caption (optional)
            </label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="e.g. Living room view"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ring"
            />
          </div>

          {/* Image Type */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Image Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ring"
            >
              <option value="PHOTO">Photo</option>
              <option value="FLOOR_PLAN">Floor Plan</option>
              <option value="FLOOR_MAP">Floor Location Map</option>
              <optgroup label="SPA Schedules">
                <option value="SCHEDULE_DIMENSIONED">Schedule 1 — Dimensioned plan</option>
                <option value="SCHEDULE_FURNISHED">Schedule 1 — Furnished plan</option>
                <option value="SCHEDULE_FLOOR_PLAN">Schedule 3 — Floor plan</option>
              </optgroup>
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Schedule images appear automatically in the generated SPA. One image per schedule type per unit.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-destructive-soft border border-destructive/30 rounded-lg p-3">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-3 border-t border-border flex gap-2">
          <button
            onClick={onClose}
            disabled={uploading}
            className="flex-1 px-3 py-2 text-sm font-medium text-foreground border border-border rounded-lg hover:bg-muted/50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="flex-1 px-3 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}
