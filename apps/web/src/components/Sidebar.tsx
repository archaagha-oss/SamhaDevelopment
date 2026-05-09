import { useState, useEffect, ComponentType } from "react";
import {
  LayoutDashboard,
  Building2,
  Boxes,
  Users,
  UserCircle2,
  Briefcase,
  CheckSquare,
  CalendarClock,
  FileText,
  ScrollText,
  HandCoins,
  Wallet,
  ListTree,
  Coins,
  BarChart3,
  UserCog,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

type Page = "dashboard" | "projects" | "units" | "leads" | "deals" | "payments" | "commissions" | "brokers" | "tasks" | "contracts" | "payment-plans" | "reservations" | "offers-list" | "team" | "reports" | "contacts" | "settings";

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

type IconCmp = ComponentType<{ className?: string }>;

const salesItems: { page: Page; label: string; icon: IconCmp }[] = [
  { page: "dashboard",     label: "Dashboard",    icon: LayoutDashboard },
  { page: "projects",      label: "Projects",     icon: Building2 },
  { page: "units",         label: "Units",        icon: Boxes },
  { page: "contacts",      label: "Contacts",     icon: UserCircle2 },
  { page: "leads",         label: "Leads",        icon: Users },
  { page: "deals",         label: "Deals",        icon: Briefcase },
  { page: "tasks",         label: "Activities",   icon: CheckSquare },
  { page: "reservations",  label: "Reservations", icon: CalendarClock },
  { page: "offers-list",   label: "Offers",       icon: FileText },
  { page: "contracts",     label: "Contracts",    icon: ScrollText },
  { page: "brokers",       label: "Brokers",      icon: HandCoins },
];

const financeItems: { page: Page; label: string; icon: IconCmp }[] = [
  { page: "payments",      label: "Payments",     icon: Wallet },
  { page: "payment-plans", label: "Pay. Plans",   icon: ListTree },
  { page: "commissions",   label: "Commissions",  icon: Coins },
  { page: "reports",       label: "Reports",      icon: BarChart3 },
];

const adminItems: { page: Page; label: string; icon: IconCmp }[] = [
  { page: "team",          label: "Team",         icon: UserCog },
  { page: "settings",      label: "Settings",     icon: Settings },
];

const COLLAPSED_KEY = "samha.sidebar.collapsed";

function NavItem({
  page,
  label,
  icon: Icon,
  active,
  collapsed,
  onNavigate,
}: {
  page: Page;
  label: string;
  icon: IconCmp;
  active: boolean;
  collapsed: boolean;
  onNavigate: (page: Page) => void;
}) {
  return (
    <button
      onClick={() => onNavigate(page)}
      title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      className={[
        "w-full flex items-center gap-3 px-3 py-2 rounded-ctrl text-sm font-medium transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
        active
          ? "bg-blue-600 text-white shadow-sm"
          : "text-slate-400 hover:text-slate-100 hover:bg-slate-800",
        collapsed ? "justify-center" : "",
      ].join(" ")}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}

function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return <div className="my-2 border-t border-slate-800" />;
  return (
    <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
      {label}
    </p>
  );
}

export default function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSED_KEY) === "1"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0"); } catch { /* ignore */ }
  }, [collapsed]);

  return (
    <aside
      className={`${collapsed ? "w-16" : "w-56"} bg-slate-900 flex flex-col h-full flex-shrink-0 border-r border-slate-800 transition-[width] duration-200`}
      aria-label="Primary navigation"
    >
      {/* Brand */}
      <div className={`px-3 py-4 border-b border-slate-800 flex items-center ${collapsed ? "justify-center" : "gap-2.5"}`}>
        <div className="w-7 h-7 rounded-ctrl bg-blue-600 flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">S</div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm leading-tight truncate">Samha CRM</p>
            <p className="text-slate-500 text-xs truncate">Real Estate Pipeline</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto overflow-x-hidden scrollbar-thin">
        <SectionLabel label="Sales" collapsed={collapsed} />
        {salesItems.map(({ page, label, icon }) => (
          <NavItem key={page} page={page} label={label} icon={icon}
            active={currentPage === page} collapsed={collapsed} onNavigate={onNavigate} />
        ))}

        <SectionLabel label="Finance" collapsed={collapsed} />
        {financeItems.map(({ page, label, icon }) => (
          <NavItem key={page} page={page} label={label} icon={icon}
            active={currentPage === page} collapsed={collapsed} onNavigate={onNavigate} />
        ))}

        <SectionLabel label="Admin" collapsed={collapsed} />
        {adminItems.map(({ page, label, icon }) => (
          <NavItem key={page} page={page} label={label} icon={icon}
            active={currentPage === page} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="px-2 py-3 border-t border-slate-800">
        <button
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-ctrl text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
