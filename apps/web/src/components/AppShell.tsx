import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { Moon, Sun, CreditCard, Clock, DollarSign, ClipboardList, RefreshCw, User, Bell } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import Sidebar from "./Sidebar";
import GlobalSearchModal from "./GlobalSearchModal";
import ErrorBoundary from "./ErrorBoundary";
import { IconSearch, IconBell } from "./Icons";
import { useEventStream } from "../hooks/useEventStream";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { formatRelative } from "../utils/format";

// Keep in sync with the Page union in Sidebar.tsx — both narrowed in UX_AUDIT_3
// to drop sub-pages that no longer have their own sidebar entry.
type Page = "today" | "projects" | "units" | "leads" | "deals" | "finance" | "payments" | "commissions" | "tasks" | "payment-plans" | "team" | "reports" | "contacts" | "settings" | "inbox" | "compliance";

type Role = "ADMIN" | "MANAGER" | "MEMBER" | "VIEWER";

// Map the current pathname to the sidebar's active page. Routes that no longer
// have their own sidebar entry (reservations, offers-list, contracts, brokers,
// refunds, commission-tiers, dashboard) are grouped under their parent
// workspace so the matching sidebar tab still highlights.
function pathToPage(pathname: string): Page {
  if (pathname === "/" || pathname === "" || pathname === "/dashboard" || pathname.startsWith("/my-day")) return "today";
  if (pathname.startsWith("/projects")) return "projects";
  if (pathname.startsWith("/units")) return "units";
  if (pathname.startsWith("/leads")) return "leads";
  // Reservations / Offers / Contracts / Brokers are reached from inside Deals;
  // keep "Deals" highlighted when on those screens too.
  if (pathname.startsWith("/deals")) return "deals";
  if (pathname.startsWith("/reservations")) return "deals";
  if (pathname.startsWith("/offers-list")) return "deals";
  if (pathname.startsWith("/contracts")) return "deals";
  if (pathname.startsWith("/brokers")) return "contacts";
  if (pathname.startsWith("/finance")) return "finance";
  // Refunds is a sub-section of Payments now — keep Payments highlighted.
  if (pathname.startsWith("/payments")) return "payments";
  if (pathname.startsWith("/refunds")) return "payments";
  // Commission tiers is a Settings sub-page — keep Settings highlighted.
  if (pathname.startsWith("/commission-tiers")) return "settings";
  if (pathname.startsWith("/commissions")) return "commissions";
  if (pathname.startsWith("/tasks")) return "tasks";
  if (pathname.startsWith("/inbox")) return "inbox";
  if (pathname.startsWith("/compliance")) return "compliance";
  if (pathname.startsWith("/team")) return "team";
  if (pathname.startsWith("/reports")) return "reports";
  if (pathname.startsWith("/payment-plans")) return "payment-plans";
  if (pathname.startsWith("/contacts")) return "contacts";
  if (pathname.startsWith("/settings")) return "settings";
  return "today";
}

const NOTIF_ICONS: Record<string, LucideIcon> = {
  PAYMENT_OVERDUE: CreditCard,
  RESERVATION_EXPIRING: Clock,
  COMMISSION_PENDING: DollarSign,
  OQOOD_DEADLINE: ClipboardList,
  DEAL_STAGE_CHANGED: RefreshCw,
  NEW_LEAD_ASSIGNED: User,
  GENERAL: Bell,
};

const NOTIF_TOKENS: Record<string, string> = {
  PAYMENT_OVERDUE: "text-destructive",
  RESERVATION_EXPIRING: "text-warning",
  COMMISSION_PENDING: "text-success",
  OQOOD_DEADLINE: "text-info",
  DEAL_STAGE_CHANGED: "text-primary",
  NEW_LEAD_ASSIGNED: "text-accent-2",
  GENERAL: "text-muted-foreground",
};

// Notification panel uses the shared `formatRelative` helper (UX_AUDIT_2 §R4
// — list context, keep relative). Bell items render in a dropdown so the
// short relative form is the right choice; for older items (≥30d) the helper
// switches to absolute date automatically.
function timeAgo(dateStr: string) {
  return formatRelative(dateStr);
}

