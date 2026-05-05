import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
const salesItems = [
    { page: "dashboard", label: "Dashboard", icon: "▦" },
    { page: "projects", label: "Projects", icon: "⊕" },
    { page: "units", label: "Units", icon: "⊞" },
    { page: "contacts", label: "Contacts", icon: "◎" },
    { page: "leads", label: "Leads", icon: "◉" },
    { page: "deals", label: "Deals", icon: "◈" },
    { page: "tasks", label: "Activities", icon: "✓" },
    { page: "reservations", label: "Reservations", icon: "⊗" },
    { page: "offers-list", label: "Offers", icon: "◁" },
    { page: "contracts", label: "Contracts", icon: "⊜" },
    { page: "brokers", label: "Brokers", icon: "⊛" },
];
const financeItems = [
    { page: "payments", label: "Payments", icon: "⊟" },
    { page: "payment-plans", label: "Pay. Plans", icon: "≡" },
    { page: "commissions", label: "Commissions", icon: "◇" },
    { page: "reports", label: "Reports", icon: "▤" },
];
const adminItems = [
    { page: "team", label: "Team", icon: "⊞" },
    { page: "settings", label: "Settings", icon: "⚙" },
];
function NavItem({ page, label, icon, active, collapsed, onNavigate }) {
    return (_jsxs("button", { onClick: () => onNavigate(page), title: collapsed ? label : undefined, className: `w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${active
            ? "bg-blue-600 text-white shadow-sm"
            : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"} ${collapsed ? "justify-center" : ""}`, children: [_jsx("span", { className: "text-base flex-shrink-0 w-4 text-center leading-none", children: icon }), !collapsed && _jsx("span", { className: "truncate", children: label })] }));
}
function SectionLabel({ label, collapsed }) {
    if (collapsed)
        return _jsx("div", { className: "my-1 border-t border-slate-800" });
    return (_jsx("p", { className: "px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-600", children: label }));
}
export default function Sidebar({ currentPage, onNavigate }) {
    const [collapsed, setCollapsed] = useState(false);
    return (_jsxs("div", { className: `${collapsed ? "w-14" : "w-56"} bg-slate-900 flex flex-col h-full flex-shrink-0 border-r border-slate-800 transition-all duration-200`, children: [_jsxs("div", { className: `px-3 py-4 border-b border-slate-800 flex items-center ${collapsed ? "justify-center" : "gap-2.5"}`, children: [_jsx("div", { className: "w-7 h-7 rounded-lg bg-blue-600 flex-shrink-0 flex items-center justify-center text-white text-xs font-bold", children: "S" }), !collapsed && (_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-white font-semibold text-sm leading-tight truncate", children: "Samha CRM" }), _jsx("p", { className: "text-slate-500 text-xs truncate", children: "Real Estate Pipeline" })] }))] }), _jsxs("nav", { className: "flex-1 px-2 py-2 space-y-0.5 overflow-y-auto overflow-x-hidden", children: [_jsx(SectionLabel, { label: "Sales", collapsed: collapsed }), salesItems.map(({ page, label, icon }) => (_jsx(NavItem, { page: page, label: label, icon: icon, active: currentPage === page, collapsed: collapsed, onNavigate: onNavigate }, page))), _jsx(SectionLabel, { label: "Finance", collapsed: collapsed }), financeItems.map(({ page, label, icon }) => (_jsx(NavItem, { page: page, label: label, icon: icon, active: currentPage === page, collapsed: collapsed, onNavigate: onNavigate }, page))), _jsx(SectionLabel, { label: "Admin", collapsed: collapsed }), adminItems.map(({ page, label, icon }) => (_jsx(NavItem, { page: page, label: label, icon: icon, active: currentPage === page, collapsed: collapsed, onNavigate: onNavigate }, page)))] }), _jsx("div", { className: "px-2 py-3 border-t border-slate-800", children: _jsxs("button", { onClick: () => setCollapsed((v) => !v), title: collapsed ? "Expand sidebar" : "Collapse sidebar", className: "w-full flex items-center justify-center gap-2 px-3 py-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg text-xs transition-colors", children: [_jsx("span", { className: "text-sm", children: collapsed ? "→" : "←" }), !collapsed && _jsx("span", { children: "Collapse" })] }) })] }));
}
