import { useState } from "react";
import axios from "axios";
import { Upload } from "lucide-react";
import { Document, DocumentType } from "../types";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  /** Exactly one of dealId or leadId must be set. */
  dealId?: string;
  leadId?: string;
  onClose: () => void;
  onSaved: (document: Document) => void;
  /**
   * Restrict the picker to a subset of types (e.g. KYC = passport/EID/visa).
   * If omitted, the full deal-side type set is shown.
   */
  allowedTypes?: DocumentType[];
  /** Initial selected type. Defaults to first allowed type or OTHER. */
  defaultType?: DocumentType;
  /** Override modal title. */
  title?: string;
  /** Show an optional expiry-date input (KYC docs need this). */
  showExpiry?: boolean;
}

const DEAL_TYPES: DocumentType[] = ["SPA", "OQOOD_CERTIFICATE", "MORTGAGE_APPROVAL", "RESERVATION_FORM", "PAYMENT_RECEIPT", "PASSPORT", "EMIRATES_ID", "VISA", "OTHER"];
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

export default function DocumentUploadModal({
  dealId, leadId, onClose, onSaved, allowedTypes, defaultType, title, showExpiry,
}: Props) {
  const DOCUMENT_TYPES = allowedTypes ?? DEAL_TYPES;
  const [selectedType, setSelectedType] = useState<DocumentType>(defaultType ?? DOCUMENT_TYPES[0] ?? "OTHER");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [expiryDate, setExpiryDate] = useState<string>("");
  // Tier-1 KYC metadata (only shown when showExpiry — the KYC mode).
  const [documentNumber, setDocumentNumber] = useState<string>("");
  const [issueDate, setIssueDate] = useState<string>("");
  const [issuingCountry, setIssuingCountry] = useState<string>("");

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
    let hadError = false; // local — closure-captured `error` is stale, see prior bug

    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        if (dealId) formData.append("dealId", dealId);
        if (leadId) formData.append("leadId", leadId);
        formData.append("type", selectedType);
        if (showExpiry && expiryDate) formData.append("expiryDate", expiryDate);
        if (showExpiry && documentNumber) formData.append("documentNumber", documentNumber);
        if (showExpiry && issueDate)     formData.append("issueDate", issueDate);
        if (showExpiry && issuingCountry) formData.append("issuingCountry", issuingCountry);

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
        hadError = true;
        setError(err.response?.data?.error || `Failed to upload ${file.name}`);
      }
    }

    setUploading(false);
    if (!hadError) {
      setFiles([]);
      onClose();
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl p-0 gap-0" aria-describedby="doc-upload-desc">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <DialogTitle className="text-base font-bold text-foreground">{title ?? "Upload Documents"}</DialogTitle>
        </div>
        <DialogDescription id="doc-upload-desc" className="sr-only">
          Pick a document type and drop files (PDF, DOC, DOCX, JPEG, PNG, max 50MB each) to attach to this deal.
        </DialogDescription>

        <div className="px-6 py-6 space-y-6">
          {/* Document Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-2">
              Document Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {DOCUMENT_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedType === type
                      ? "bg-primary text-white"
                      : "bg-muted text-foreground hover:bg-muted"
                  }`}
                >
                  {TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          {/* Drag & Drop Zone — collapses to a small "Add more" link once
              files have been selected, so the modal doesn't show a giant
              empty dropzone next to a populated file list. */}
          <input
            type="file"
            multiple
            onChange={handleFileInput}
            className="hidden"
            id="file-input"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          />
          {files.length === 0 ? (
            <div
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? "border-primary/40 bg-info-soft"
                  : "border-border bg-muted/50 hover:border-border"
              }`}
            >
              <label htmlFor="file-input" className="cursor-pointer block">
                <Upload className="mx-auto mb-3 size-12 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">
                  {isDragActive ? "Drop files here" : "Drag files here or click to browse"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, DOC, DOCX, JPEG, PNG • Max 50MB each
                </p>
              </label>
            </div>
          ) : (
            <label
              htmlFor="file-input"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline cursor-pointer"
            >
              <Upload className="size-3.5" />
              Add more files
            </label>
          )}

          {/* KYC-specific fields (only in KYC mode). dataSnapshot persists
              documentNumber / issueDate / issuingCountry per-document; expiry
              drives the compliance radar. */}
          {showExpiry && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-muted-foreground mb-2">
                  Document number <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  placeholder="e.g. 784-1234-5678901-2"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-2">Issue date</label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-2">Expiry date</label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-muted-foreground mb-2">
                  Issuing country <span className="text-muted-foreground font-normal">(optional, ISO code or name)</span>
                </label>
                <input
                  type="text"
                  value={issuingCountry}
                  onChange={(e) => setIssuingCountry(e.target.value)}
                  placeholder="e.g. AE, IN, UK"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring"
                />
              </div>
              <p className="col-span-2 text-[11px] text-muted-foreground -mt-1">
                Expiry drives the compliance / expiry radar.
              </p>
            </div>
          )}

          {/* File List with Progress */}
          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((file, idx) => (
                <div key={`${file.name}-${idx}`} className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-foreground">{file.name}</p>
                    {!uploading && (
                      <button
                        onClick={() => removeFile(idx)}
                        className="text-destructive hover:text-destructive text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  {uploadProgress[file.name] !== undefined && (
                    <div className="w-full bg-neutral-200 rounded-full h-1.5">
                      <div
                        className="bg-primary h-1.5 rounded-full transition-all"
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
            <p className="text-sm text-destructive bg-destructive-soft px-3 py-2 rounded-lg">{error}</p>
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
