import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
const TYPE_LABELS = {
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
const TYPE_COLORS = {
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
const getMimeTypeIcon = (mimeType) => {
    if (mimeType.includes("pdf"))
        return "📄";
    if (mimeType.includes("word"))
        return "📋";
    if (mimeType.includes("image"))
        return "🖼️";
    return "📎";
};
const formatFileSize = (bytes) => {
    if (bytes === 0)
        return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
};
export default function DocumentBrowser({ dealId, onUpload }) {
    const [documents, setDocuments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [deleting, setDeleting] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const loadDocuments = async () => {
        setIsLoading(true);
        try {
            const response = await axios.get(`/api/documents/deal/${dealId}`);
            setDocuments(response.data.data || []);
            setError(null);
        }
        catch (err) {
            setError("Failed to load documents");
            console.error(err);
        }
        finally {
            setIsLoading(false);
        }
    };
    useEffect(() => {
        loadDocuments();
    }, [dealId]);
    const handleDownload = async (doc) => {
        try {
            const response = await axios.get(`/api/documents/${doc.id}/download`);
            window.open(response.data.url, "_blank");
        }
        catch (err) {
            toast.error("Failed to generate download link");
        }
    };
    const handleDelete = async (docId) => {
        if (!confirm("Are you sure you want to delete this document?"))
            return;
        setDeleting(docId);
        try {
            await axios.delete(`/api/documents/${docId}`);
            setDocuments((prev) => prev.filter((d) => d.id !== docId));
        }
        catch (err) {
            toast.error(err.response?.data?.error || "Failed to delete document");
        }
        finally {
            setDeleting(null);
        }
    };
    const handlePreview = async (doc) => {
        if (!doc.mimeType.includes("image")) {
            handleDownload(doc);
            return;
        }
        try {
            const response = await axios.get(`/api/documents/${doc.id}/download`);
            setPreviewUrl({ url: response.data.url, name: doc.name });
        }
        catch (err) {
            toast.error("Failed to load image");
        }
    };
    if (isLoading) {
        return (_jsxs("div", { className: "bg-white rounded-lg border border-slate-200 p-6", children: [_jsx("div", { className: "flex items-center justify-between mb-4", children: _jsx("h2", { className: "text-lg font-semibold text-slate-900", children: "Documents" }) }), _jsx("div", { className: "space-y-2", children: [1, 2, 3].map((i) => (_jsx("div", { className: "h-16 bg-slate-100 rounded-lg animate-pulse" }, i))) })] }));
    }
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "bg-white rounded-lg border border-slate-200 p-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsxs("h2", { className: "text-lg font-semibold text-slate-900", children: ["Documents (", documents.length, ")"] }), onUpload && (_jsx("button", { onClick: onUpload, className: "px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700", children: "+ Upload Document" }))] }), error && (_jsx("div", { className: "mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600", children: error })), documents.length === 0 ? (_jsx("p", { className: "text-sm text-slate-500", children: "No documents uploaded yet" })) : (_jsx("div", { className: "space-y-3", children: documents.map((doc) => (_jsxs("div", { className: "flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors", children: [_jsxs("div", { className: "flex items-center gap-3 flex-1 min-w-0", children: [_jsx("span", { className: "text-2xl flex-shrink-0", children: getMimeTypeIcon(doc.mimeType) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "text-sm font-medium text-slate-900 truncate", children: doc.name }), _jsxs("div", { className: "flex items-center gap-2 mt-1", children: [_jsx("span", { className: `text-xs px-2 py-1 rounded-full font-medium ${TYPE_COLORS[doc.type]}`, children: TYPE_LABELS[doc.type] }), _jsxs("span", { className: "text-xs text-slate-500", children: [formatFileSize(100000), " \u2022 ", new Date(doc.createdAt).toLocaleDateString("en-AE")] })] })] })] }), _jsxs("div", { className: "flex items-center gap-2 flex-shrink-0 ml-4", children: [_jsx("button", { onClick: () => handlePreview(doc), className: "p-2 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg", title: "Preview", children: "\uD83D\uDC41\uFE0F" }), _jsx("button", { onClick: () => handleDownload(doc), className: "p-2 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg", title: "Download", children: "\u2B07\uFE0F" }), _jsx("button", { onClick: () => handleDelete(doc.id), disabled: deleting === doc.id, className: "p-2 text-red-600 hover:text-red-900 hover:bg-white rounded-lg disabled:opacity-50", title: "Delete", children: deleting === doc.id ? "..." : "🗑️" })] })] }, doc.id))) }))] }), previewUrl && (_jsx("div", { className: "fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4", onClick: () => setPreviewUrl(null), children: _jsxs("div", { className: "max-w-4xl max-h-[90vh] bg-white rounded-lg overflow-hidden relative", children: [_jsx("button", { onClick: () => setPreviewUrl(null), className: "absolute top-4 right-4 bg-white/90 hover:bg-white rounded-lg p-2 z-10", children: "\u2715" }), _jsx("img", { src: previewUrl.url, alt: previewUrl.name, className: "max-w-full max-h-[90vh] object-contain", onClick: (e) => e.stopPropagation() })] }) }))] }));
}
