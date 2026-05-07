import { useState } from "react";
import axios from "axios";
import { Document, DocumentType } from "../types";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  dealId: string;
  onClose: () => void;
  onSaved: (document: Document) => void;
}

const DOCUMENT_TYPES: DocumentType[] = ["SPA", "OQOOD_CERTIFICATE", "MORTGAGE_APPROVAL", "RESERVATION_FORM", "PAYMENT_RECEIPT", "PASSPORT", "EMIRATES_ID", "VISA", "OTHER"];
const TYPE_LABELS: Record<string, string> = {
  SPA: "Sales Purchase Agreement",
  OQOOD_CERTIFICATE: "RERA Registration",
  MORTGAGE_APPROVAL: "Mortgage Documents",
  RESERVATION_FORM: "Reservation Form",
  PAYMENT_RECEIPT: "Payment Receipt",
  PASSPORT: "Passport",
  EMIRATES_ID: "Emirates ID",
  VISA: "Visa",
  OTHER: "Other",
};

export default function DocumentUploadModal({ dealId, onClose, onSaved }: Props) {
  const [selectedType, setSelectedType] = useState<DocumentType>("OTHER");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    setError(null);

    const droppedFiles = Array.from(e.dataTransfer.files);
    const validFiles = droppedFiles.filter((file) => {
      if (file.size > 52428800) {
        setError(`${file.name} is too large (max 50MB)`);
        return false;
      }
      const validTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "image/jpeg",
        "image/png",
      ];
      if (!validTypes.includes(file.type)) {
        setError(`${file.name} has invalid file type`);
        return false;
      }
      return true;
    });

    setFiles((prev) => [...prev, ...validFiles]);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setError(null);
    const validFiles = selectedFiles.filter((file) => {
      if (file.size > 52428800) {
        setError(`${file.name} is too large (max 50MB)`);
        return false;
      }
      return true;
    });
    setFiles((prev) => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setError("Please select at least one file");
      return;
    }

    setUploading(true);
    setError(null);

    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("dealId", dealId);
        formData.append("type", selectedType);

        setUploadProgress((prev) => ({ ...prev, [file.name]: 0 }));

        const response = await axios.post("/api/documents/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percentCompleted = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );
              setUploadProgress((prev) => ({
                ...prev,
                [file.name]: percentCompleted,
              }));
            }
          },
        });

        onSaved(response.data);
      } catch (err: any) {
        setError(err.response?.data?.error || `Failed to upload ${file.name}`);
      }
    }

    setUploading(false);
    if (error === null) {
      setFiles([]);
      onClose();
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl p-0 gap-0">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-foreground">Upload Documents</h2>
        </div>

        <div className="px-6 py-6 space-y-6">
          {/* Document Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">
              Document Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {DOCUMENT_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedType === type
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          {/* Drag & Drop Zone */}
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? "border-blue-400 bg-blue-50"
                : "border-slate-200 bg-slate-50 hover:border-slate-300"
            }`}
          >
            <input
              type="file"
              multiple
              onChange={handleFileInput}
              className="hidden"
              id="file-input"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            />
            <label htmlFor="file-input" className="cursor-pointer block">
              <svg
                className="w-12 h-12 mx-auto text-slate-400 mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <p className="text-sm font-medium text-slate-900">
                {isDragActive ? "Drop files here" : "Drag files here or click to browse"}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                PDF, DOC, DOCX, JPEG, PNG • Max 50MB each
              </p>
            </label>
          </div>

          {/* File List with Progress */}
          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((file, idx) => (
                <div key={`${file.name}-${idx}`} className="bg-slate-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-slate-900">{file.name}</p>
                    {!uploading && (
                      <button
                        onClick={() => removeFile(idx)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mb-2">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  {uploadProgress[file.name] !== undefined && (
                    <div className="w-full bg-slate-200 rounded-full h-1.5">
                      <div
                        className="bg-blue-600 h-1.5 rounded-full transition-all"
                        style={{ width: `${uploadProgress[file.name]}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 py-4 border-t">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={uploading}>
            Cancel
          </Button>
          <Button type="button" className="flex-1" onClick={handleUpload} disabled={uploading || files.length === 0}>
            {uploading ? "Uploading…" : "Upload"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
