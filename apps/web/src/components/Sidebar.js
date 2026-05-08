import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import axios from "axios";
import { IconDashboard, IconBuilding, IconGrid, IconUsers, IconUser, IconHandshake, IconCheck, IconBookmark, IconTag, IconFile, IconBriefcase, IconCard, IconList, IconCoin, IconChart, IconSettings, IconChevronLeft, IconChevronRight, } from "./Icons";
import { useSettings } from "../contexts/SettingsContext";
import { useEventStream } from "../hooks/useEventStream";
const salesItems = [
    { page: "dashboard", label: "Dashboard", Icon: IconDashboard },
    { page: "projects", label: "Projects", Icon: IconBuilding },
    { page: "units", label: "Units", Icon: IconGrid },
    { page: "contacts", label: "Contacts", Icon: IconUsers },
    { page: "leads", label: "Leads", Icon: IconUser },
    { page: "deals", label: "Deals", Icon: IconHandshake },
    { page: "tasks", label: "Activities", Icon: IconCheck },
    { page: "inbox", label: "Hot Inbox", Icon: IconBookmark },
    { page: "reservations", label: "Reservations", Icon: IconBookmark },
    { page: "offers-list", label: "Offers", Icon: IconTag },
    { page: "contracts", label: "Contracts", Icon: IconFile },
    { page: "brokers", label: "Brokers", Icon: IconBriefcase },
];
const financeItems = [
    { page: "finance", label: "Finance", Icon: IconChart },
    { page: "payments", label: "Payments", Icon: IconCard },
    { page: "payment-plans", label: "Pay. Plans", Icon: IconList },
    { page: "commissions", label: "Commissions", Icon: IconCoin },
    { page: "commission-tiers", label: "Comm. Tiers", Icon: IconCoin },
    { page: "refunds", label: "Refunds", Icon: IconCard },
    { page: "reports", label: "Reports", Icon: IconChart },
];
const adminItems = [
    { page: "compliance", label: "Compliance", Icon: IconFile },
    { page: "team", label: "Team", Icon: IconUsers },
    { page: "settings", label: "Settings", Icon: IconSettings },
];
// Role-based section visibility
function visibleSections(role) {
    const r = role ?? "ADMIN";
    if (r === "ADMIN")
        return { sales: true, finance: true, admin: true };
    if (r === "SALES_MANAGER")
        return { sales: true, finance: true, admin: false };
    if (r === "SALES" || r === "SALES_AGENT")
        return { sales: true, finance: false, admin: false };
    if (r === "FINANCE")
        return { sales: false, finance: true, admin: false };
    if (r === "OPERATIONS")
        return { sales: true, finance: true, admin: false };
    return { sales: true, finance: true, admin: true };
}
function NavItem({ page, label, Icon, active, collapsed, onNavigate, badge }) {
    return (_jsxs("button", { type: "button", onClick: () => onNavigate(page), title: collapsed ? `${label}${badge ? ` (${badge})` : ""}` : undefined, "aria-label": collapsed ? `${label}${badge ? ` (${badge})` : ""}` : undefined, "aria-current": active ? "page" : undefined, style: active ? { backgroundColor: "var(--brand-primary)" } : undefined, className: `relative w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900 ${active
            ? "text-white shadow-sm"
            : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"} ${collapsed ? "justify-center" : ""}`, children: [_jsx("span", { className: "flex-shrink-0 w-5 h-5 flex items-center justify-center", "aria-hidden": "true", children: _jsx(Icon, { size: 18 }) }), !collapsed && _jsx("span", { className: "flex-1 text-left truncate", children: label }), !!badge && badge > 0 && (_jsx("span", { className: `min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${active ? "bg-white/20 text-white" : "bg-amber-500 text-white"} ${collapsed ? "absolute -mt-4 ml-4" : ""}`, children: badge > 99 ? "99+" : badge }))] }));
}
function SectionLabel({ label, collapsed }) {
    if (collapsed)
        return _jsx("div", { className: "my-1 border-t border-slate-800", role: "separator" });
    return (_jsx("p", { className: "px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-600", children: label }));
}
export default function Sidebar({ currentPage, onNavigate, role }) {
    const [collapsed, setCollapsed] = useState(false);
    const sections = visibleSections(role);
    const { settings } = useSettings();
    const brandName = settings.companyName?.trim() || "Samha CRM";
    const brandInitial = brandName.charAt(0).toUpperCase();
    const [inboxCount, setInboxCount] = useState(0);
    // Initial load + slow safety-net poll. Real-time updates arrive via SSE below.
    useEffect(() => {
        let cancelled = false;
        const fetchCount = async () => {
            try {
                const r = await axios.get("/api/triage/counts");
                if (!cancelled)
                    setInboxCount(r.data?.unclaimed ?? 0);
            }
            catch {
                // silent — endpoint may not be available in dev
            }
        };
        fetchCount();
        const id = setInterval(fetchCount, 5 * 60000); // 5 min as a safety net
        return () => { cancelled = true; clearInterval(id); };
    }, []);
    useEventStream("triage.counts", (data) => {
        if (typeof data?.unclaimed === "number")
            setInboxCount(data.unclaimed);
    });
    return (_jsxs("aside", { className: `${collapsed ? "w-14" : "w-56"} bg-slate-900 flex flex-col h-full flex-shrink-0 border-r border-slate-800 transition-all duration-200`, "aria-label": "Primary navigation", children: [_jsxs("div", { className: `px-3 py-4 border-b border-slate-800 flex items-center ${collapsed ? "justify-center" : "gap-2.5"}`, children: [settings.logoUrl ? (_jsx("img", { src: settings.logoUrl, alt: brandName, className: "w-7 h-7 rounded-lg object-cover flex-shrink-0", onError: (e) => { e.currentTarget.style.display = "none"; } })) : (_jsx("div", { style: { backgroundColor: "var(--brand-primary)" }, className: "w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-xs font-bold", "aria-hidden": "true", children: brandInitial })), !collapsed && (_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-white font-semibold text-sm leading-tight truncate", children: brandName }), _jsx("p", { className: "text-slate-500 text-xs truncate", children: "Real Estate Pipeline" })] }))] }), _jsxs("nav", { className: "flex-1 px-2 py-2 space-y-0.5 overflow-y-auto overflow-x-hidden", role: "navigation", children: [sections.sales && (_jsxs(_Fragment, { children: [_jsx(SectionLabel, { label: "Sales", collapsed: collapsed }), salesItems.map(({ page, label, Icon }) => (_jsx(NavItem, { page: page, label: label, Icon: Icon, active: currentPage === page, collapsed: collapsed, onNavigate: onNavigate, badge: page === "inbox" ? inboxCount : undefined }, page)))] })), sections.finance && (_jsxs(_Fragment, { children: [_jsx(SectionLabel, { label: "Finance", collapsed: collapsed }), financeItems.map(({ page, label, Icon }) => (_jsx(NavItem, { page: page, label: label, Icon: Icon, active: currentPage === page, collapsed: collapsed, onNavigate: onNavigate }, page)))] })), sections.admin && (_jsxs(_Fragment, { children: [_jsx(SectionLabel, { label: "Admin", collapsed: collapsed }), adminItems.map(({ page, label, Icon }) => (_jsx(NavItem, { page: page, label: label, Icon: Icon, active: currentPage === page, collapsed: collapsed, onNavigate: onNavigate }, page)))] }))] }), _jsx("div", { className: "px-2 py-3 border-t border-slate-800", children: _jsxs("button", { type: "button", onClick: () => setCollapsed((v) => !v), "aria-label": collapsed ? "Expand sidebar" : "Collapse sidebar", "aria-expanded": !collapsed, className: "w-full flex items-center justify-center gap-2 px-3 py-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400", children: [_jsx("span", { "aria-hidden": "true", children: collapsed ? _jsx(IconChevronRight, { size: 14 }) : _jsx(IconChevronLeft, { size: 14 }) }), !collapsed && _jsx("span", { children: "Collapse" })] }) })] }));
}
