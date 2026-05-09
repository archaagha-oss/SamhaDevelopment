import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Document } from "../types";

interface Props {
  dealId: string;
  onUpload?: () => void;
}

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

const TYPE_COLORS: Record<string, string> = {
  SPA: "bg-info-soft text-primary",
  OQOOD_CERTIFICATE: "bg-chart-7/15 text-chart-7",
  MORTGAGE_APPROVAL: "bg-success-soft text-success",
  RESERVATION_FORM: "bg-warning-soft text-warning",
  PAYMENT_RECEIPT: "bg-success-soft text-success",
  PASSPORT: "bg-chart-7/15 text-chart-7",
  EMIRATES_ID: "bg-stage-active text-stage-active-foreground",
  VISA: "bg-chart-5/15 text-chart-5",
  OTHER: "bg-muted text-foreground",
};

const getMimeTypeIcon = (mimeType: string) => {
  if (mimeType.includes("pdf")) return "📄";
  if (mimeType.includes("word")) return "📋";
  if (mimeType.includes("image")) return "🖼️";
  return "📎";
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
};

export default function DocumentBrowser({ dealId, onUpload }: Props) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<{ url: string; name: string } | null>(null);

  const loadDocuments = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`/api/documents/deal/${dealId}`);
      setDocuments(response.data.data || []);
      setError(null);
    } catch (err: any) {
      setError("Failed to load documents");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [dealId]);

  const handleDownload = async (doc: Document) => {
    try {
      const response = await axios.get(`/api/documents/${doc.id}/download`);
      window.open(response.data.url, "_blank");
    } catch (err) {
      toast.error("Failed to generate download link");
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;

    setDeleting(docId);
    try {
      await axios.delete(`/api/documents/${docId}`);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to delete document");
    } finally {
      setDeleting(null);
    }
  };

  const handlePreview = async (doc: Document) => {
    if (!doc.mimeType.includes("image")) {
      handleDownload(doc);
      return;
    }

    try {
      const response = await axios.get(`/api/documents/${doc.id}/download`);
      setPreviewUrl({ url: response.data.url, name: doc.name });
    } catch (err) {
      toast.error("Failed to load image");
    }
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Documents</h2>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-card rounded-lg border border-border p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-foreground">Documents ({documents.length})</h2>
          {onUpload && (
            <button
              onClick={onUpload}
              className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90"
            >
              + Upload Document
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-destructive-soft border border-destructive/30 rounded-lg text-sm text-destructive">
            {error}
          </div>
        )}

        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents uploaded yet</p>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-2xl flex-shrink-0">{getMimeTypeIcon(doc.mimeType)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${TYPE_COLORS[doc.type]}`}>
                        {TYPE_LABELS[doc.type]}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatFileSize(100000)} • {new Date(doc.createdAt).toLocaleDateString("en-AE")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                  <button
                    onClick={() => handlePreview(doc)}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-card rounded-lg"
                    title="Preview"
                  >
                    👁️
                  </button>
                  <button
                    onClick={() => handleDownload(doc)}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-card rounded-lg"
                    title="Download"
                  >
                    ⬇️
                  </button>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    disabled={deleting === doc.id}
                    className="p-2 text-destructive hover:text-destructive hover:bg-card rounded-lg disabled:opacity-50"
                    title="Delete"
                  >
                    {deleting === doc.id ? "..." : "🗑️"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Image Preview Modal */}
      {previewUrl && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <div className="max-w-4xl max-h-[90vh] bg-card rounded-lg overflow-hidden relative">
            <button
              onClick={() => setPreviewUrl(null)}
              className="absolute top-4 right-4 bg-white/90 hover:bg-card rounded-lg p-2 z-10"
            >
              ✕
            </button>
            <img
              src={previewUrl.url}
              alt={previewUrl.name}
              className="max-w-full max-h-[90vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
}
