import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import UnitsTable from "./UnitsTable";
import Breadcrumbs from "./Breadcrumbs";
export default function UnitsPage() {
    return (_jsxs("div", { className: "flex flex-col h-full", children: [_jsxs("div", { className: "px-4 sm:px-6 py-4 bg-white border-b border-slate-200 flex-shrink-0", children: [_jsx(Breadcrumbs, { variant: "light", className: "mb-2", crumbs: [{ label: "Home", path: "/" }, { label: "Units" }] }), _jsx("h1", { className: "text-lg font-bold text-slate-900", children: "Units" }), _jsx("p", { className: "text-slate-400 text-xs mt-0.5", children: "All inventory across all projects" })] }), _jsx("div", { className: "flex-1 overflow-hidden", children: _jsx(UnitsTable, {}) })] }));
}
