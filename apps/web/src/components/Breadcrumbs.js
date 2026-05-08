import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useNavigate } from "react-router-dom";
const STYLES = {
    dark: {
        sep: "text-slate-500",
        link: "text-blue-400 hover:text-blue-300",
        current: "text-slate-200",
        other: "text-slate-400",
    },
    light: {
        sep: "text-slate-300",
        link: "text-blue-600 hover:text-blue-700",
        current: "text-slate-800",
        other: "text-slate-500",
    },
};
export default function Breadcrumbs({ crumbs, variant = "dark", className = "" }) {
    const navigate = useNavigate();
    const s = STYLES[variant];
    return (_jsx("nav", { className: `flex items-center gap-1.5 text-xs sm:text-sm ${className}`, "aria-label": "Breadcrumb", children: _jsx("ol", { className: "flex items-center gap-1.5 flex-wrap min-w-0", children: crumbs.map((crumb, i) => {
                const isLast = i === crumbs.length - 1;
                // Hide intermediate crumbs on very small screens; show first + last when multiple.
                const isIntermediate = i > 0 && !isLast && crumbs.length > 2;
                return (_jsxs("li", { className: `flex items-center gap-1.5 min-w-0 ${isIntermediate ? "hidden sm:flex" : ""}`, children: [i > 0 && _jsx("span", { "aria-hidden": "true", className: s.sep, children: "/" }), !isLast && crumb.path ? (_jsx("button", { onClick: () => navigate(crumb.path), className: `${s.link} hover:underline transition-colors truncate max-w-[10rem]`, children: crumb.label })) : (_jsx("span", { "aria-current": isLast ? "page" : undefined, className: `${isLast ? s.current + " font-medium" : s.other} truncate max-w-[14rem]`, children: crumb.label }))] }, i));
            }) }) }));
}
