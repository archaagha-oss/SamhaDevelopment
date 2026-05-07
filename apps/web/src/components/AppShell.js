import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback, useRef } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import Sidebar from "./Sidebar";
import GlobalSearchModal from "./GlobalSearchModal";
function pathToPage(pathname) {
    if (pathname === "/" || pathname === "")
        return "dashboard";
    if (pathname.startsWith("/projects"))
        return "projects";
    if (pathname.startsWith("/units"))
        return "units";
    if (pathname.startsWith("/leads"))
        return "leads";
    if (pathname.startsWith("/deals"))
        return "deals";
    if (pathname.startsWith("/payments"))
        return "payments";
    if (pathname.startsWith("/commissions"))
        return "commissions";
    if (pathname.startsWith("/brokers"))
        return "brokers";
    if (pathname.startsWith("/tasks"))
        return "tasks";
    if (pathname.startsWith("/contracts"))
        return "contracts";
    if (pathname.startsWith("/team"))
        return "team";
    if (pathname.startsWith("/reports"))
        return "reports";
    if (pathname.startsWith("/payment-plans"))
        return "payment-plans";
    if (pathname.startsWith("/reservations"))
        return "reservations";
    if (pathname.startsWith("/offers-list"))
        return "offers-list";
    if (pathname.startsWith("/contacts"))
        return "contacts";
    if (pathname.startsWith("/settings"))
        return "settings";
    return "dashboard";
}
const NOTIF_ICONS = {
    PAYMENT_OVERDUE: "💳",
    RESERVATION_EXPIRING: "⏰",
    COMMISSION_PENDING: "💰",
    OQOOD_DEADLINE: "📋",
    DEAL_STAGE_CHANGED: "🔄",
    NEW_LEAD_ASSIGNED: "👤",
    GENERAL: "🔔",
};
function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)
        return "just now";
    if (m < 60)
        return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24)
        return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}