export default function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();

  // Phase F.1 — global keyboard shortcuts (g+x for navigation, c for create
  // on the current list page, / to focus search). Cmd+K is handled separately
  // below to keep its precedence over the shortcut layer.
  useKeyboardShortcuts();

  // Source the role from /api/users/me — the same record the API uses for
  // authorization. While the request is in flight the sidebar treats the
  // user as VIEWER (least privilege). Editing localStorage no longer affects
  // sidebar visibility — see audit D.1.8.
  const { data: currentUser } = useCurrentUser();
  const role: Role = (currentUser?.role as Role) ?? "VIEWER";
  const user = currentUser
    ? {
        firstName: currentUser.name.split(" ")[0] ?? currentUser.name,
        fullName: currentUser.name,
        primaryEmailAddress: { emailAddress: currentUser.email },
      }
    : { firstName: "…", fullName: "Loading", primaryEmailAddress: { emailAddress: "" } };
  const handleSignOut = () => {
    localStorage.clear();
    navigate("/sign-in");
  };

  const { theme, setTheme } = useTheme();
  const toggleTheme = useCallback(
    () => setTheme(theme === "dark" ? "light" : "dark"),
    [theme, setTheme]
  );

  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const notificationTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const notifPanelRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(() => {
    axios
      .get("/api/users/dev-user-1/notifications", { params: { limit: 20 } })
      .then((res) => {
        const items: any[] = res.data.data || res.data || [];
        setNotifications(Array.isArray(items) ? items : []);
        setUnreadCount(Array.isArray(items) ? items.filter((n: any) => !n.read).length : 0);
      })
      .catch(() => {});
  }, []);

  const markAllRead = useCallback(() => {
    notifications.filter((n) => !n.read).forEach((n) => {
      axios.patch(`/api/users/dev-user-1/notifications/${n.id}`, { read: true }).catch(() => {});
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, [notifications]);

  useEffect(() => {
    fetchNotifications();
    // Slower safety-net poll. Live updates arrive via SSE below.
    notificationTimer.current = setInterval(fetchNotifications, 5 * 60_000);
    return () => { if (notificationTimer.current) clearInterval(notificationTimer.current); };
  }, [fetchNotifications]);

  // Live: incoming notifications bump the unread badge and prepend to the list
  useEventStream("notification.created", (n: any) => {
    if (!n) return;
    setNotifications((prev) => [{ ...n, read: false, createdAt: n.createdAt ?? new Date().toISOString() }, ...prev].slice(0, 20));
    setUnreadCount((c) => c + 1);
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        e.stopPropagation();
        setShowSearch((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const shortcutLabel = isMac ? "⌘K" : "Ctrl K";

  // Close panels when clicking outside
  useEffect(() => {
    if (!showNotifPanel) return;
    const handler = (e: MouseEvent) => {
      if (notifPanelRef.current && !notifPanelRef.current.contains(e.target as Node)) {
        setShowNotifPanel(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showNotifPanel]);

  useEffect(() => {
    if (!showProfileMenu) return;
    const handler = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showProfileMenu]);

  const handleNavigate = useCallback((page: Page) => {
    // `today` resolves to the role-aware home dispatcher at "/". MEMBER/VIEWER
    // land on MyDayPage; ADMIN/MANAGER land on ExecutiveDashboard.
    const map: Record<Page, string> = {
      today: "/",
      projects: "/projects", units: "/units",
      leads: "/leads", deals: "/deals",
      finance: "/finance", payments: "/payments",
      commissions: "/commissions",
      tasks: "/tasks",
      "payment-plans": "/payment-plans",
      team: "/team", reports: "/reports",
      contacts: "/contacts", settings: "/settings",
      inbox: "/inbox",
      compliance: "/compliance",
    };
    navigate(map[page]);
  }, [navigate]);

  const currentPage = pathToPage(location.pathname);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Skip link — visible on keyboard focus, lets screen-reader / keyboard
          users jump past the sidebar and header straight into the page body. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2 focus:rounded-md focus:bg-primary focus:text-primary-foreground focus:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Skip to main content
      </a>
      <Sidebar currentPage={currentPage} onNavigate={handleNavigate} role={role} />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="flex items-center justify-between px-4 sm:px-6 py-3 bg-card border-b border-border flex-shrink-0 gap-3">
          <button
            onClick={() => setShowSearch(true)}
            aria-label="Open global search (⌘K)"
            className="flex items-center gap-2 px-3 py-1.5 text-muted-foreground hover:text-foreground bg-muted hover:bg-muted rounded-lg text-sm transition-colors min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <IconSearch size={14} aria-hidden="true" />
            <span className="hidden sm:inline">Search…</span>
            <kbd className="ml-2 px-1.5 py-0.5 text-[10px] bg-card text-muted-foreground rounded border border-border font-mono hidden sm:inline">{shortcutLabel}</kbd>
          </button>

          <div className="flex items-center gap-3" ref={notifPanelRef}>
            <button
              onClick={toggleTheme}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <div className="relative">
              <button
                onClick={() => { setShowNotifPanel((v) => !v); if (!showNotifPanel) fetchNotifications(); }}
                className="relative p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
                aria-haspopup="true"
                aria-expanded={showNotifPanel}
              >
                <IconBell size={18} aria-hidden="true" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-destructive text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 ring-2 ring-ring" aria-hidden="true">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              {showNotifPanel && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-card rounded-xl shadow-2xl border border-border z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <span className="text-sm font-bold text-foreground">Notifications</span>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-xs text-primary hover:underline">
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-border">
                    {notifications.length === 0 ? (
                      <p className="px-4 py-8 text-center text-sm text-muted-foreground">No notifications</p>
                    ) : notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors ${!n.read ? "bg-info-soft/40" : ""}`}
                      >
                        <span
                          className="mt-0.5 flex-shrink-0 cursor-pointer"
                          onClick={() => {
                            if (!n.read) axios.patch(`/api/users/dev-user-1/notifications/${n.id}`, { read: true }).catch(() => {});
                            setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x));
                            setUnreadCount((c) => Math.max(0, c - (n.read ? 0 : 1)));
                            if (n.entityType === "DEAL" && n.entityId) { navigate(`/deals/${n.entityId}`); setShowNotifPanel(false); }
                          }}
                        >
                          {(() => {
                            const Icon = NOTIF_ICONS[n.type] ?? Bell;
                            const token = NOTIF_TOKENS[n.type] ?? "text-muted-foreground";
                            return <Icon className={`size-4 ${token}`} />;
                          })()}
                        </span>
                        <div
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => {
                            if (!n.read) axios.patch(`/api/users/dev-user-1/notifications/${n.id}`, { read: true }).catch(() => {});
                            setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x));
                            setUnreadCount((c) => Math.max(0, c - (n.read ? 0 : 1)));
                            if (n.entityType === "DEAL" && n.entityId) { navigate(`/deals/${n.entityId}`); setShowNotifPanel(false); }
                          }}
                        >
                          <p className={`text-xs leading-snug ${!n.read ? "font-semibold text-foreground" : "text-foreground"}`}>{n.message}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(n.createdAt)}</p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            axios.patch(`/api/users/dev-user-1/notifications/${n.id}`, { read: true }).catch(() => {});
                            setNotifications((prev) => prev.filter((x) => x.id !== n.id));
                            if (!n.read) setUnreadCount((c) => Math.max(0, c - 1));
                          }}
                          className="text-foreground/80 hover:text-foreground text-base leading-none flex-shrink-0 mt-0.5 transition-colors"
                          title="Dismiss"
                        >×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setShowProfileMenu((v) => !v)}
                className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold select-none hover:bg-primary/90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card"
                title="Profile"
                aria-label={`User menu for ${user?.fullName ?? "user"}`}
                aria-expanded={showProfileMenu}
                aria-haspopup="menu"
              >
                {user?.firstName?.[0]?.toUpperCase() ?? "U"}
              </button>
              {showProfileMenu && (
                <div className="absolute right-0 top-10 w-52 bg-card rounded-xl shadow-xl border border-border z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-sm font-semibold text-foreground truncate" title={user?.fullName ?? "User"}>
                      {user?.fullName ?? "User"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate" title={user?.primaryEmailAddress?.emailAddress ?? ""}>
                      {user?.primaryEmailAddress?.emailAddress ?? ""}
                    </p>
                  </div>
                  <button
                    onClick={() => { setShowProfileMenu(false); navigate("/team"); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-muted/50 transition-colors"
                  >
                    My Profile
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-4 py-2.5 text-sm text-destructive hover:bg-destructive-soft transition-colors border-t border-border"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main id="main-content" className="flex-1 overflow-auto bg-background text-foreground">
          <ErrorBoundary key={location.pathname}>
            <Suspense
              fallback={
                <div
                  role="status"
                  aria-busy="true"
                  aria-label="Loading page"
                  className="flex h-full min-h-[40vh] items-center justify-center"
                >
                  <div className="h-7 w-7 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>

      {showSearch && <GlobalSearchModal open={showSearch} onClose={() => setShowSearch(false)} />}
    </div>
  );
}
