import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
const ROUNDED = {
    sm: "rounded",
    md: "rounded-md",
    lg: "rounded-lg",
    xl: "rounded-xl",
    full: "rounded-full",
};
export function Skeleton({ className = "h-4 w-full", rounded = "md", ariaLabel }) {
    return (_jsx("span", { role: "status", "aria-label": ariaLabel ?? "Loading", "aria-busy": "true", className: `inline-block bg-slate-200/70 animate-pulse ${ROUNDED[rounded]} ${className}` }));
}
export function SkeletonTableRows({ rows = 5, cols = 5 }) {
    return (_jsx(_Fragment, { children: Array.from({ length: rows }).map((_, r) => (_jsx("tr", { className: "border-b border-slate-100 last:border-b-0", children: Array.from({ length: cols }).map((__, c) => (_jsx("td", { className: "px-4 py-3", children: _jsx(Skeleton, { className: "h-3 w-full max-w-[200px]" }) }, c))) }, r))) }));
}
export function SkeletonCard() {
    return (_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-5 space-y-3", children: [_jsx(Skeleton, { className: "h-5 w-1/2" }), _jsx(Skeleton, { className: "h-3 w-3/4" }), _jsx(Skeleton, { className: "h-3 w-2/3" }), _jsxs("div", { className: "grid grid-cols-2 gap-3 pt-2", children: [_jsx(Skeleton, { className: "h-16 w-full", rounded: "lg" }), _jsx(Skeleton, { className: "h-16 w-full", rounded: "lg" })] })] }));
}
export function SkeletonKpi() {
    return (_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-4 space-y-2", children: [_jsx(Skeleton, { className: "h-3 w-1/3" }), _jsx(Skeleton, { className: "h-7 w-1/2" }), _jsx(Skeleton, { className: "h-3 w-2/5" })] }));
}
export default Skeleton;