export default function AppShell() {
    const navigate = useNavigate();
    const location = useLocation();
    // Mock user for dev (TODO: integrate real Clerk auth in future phase)
    const user = { firstName: "Dev", fullName: "Dev User", primaryEmailAddress: { emailAddress: "dev@samha.local" } };
    const handleSignOut = () => {
        localStorage.clear();
        navigate("/sign-in");
    };
    const { theme, setTheme } = useTheme();
    const toggleTheme = useCallback(() => setTheme(theme === "dark" ? "light" : "dark"), [theme, setTheme]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifications, setNotifications] = useState([]);
    const [showNotifPanel, setShowNotifPanel] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const notificationTimer = useRef(null);
    const notifPanelRef = useRef(null);
    const profileMenuRef = useRef(null);
    const fetchNotifications = useCallback(() => {
        axios
            .get("/api/users/dev-user-1/notifications", { params: { limit: 20 } })
            .then((res) => {
            const items = res.data.data || res.data || [];
            setNotifications(Array.isArray(items) ? items : []);
            setUnreadCount(Array.isArray(items) ? items.filter((n) => !n.read).length : 0);
        })
            .catch(() => { });
    }, []);
    const markAllRead = useCallback(() => {
        notifications.filter((n) => !n.read).forEach((n) => {
            axios.patch(`/api/users/dev-user-1/notifications/${n.id}`, { read: true }).catch(() => { });
        });
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
    }, [notifications]);
    useEffect(() => {
        fetchNotifications();
        notificationTimer.current = setInterval(fetchNotifications, 60000);
        return () => { if (notificationTimer.current)
            clearInterval(notificationTimer.current); };
    }, [fetchNotifications]);
    useEffect(() => {
        const handler = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setShowSearch(true);
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);
    // Close panels when clicking outside
    useEffect(() => {
        if (!showNotifPanel)
            return;
        const handler = (e) => {
            if (notifPanelRef.current && !notifPanelRef.current.contains(e.target)) {
                setShowNotifPanel(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [showNotifPanel]);
    useEffect(() => {
        if (!showProfileMenu)
            return;
        const handler = (e) => {
            if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
                setShowProfileMenu(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [showProfileMenu]);
    const handleNavigate = useCallback((page) => {
        const map = {
            dashboard: "/", projects: "/projects", units: "/units",
            leads: "/leads", deals: "/deals", payments: "/payments",
            commissions: "/commissions", brokers: "/brokers", tasks: "/tasks", contracts: "/contracts",
            "payment-plans": "/payment-plans", reservations: "/reservations", "offers-list": "/offers-list",
            team: "/team", reports: "/reports",
            contacts: "/contacts", settings: "/settings",
        };
        navigate(map[page]);
    }, [navigate]);
    const currentPage = pathToPage(location.pathname);
    return (_jsxs("div", { className: "flex h-screen bg-slate-950 overflow-hidden", children: [_jsx(Sidebar, { currentPage: currentPage, onNavigate: handleNavigate }), _jsxs("div", { className: "flex flex-col flex-1 min-w-0 overflow-hidden", children: [_jsxs("header", { className: "flex items-center justify-between px-6 py-3 bg-slate-900 border-b border-slate-800 flex-shrink-0", children: [_jsxs("button", { onClick: () => setShowSearch(true), className: "flex items-center gap-2 px-3 py-1.5 text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition-colors", children: [_jsx("span", { children: "\uD83D\uDD0D" }), _jsx("span", { children: "Search\u2026" }), _jsx("kbd", { className: "ml-2 px-1.5 py-0.5 text-[10px] bg-slate-700 text-slate-400 rounded border border-slate-600 font-mono", children: "\u2318K" })] }), _jsxs("div", { className: "flex items-center gap-3", ref: notifPanelRef, children: [_jsx("button", { onClick: toggleTheme, className: "p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors", title: theme === "dark" ? "Switch to light mode" : "Switch to dark mode", "aria-label": "Toggle theme", children: theme === "dark" ? _jsx(Sun, { className: "h-4 w-4" }) : _jsx(Moon, { className: "h-4 w-4" }) }), _jsxs("div", { className: "relative", children: [_jsxs("button", { onClick: () => { setShowNotifPanel((v) => !v); if (!showNotifPanel)
                                                    fetchNotifications(); }, className: "relative p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors", title: "Notifications", children: [_jsx("span", { className: "text-lg leading-none", children: "\uD83D\uDD14" }), unreadCount > 0 && (_jsx("span", { className: "absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1", children: unreadCount > 99 ? "99+" : unreadCount }))] }), showNotifPanel && (_jsxs("div", { className: "absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between px-4 py-3 border-b border-slate-100", children: [_jsx("span", { className: "text-sm font-bold text-slate-900", children: "Notifications" }), unreadCount > 0 && (_jsx("button", { onClick: markAllRead, className: "text-xs text-blue-600 hover:underline", children: "Mark all read" }))] }), _jsx("div", { className: "max-h-80 overflow-y-auto divide-y divide-slate-50", children: notifications.length === 0 ? (_jsx("p", { className: "px-4 py-8 text-center text-sm text-slate-400", children: "No notifications" })) : notifications.map((n) => (_jsxs("div", { className: `flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors ${!n.read ? "bg-blue-50/40" : ""}`, children: [_jsx("span", { className: "text-base mt-0.5 flex-shrink-0 cursor-pointer", onClick: () => {
                                                                        if (!n.read)
                                                                            axios.patch(`/api/users/dev-user-1/notifications/${n.id}`, { read: true }).catch(() => { });
                                                                        setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x));
                                                                        setUnreadCount((c) => Math.max(0, c - (n.read ? 0 : 1)));
                                                                        if (n.entityType === "DEAL" && n.entityId) {
                                                                            navigate(`/deals/${n.entityId}`);
                                                                            setShowNotifPanel(false);
                                                                        }
                                                                    }, children: NOTIF_ICONS[n.type] || "🔔" }), _jsxs("div", { className: "flex-1 min-w-0 cursor-pointer", onClick: () => {
                                                                        if (!n.read)
                                                                            axios.patch(`/api/users/dev-user-1/notifications/${n.id}`, { read: true }).catch(() => { });
                                                                        setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x));
                                                                        setUnreadCount((c) => Math.max(0, c - (n.read ? 0 : 1)));
                                                                        if (n.entityType === "DEAL" && n.entityId) {
                                                                            navigate(`/deals/${n.entityId}`);
                                                                            setShowNotifPanel(false);
                                                                        }
                                                                    }, children: [_jsx("p", { className: `text-xs leading-snug ${!n.read ? "font-semibold text-slate-900" : "text-slate-700"}`, children: n.message }), _jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: timeAgo(n.createdAt) })] }), _jsx("button", { onClick: (e) => {
                                                                        e.stopPropagation();
                                                                        axios.patch(`/api/users/dev-user-1/notifications/${n.id}`, { read: true }).catch(() => { });
                                                                        setNotifications((prev) => prev.filter((x) => x.id !== n.id));
                                                                        if (!n.read)
                                                                            setUnreadCount((c) => Math.max(0, c - 1));
                                                                    }, className: "text-slate-300 hover:text-slate-500 text-base leading-none flex-shrink-0 mt-0.5 transition-colors", title: "Dismiss", children: "\u00D7" })] }, n.id))) })] }))] }), _jsxs("div", { className: "relative", ref: profileMenuRef, children: [_jsx("button", { onClick: () => setShowProfileMenu((v) => !v), className: "w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold select-none hover:bg-blue-700 transition-colors", title: "Profile", children: user?.firstName?.[0]?.toUpperCase() ?? "U" }), showProfileMenu && (_jsxs("div", { className: "absolute right-0 top-10 w-52 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden", children: [_jsxs("div", { className: "px-4 py-3 border-b border-slate-100", children: [_jsx("p", { className: "text-sm font-semibold text-slate-900 truncate", children: user?.fullName ?? "User" }), _jsx("p", { className: "text-xs text-slate-400 truncate", children: user?.primaryEmailAddress?.emailAddress ?? "" })] }), _jsx("button", { onClick: () => { setShowProfileMenu(false); navigate("/team"); }, className: "w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors", children: "My Profile" }), _jsx("button", { onClick: handleSignOut, className: "w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors border-t border-slate-100", children: "Sign Out" })] }))] })] })] }), _jsx("main", { className: "flex-1 overflow-auto bg-background text-foreground", children: _jsx(Outlet, {}) })] }), showSearch && _jsx(GlobalSearchModal, { open: showSearch, onClose: () => setShowSearch(false) })] }));
}
