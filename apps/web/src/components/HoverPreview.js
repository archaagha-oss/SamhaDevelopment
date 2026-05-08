import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useEffect } from "react";
/**
 * Hover-zoom wrapper. Displays `src` enlarged in a fixed overlay positioned
 * next to the cursor while the user hovers the trigger. Cleans up on leave,
 * blur, scroll, and route change. Falls through clicks to the trigger.
 *
 * Used by UnitsTable.tsx to preview floor plans without opening the detail page.
 */
export default function HoverPreview({ src, caption, children, size = 360, disabled }) {
    const [pos, setPos] = useState(null);
    const triggerRef = useRef(null);
    useEffect(() => {
        if (!pos)
            return;
        const dismiss = () => setPos(null);
        window.addEventListener("scroll", dismiss, true);
        window.addEventListener("blur", dismiss);
        return () => {
            window.removeEventListener("scroll", dismiss, true);
            window.removeEventListener("blur", dismiss);
        };
    }, [pos]);
    if (disabled)
        return _jsx(_Fragment, { children: children });
    // Position the overlay so it doesn't run off the right or bottom edge.
    const overlayStyle = pos
        ? (() => {
            const margin = 12;
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const left = pos.x + margin + size > vw ? pos.x - size - margin : pos.x + margin;
            const top = pos.y + margin + size > vh ? pos.y - size - margin : pos.y + margin;
            return { left: Math.max(margin, left), top: Math.max(margin, top), width: size, height: size };
        })()
        : undefined;
    return (_jsxs(_Fragment, { children: [_jsx("span", { ref: triggerRef, onMouseEnter: (e) => setPos({ x: e.clientX, y: e.clientY }), onMouseMove: (e) => setPos({ x: e.clientX, y: e.clientY }), onMouseLeave: () => setPos(null), onFocus: (e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    setPos({ x: r.right, y: r.top });
                }, onBlur: () => setPos(null), className: "inline-block align-middle", children: children }), pos && (_jsxs("div", { className: "fixed z-50 rounded-lg overflow-hidden shadow-2xl ring-1 ring-slate-900/10 bg-white pointer-events-none", style: overlayStyle, role: "tooltip", children: [_jsx("img", { src: src, alt: caption || "Preview", className: "w-full h-full object-contain bg-slate-50", draggable: false }), caption && (_jsx("div", { className: "absolute bottom-0 left-0 right-0 bg-slate-900/80 text-white text-xs px-2 py-1 truncate", children: caption }))] }))] }));
}
