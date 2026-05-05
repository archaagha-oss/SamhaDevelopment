import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useNavigate } from "react-router-dom";
export default function Breadcrumbs({ crumbs }) {
    const navigate = useNavigate();
    return (_jsx("nav", { className: "flex items-center gap-1.5 text-sm mb-4", "aria-label": "Breadcrumb", children: crumbs.map((crumb, i) => {
            const isLast = i === crumbs.length - 1;
            return (_jsxs("span", { className: "flex items-center gap-1.5", children: [i > 0 && _jsx("span", { className: "text-slate-500", children: "/" }), !isLast && crumb.path ? (_jsx("button", { onClick: () => navigate(crumb.path), className: "text-blue-400 hover:text-blue-300 hover:underline transition-colors", children: crumb.label })) : (_jsx("span", { className: isLast ? "text-slate-200 font-medium" : "text-slate-400", children: crumb.label }))] }, i));
        }) }));
}
