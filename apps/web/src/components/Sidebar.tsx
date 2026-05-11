import { useState, useEffect, ComponentType } from "react";
import axios from "axios";
import {
  IconDashboard, IconBuilding, IconGrid, IconUsers, IconUser, IconHandshake,
  IconCheck, IconInbox, IconFile, IconCard,
  IconChart, IconSettings, IconChevronLeft, IconChevronRight,
} from "./Icons";
import { useSettings } from "../contexts/SettingsContext";
import { useEventStream } from "../hooks/useEventStream";
import { FEATURE_DEFAULTS } from "../hooks/useFeatureFlag";

// Page IDs the sidebar can navigate to. The sidebar shows ~12 destinations
// after UX_AUDIT_3 nav cleanup: secondary screens (Reservations, Offers,
// Contracts, Brokers, Refunds, Commission tiers) are reached from their
// parent workspace, not the sidebar — see UX_AUDIT_3 for the rationale.
type Page = "today" | "projects" | "units" | "leads" | "deals" | "finance" | "payments" | "commissions" | "tasks" | "payment-plans" | "team" | "reports" | "contacts" | "settings" | "inbox" | "compliance";

type Role = "ADMIN" | "MANAGER" | "MEMBER" | "VIEWER";

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  role?: Role;
}

type IconType = ComponentType<{ size?: number; className?: string }>;

// `flag` keys reference catalog entries in apps/api/src/routes/settings.ts.
// When set, the item only renders if the flag is enabled (or the org hasn't
// explicitly toggled it AND its default is `true`).
type NavItemDef = { page: Page; label: string; Icon: IconType; flag?: keyof typeof FEATURE_DEFAULTS };

// Workspace order: personal "Today" first, then funnel (Leads → Deals →
// Contacts), inventory (Projects, Units), daily action stack (Tasks, Hot Inbox).
// Secondary surfaces — Reservations, Offers, Contracts, Brokers — are reached
// from inside Deals / Contacts; they're not first-class sidebar destinations.
const salesItems: NavItemDef[] = [
  { page: "today",         label: "Today",        Icon: IconDashboard },
  { page: "leads",         label: "Leads",        Icon: IconUser },
  { page: "deals",         label: "Deals",        Icon: IconHandshake },
  { page: "contacts",      label: "Contacts",     Icon: IconUsers },
  { page: "projects",      label: "Projects",     Icon: IconBuilding },
  { page: "units",         label: "Units",        Icon: IconGrid },
  { page: "tasks",         label: "Tasks",        Icon: IconCheck },
  { page: "inbox",         label: "Hot Inbox",    Icon: IconInbox },
];

// Refunds is reached from inside Payments; Commission tiers from Settings.
const financeItems: NavItemDef[] = [
  { page: "finance",           label: "Finance",          Icon: IconChart },
  { page: "payments",          label: "Payments",         Icon: IconCard },
  { page: "payment-plans",     label: "Payment plans",    Icon: IconFile },
  { page: "commissions",       label: "Commissions",      Icon: IconCard },
  { page: "reports",           label: "Reports",          Icon: IconChart },
];

const adminItems: NavItemDef[] = [
  { page: "compliance",    label: "Compliance",   Icon: IconFile },
  { page: "team",          label: "Team",         Icon: IconUsers },
  { page: "settings",      label: "Settings",     Icon: IconSettings },
];

// Section visibility by role tier.
//   ADMIN   → all sections.
//   MANAGER → sales + finance (finance sign-off authority).
//   MEMBER  → sales + finance (read-write within their work).
//   VIEWER  → sales + finance (read-only).
// Admin section is gated to ADMIN only.
function visibleSections(role: Role | undefined) {
  const r = role ?? "ADMIN";
  if (r === "ADMIN") return { sales: true, finance: true, admin: true };
  return { sales: true, finance: true, admin: false };
}

