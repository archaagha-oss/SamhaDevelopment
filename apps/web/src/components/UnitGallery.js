import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
export default function UnitGallery({ images, onDelete, onUpload }) {
    const [lightboxIndex, setLightboxIndex] = useState(null);
    const [deleting, setDeleting] = useState(null);
    if (images.length === 0)
        return null;
    const currentImage = lightboxIndex !== null ? images[lightboxIndex] : null;
    const goToPrevious = () => {
        setLightboxIndex((idx) => {
            if (idx === null)
                return null;
            return idx === 0 ? images.length - 1 : idx - 1;
        });
    };
    const goToNext = () => {
        setLightboxIndex((idx) => {
            if (idx === null)
                return null;
            return idx === images.length - 1 ? 0 : idx + 1;
        });
    };
    const handleKeyDown = (e) => {
        if (e.key === "ArrowLeft")
            goToPrevious();
        else if (e.key === "ArrowRight")
            goToNext();
        else if (e.key === "Escape")
            setLightboxIndex(null);
    };
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "px-6 py-3 border-b border-slate-100", children: _jsxs("div", { className: "flex gap-2 overflow-x-auto pb-2", children: [images.map((img, idx) => (_jsxs("div", { className: "flex-shrink-0 relative group", children: [_jsx("button", { onClick: () => setLightboxIndex(idx), className: `w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors ${lightboxIndex === idx ? "border-blue-500" : "border-slate-200"} hover:border-blue-400`, children: _jsx("img", { src: img.url, alt: img.caption || "Unit", className: "w-full h-full object-cover" }) }), onDelete && (_jsx("button", { onClick: async () => {
                                        setDeleting(img.id);
                                        try {
                                            await onDelete(img.id);
                                        }
                                        finally {
                                            setDeleting(null);
                                        }
                                    }, disabled: deleting === img.id, className: "absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50", title: "Delete image", children: "\u00D7" }))] }, img.id))), onUpload && (_jsx("button", { onClick: onUpload, className: "flex-shrink-0 w-20 h-20 rounded-lg border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50 flex items-center justify-center text-2xl transition-colors", title: "Upload image", children: "+" }))] }) }), currentImage && (_jsx("div", { className: "fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4", onClick: () => setLightboxIndex(null), onKeyDown: handleKeyDown, role: "dialog", tabIndex: -1, children: _jsxs("div", { className: "bg-black rounded-lg max-w-4xl w-full overflow-hidden", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "relative", children: [_jsx("img", { src: currentImage.url, alt: currentImage.caption || "Unit", className: "w-full h-auto max-h-[70vh] object-contain" }), _jsx("span", { className: "absolute top-4 left-4 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-900/70 text-white", children: currentImage.type === "PHOTO" ? "📷 Photo" : "📐 Floor Plan" }), _jsx("button", { onClick: goToPrevious, className: "absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg transition-colors", children: "\u2190" }), _jsx("button", { onClick: goToNext, className: "absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg transition-colors", children: "\u2192" }), _jsx("button", { onClick: () => setLightboxIndex(null), className: "absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg transition-colors", children: "\u2715" }), _jsxs("div", { className: "absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/70 text-white text-xs px-3 py-1.5 rounded-full", children: [lightboxIndex + 1, " / ", images.length] })] }), currentImage.caption && (_jsx("div", { className: "bg-slate-900 px-4 py-3 text-sm text-slate-100", children: currentImage.caption }))] }) }))] }));
}
