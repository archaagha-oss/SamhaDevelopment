import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function ConfirmDialog({ open, title, message, confirmLabel = "Confirm", cancelLabel = "Cancel", variant = "danger", onConfirm, onCancel, }) {
    if (!open)
        return null;
    const confirmStyles = {
        danger: "bg-red-600 hover:bg-red-700 text-white",
        warning: "bg-amber-500 hover:bg-amber-600 text-white",
        info: "bg-blue-600 hover:bg-blue-700 text-white",
    }[variant];
    return (_jsx("div", { className: "fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4", onClick: onCancel, children: _jsxs("div", { className: "bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "px-6 py-5", children: [_jsx("h3", { className: "text-base font-semibold text-slate-900", children: title }), _jsx("p", { className: "mt-1.5 text-sm text-slate-600 leading-relaxed", children: message })] }), _jsxs("div", { className: "flex justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100", children: [_jsx("button", { onClick: onCancel, className: "px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors", children: cancelLabel }), _jsx("button", { onClick: onConfirm, className: `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${confirmStyles}`, children: confirmLabel })] })] }) }));
}
