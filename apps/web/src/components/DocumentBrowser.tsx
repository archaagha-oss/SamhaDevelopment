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
  SPA: "bg-blue-100 text-blue-700",
  OQOOD_CERTIFICATE: "bg-purple-100 text-purple-700",
  MORTGAGE_APPROVAL: "bg-green-100 text-green-700",
  RESERVATION_FORM: "bg-orange-100 text-orange-700",
  PAYMENT_RECEIPT: "bg-emerald-100 text-emerald-700",
  PASSPORT: "bg-pink-100 text-pink-700",
  EMIRATES_ID: "bg-indigo-100 text-indigo-700",
  VISA: "bg-teal-100 text-teal-700",
  OTHER: "bg-slate-100 text-slate-700",
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
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Documents</h2>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-slate-900">Documents ({documents.length})</h2>
          {onUpload && (
            <button
              onClick={onUpload}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              + Upload Document
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        {documents.length === 0 ? (
          <p className="text-sm text-slate-500">No documents uploaded yet</p>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-2xl flex-shrink-0">{getMimeTypeIcon(doc.mimeType)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">{doc.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${TYPE_COLORS[doc.type]}`}>
                        {TYPE_LABELS[doc.type]}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatFileSize(100000)} • {new Date(doc.createdAt).toLocaleDateString("en-AE")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                  <button
                    onClick={() => handlePreview(doc)}
                    className="p-2 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg"
                    title="Preview"
                  >
                    👁️
                  </button>
                  <button
                    onClick={() => handleDownload(doc)}
                    className="p-2 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg"
                    title="Download"
                  >
                    ⬇️
                  </button>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    disabled={deleting === doc.id}
                    className="p-2 text-red-600 hover:text-red-900 hover:bg-white rounded-lg disabled:opacity-50"
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
          <div className="max-w-4xl max-h-[90vh] bg-white rounded-lg overflow-hidden relative">
            <button
              onClick={() => setPreviewUrl(null)}
              className="absolute top-4 right-4 bg-white/90 hover:bg-white rounded-lg p-2 z-10"
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
