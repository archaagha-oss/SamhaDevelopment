import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * MetricsCard - Reusable KPI card component
 * Used for displaying key financial metrics
 *
 * Features:
 * - Flexible sizing (responsive grid)
 * - Trend indicators (up/down/stable)
 * - Optional click handler for drill-down
 * - Customizable styling
 */
export default function MetricsCard({ label, value, subtext, trend = "stable", icon, onClick, className = "", }) {
    const trendClass = {
        up: "text-emerald-600 bg-emerald-50",
        down: "text-red-600 bg-red-50",
        stable: "text-slate-600 bg-slate-50",
    };
    const trendIcon = {
        up: "↑",
        down: "↓",
        stable: "→",
    };
    return (_jsxs("div", { onClick: onClick, className: `
        bg-white border border-slate-200 rounded-lg p-6 transition-all
        ${onClick ? "cursor-pointer hover:shadow-md hover:border-slate-300" : ""}
        ${className}
      `, children: [_jsxs("div", { className: "flex items-start justify-between mb-4", children: [_jsx("h3", { className: "text-xs font-semibold text-slate-600 uppercase tracking-wide", children: label }), icon && _jsx("div", { className: "text-xl text-slate-400", children: icon })] }), _jsx("p", { className: "text-2xl font-bold text-slate-900 mb-2", children: value }), _jsxs("div", { className: "flex items-center justify-between", children: [subtext && _jsx("p", { className: "text-xs text-slate-600", children: subtext }), trend && (_jsx("span", { className: `inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${trendClass[trend]}`, children: _jsx("span", { children: trendIcon[trend] }) }))] })] }));
}