function NavItem({ page, label, Icon, active, collapsed, onNavigate, badge }: {
  page: Page; label: string; Icon: IconType; active: boolean;
  collapsed: boolean; onNavigate: (page: Page) => void;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(page)}
      title={collapsed ? `${label}${badge ? ` (${badge})` : ""}` : undefined}
      aria-label={collapsed ? `${label}${badge ? ` (${badge})` : ""}` : undefined}
      aria-current={active ? "page" : undefined}
      className={`relative w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card ${
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      } ${collapsed ? "justify-center" : ""}`}
    >
      <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center" aria-hidden="true">
        <Icon size={18} />
      </span>
      {!collapsed && <span className="flex-1 text-left truncate">{label}</span>}
      {!!badge && badge > 0 && (
        <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
          active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-warning text-warning-foreground"
        } ${collapsed ? "absolute -mt-4 ml-4" : ""}`}>
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}

function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return <div className="my-1 border-t border-border" role="separator" />;
  return (
    <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
      {label}
    </p>
  );
}

export default function Sidebar({ currentPage, onNavigate, role }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const sections = visibleSections(role);
  const { settings, isFeatureEnabled } = useSettings();

  const brandName = settings.companyName?.trim() || "Samha CRM";
  const brandInitial = brandName.charAt(0).toUpperCase();

  // Filter items: an item with `flag` set only renders when the flag is on.
  // Falls back to FEATURE_DEFAULTS when the org hasn't explicitly toggled.
  const filterByFlags = (items: NavItemDef[]) =>
    items.filter((it) => !it.flag || isFeatureEnabled(it.flag, FEATURE_DEFAULTS[it.flag] ?? false));

  const [inboxCount, setInboxCount] = useState(0);

  // Initial load + slow safety-net poll. Real-time updates arrive via SSE below.
  useEffect(() => {
    let cancelled = false;
    const fetchCount = async () => {
      try {
        const r = await axios.get("/api/triage/counts");
        if (!cancelled) setInboxCount(r.data?.unclaimed ?? 0);
      } catch {
        // silent — endpoint may not be available in dev
      }
    };
    fetchCount();
    const id = setInterval(fetchCount, 5 * 60_000); // 5 min as a safety net
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  useEventStream("triage.counts", (data: { unclaimed: number; claimed: number }) => {
    if (typeof data?.unclaimed === "number") setInboxCount(data.unclaimed);
  });

  return (
    <aside
      className={`${collapsed ? "w-14" : "w-56"} bg-card flex flex-col h-full flex-shrink-0 border-r border-border transition-all duration-200`}
      aria-label="Primary navigation"
    >
      {/* Brand */}
      <div className={`px-3 py-4 border-b border-border flex items-center ${collapsed ? "justify-center" : "gap-2.5"}`}>
        {settings.logoUrl ? (
          <img
            src={settings.logoUrl}
            alt={brandName}
            className="w-7 h-7 rounded-lg object-cover flex-shrink-0"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div
            className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center bg-primary text-primary-foreground text-xs font-bold"
            aria-hidden="true"
          >
            {brandInitial}
          </div>
        )}
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-foreground font-semibold text-sm leading-tight truncate">{brandName}</p>
            <p className="text-muted-foreground text-xs truncate">Real Estate Pipeline</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto overflow-x-hidden" role="navigation">
        {sections.sales && (
          <>
            <SectionLabel label="Sales" collapsed={collapsed} />
            {filterByFlags(salesItems).map(({ page, label, Icon }) => (
              <NavItem key={page} page={page} label={label} Icon={Icon}
                active={currentPage === page} collapsed={collapsed} onNavigate={onNavigate}
                badge={page === "inbox" ? inboxCount : undefined} />
            ))}
          </>
        )}

        {sections.finance && (
          <>
            <SectionLabel label="Finance" collapsed={collapsed} />
            {filterByFlags(financeItems).map(({ page, label, Icon }) => (
              <NavItem key={page} page={page} label={label} Icon={Icon}
                active={currentPage === page} collapsed={collapsed} onNavigate={onNavigate} />
            ))}
          </>
        )}

        {sections.admin && (
          <>
            <SectionLabel label="Admin" collapsed={collapsed} />
            {filterByFlags(adminItems).map(({ page, label, Icon }) => (
              <NavItem key={page} page={page} label={label} Icon={Icon}
                active={currentPage === page} collapsed={collapsed} onNavigate={onNavigate} />
            ))}
          </>
        )}
      </nav>

      {/* Collapse toggle */}
      <div className="px-2 py-3 border-t border-border">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span aria-hidden="true">{collapsed ? <IconChevronRight size={14} /> : <IconChevronLeft size={14} />}</span>
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
