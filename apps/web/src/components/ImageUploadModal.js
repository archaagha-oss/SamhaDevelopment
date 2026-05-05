import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef } from "react";
import axios from "axios";
export default function ImageUploadModal({ unitId, onClose, onUploadSuccess }) {
    const [file, setFile] = useState(null);
    const [caption, setCaption] = useState("");
    const [type, setType] = useState("PHOTO");
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const [preview, setPreview] = useState(null);
    const fileInputRef = useRef(null);
    const handleFileSelect = (e) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile)
            return;
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
            setPreview(e.target?.result);
        };
        reader.readAsDataURL(selectedFile);
    };
    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            const input = fileInputRef.current;
            if (input) {
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(droppedFile);
                input.files = dataTransfer.files;
                handleFileSelect({ target: input });
            }
        }
    };
    const handleUpload = async () => {
        if (!file)
            return;
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
        }
        catch (err) {
            setError(err.response?.data?.error || "Failed to upload image");
        }
        finally {
            setUploading(false);
        }
    };
    return (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4", onClick: onClose, children: _jsxs("div", { className: "bg-white rounded-2xl w-full max-w-md shadow-2xl", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b border-slate-100", children: [_jsx("h2", { className: "font-bold text-slate-900", children: "Upload Image" }), _jsx("button", { onClick: onClose, className: "text-slate-400 hover:text-slate-600 text-2xl leading-none", type: "button", children: "\u00D7" })] }), _jsxs("div", { className: "px-6 py-4 space-y-4", children: [_jsxs("div", { onDrop: (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                e.currentTarget.classList.remove("bg-blue-50");
                                handleDrop(e);
                            }, onDragOver: (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                e.currentTarget.classList.add("bg-blue-50");
                            }, onDragLeave: (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                e.currentTarget.classList.remove("bg-blue-50");
                            }, className: "border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer transition-colors relative", children: [_jsx("input", { ref: fileInputRef, type: "file", accept: "image/jpeg,image/png,image/webp", onChange: handleFileSelect, className: "hidden" }), preview ? (_jsxs("div", { children: [_jsx("img", { src: preview, alt: "Preview", className: "w-full h-40 object-cover rounded-lg mb-3" }), _jsx("p", { className: "text-sm text-slate-600", children: file?.name }), _jsx("button", { type: "button", onClick: (e) => {
                                                e.preventDefault();
                                                setFile(null);
                                                setPreview(null);
                                                if (fileInputRef.current)
                                                    fileInputRef.current.value = "";
                                            }, className: "text-blue-600 hover:text-blue-800 text-xs mt-2 font-medium", children: "Change file" })] })) : (_jsxs("div", { children: [_jsx("p", { className: "text-2xl mb-2", children: "\uD83D\uDCF8" }), _jsx("p", { className: "text-sm font-medium text-slate-900 mb-1", children: "Drop image here or click to select" }), _jsx("p", { className: "text-xs text-slate-500", children: "JPEG, PNG, or WebP up to 10MB" })] })), _jsx("button", { type: "button", onClick: (e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        fileInputRef.current?.click();
                                    }, className: "absolute inset-0 opacity-0 cursor-pointer" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Caption (optional)" }), _jsx("input", { type: "text", value: caption, onChange: (e) => setCaption(e.target.value), placeholder: "e.g. Living room view", className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Image Type" }), _jsxs("select", { value: type, onChange: (e) => setType(e.target.value), className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400", children: [_jsx("option", { value: "PHOTO", children: "Photo" }), _jsx("option", { value: "FLOOR_PLAN", children: "Floor Plan" }), _jsx("option", { value: "FLOOR_MAP", children: "Floor Location Map" })] })] }), error && (_jsx("div", { className: "bg-red-50 border border-red-200 rounded-lg p-3", children: _jsx("p", { className: "text-red-700 text-sm", children: error }) }))] }), _jsxs("div", { className: "px-6 py-3 border-t border-slate-100 flex gap-2", children: [_jsx("button", { onClick: onClose, disabled: uploading, className: "flex-1 px-3 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50", children: "Cancel" }), _jsx("button", { onClick: handleUpload, disabled: !file || uploading, className: "flex-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed", children: uploading ? "Uploading..." : "Upload" })] })] }) }));
}
