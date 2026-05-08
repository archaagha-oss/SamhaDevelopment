import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from "react";
const SIZE = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-2xl",
};
const FOCUSABLE = [
    "a[href]",
    "button:not([disabled])",
    "textarea:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
].join(",");
export default function Modal({ open, onClose, title, children, footer, size = "md", closeOnBackdrop = true, ariaLabel, }) {
    const dialogRef = useRef(null);
    const lastFocused = useRef(null);
    useEffect(() => {
        if (!open)
            return;
        lastFocused.current = document.activeElement;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const focusFirst = () => {
            const root = dialogRef.current;
            if (!root)
                return;
            const focusables = root.querySelectorAll(FOCUSABLE);
            const target = focusables[0] ?? root;
            target.focus();
        };
        const t = setTimeout(focusFirst, 0);
        const onKeyDown = (e) => {
            if (e.key === "Escape") {
                e.stopPropagation();
                onClose();
                return;
            }
            if (e.key !== "Tab")
                return;
            const root = dialogRef.current;
            if (!root)
                return;
            const focusables = Array.from(root.querySelectorAll(FOCUSABLE)).filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);
            if (focusables.length === 0) {
                e.preventDefault();
                return;
            }
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            const active = document.activeElement;
            if (e.shiftKey && active === first) {
                e.preventDefault();
                last.focus();
            }
            else if (!e.shiftKey && active === last) {
                e.preventDefault();
                first.focus();
            }
        };
        document.addEventListener("keydown", onKeyDown);
        return () => {
            clearTimeout(t);
            document.removeEventListener("keydown", onKeyDown);
            document.body.style.overflow = prevOverflow;
            lastFocused.current?.focus?.();
        };
    }, [open, onClose]);
    if (!open)
        return null;
    return (_jsx("div", { className: "fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4", onClick: () => closeOnBackdrop && onClose(), children: _jsxs("div", { ref: dialogRef, role: "dialog", "aria-modal": "true", "aria-label": typeof title === "string" ? title : ariaLabel, tabIndex: -1, onClick: (e) => e.stopPropagation(), className: `bg-white rounded-xl shadow-2xl w-full ${SIZE[size]} max-h-[90vh] flex flex-col overflow-hidden focus:outline-none`, children: [title && (_jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0", children: [typeof title === "string" ? (_jsx("h2", { className: "font-semibold text-slate-900 text-sm", children: title })) : title, _jsx("button", { type: "button", onClick: onClose, "aria-label": "Close dialog", className: "text-slate-400 hover:text-slate-700 text-xl leading-none p-1 -m-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-400", children: "\u00D7" })] })), _jsx("div", { className: "flex-1 overflow-y-auto", children: children }), footer && (_jsx("div", { className: "flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50 flex-shrink-0", children: footer }))] }) }));
}
