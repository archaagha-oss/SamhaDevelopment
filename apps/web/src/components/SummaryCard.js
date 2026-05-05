import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function SummaryCard({ label, value, color }) {
    return (_jsxs("div", { className: "bg-white rounded-lg shadow p-4", children: [_jsx("p", { className: "text-sm text-gray-600 mb-2", children: label }), _jsx("div", { className: "flex items-end gap-2", children: _jsx("span", { className: `text-3xl font-bold text-white px-4 py-2 rounded ${color}`, children: value }) })] }));
}
