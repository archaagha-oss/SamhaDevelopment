import { useState, ComponentType } from "react";
import {
  IconDashboard, IconBuilding, IconGrid, IconUsers, IconUser, IconHandshake,
  IconCheck, IconBookmark, IconTag, IconFile, IconBriefcase, IconCard, IconList,
  IconCoin, IconChart, IconSettings, IconChevronLeft, IconChevronRight,
} from "./Icons";

type Page = "dashboard" | "projects" | "units" | "leads" | "deals" | "payments" | "commissions" | "brokers" | "tasks" | "contracts" | "payment-plans" | "reservations" | "offers-list" | "team" | "reports" | "contacts" | "settings";

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

type IconType = ComponentType<{ size?: number; className?: string }>;

const salesItems: { page: Page; label: string; Icon: IconType }[] = [
  { page: "dashboard",     label: "Dashboard",    Icon: IconDashboard },
  { page: "projects",      label: "Projects",     Icon: IconBuilding },
  { page: "units",         label: "Units",        Icon: IconGrid },
  { page: "contacts",      label: "Contacts",     Icon: IconUsers },
  { page: "leads",         label: "Leads",        Icon: IconUser },
  { page: "deals",         label: "Deals",        Icon: IconHandshake },
  { page: "tasks",         label: "Activities",   Icon: IconCheck },
  { page: "reservations",  label: "Reservations", Icon: IconBookmark },
  { page: "offers-list",   label: "Offers",       Icon: IconTag },
  { page: "contracts",     label: "Contracts",    Icon: IconFile },
  { page: "brokers",       label: "Brokers",      Icon: IconBriefcase },
];

const financeItems: { page: Page; label: string; Icon: IconType }[] = [
  { page: "payments",      label: "Payments",     Icon: IconCard },
  { page: "payment-plans", label: "Pay. Plans",   Icon: IconList },
  { page: "commissions",   label: "Commissions",  Icon: IconCoin },
  { page: "reports",       label: "Reports",      Icon: IconChart },
];

const adminItems: { page: Page; label: string; Icon: IconType }[] = [
  { page: "team",          label: "Team",         Icon: IconUsers },
  { page: "settings",      label: "Settings",     Icon: IconSettings },
];

function NavItem({ page, label, Icon, active, collapsed, onNavigate }: {
  page: Page; label: string; Icon: IconType; active: boolean;
  collapsed: boolean; onNavigate: (page: Page) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(page)}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900 ${
        active
          ? "bg-blue-600 text-white shadow-sm"
          : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
      } ${collapsed ? "justify-center" : ""}`}
    >
      <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center" aria-hidden="true">
        <Icon size={18} />
      </span>
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}

function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return <div className="my-1 border-t border-slate-800" role="separator" />;
  return (
    <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
      {label}
    </p>
  );
}

export default function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`${collapsed ? "w-14" : "w-56"} bg-slate-900 flex flex-col h-full flex-shrink-0 border-r border-slate-800 transition-all duration-200`}
      aria-label="Primary navigation"
    >
      {/* Brand */}
      <div className={`px-3 py-4 border-b border-slate-800 flex items-center ${collapsed ? "justify-center" : "gap-2.5"}`}>
        <div className="w-7 h-7 rounded-lg bg-blue-600 flex-shrink-0 flex items-center justify-center text-white text-xs font-bold" aria-hidden="true">S</div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm leading-tight truncate">Samha CRM</p>
            <p className="text-slate-500 text-xs truncate">Real Estate Pipeline</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto overflow-x-hidden" role="navigation">
        <SectionLabel label="Sales" collapsed={collapsed} />
        {salesItems.map(({ page, label, Icon }) => (
          <NavItem key={page} page={page} label={label} Icon={Icon}
            active={currentPage === page} collapsed={collapsed} onNavigate={onNavigate} />
        ))}

        <SectionLabel label="Finance" collapsed={collapsed} />
        {financeItems.map(({ page, label, Icon }) => (
          <NavItem key={page} page={page} label={label} Icon={Icon}
            active={currentPage === page} collapsed={collapsed} onNavigate={onNavigate} />
        ))}

        <SectionLabel label="Admin" collapsed={collapsed} />
        {adminItems.map(({ page, label, Icon }) => (
          <NavItem key={page} page={page} label={label} Icon={Icon}
            active={currentPage === page} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="px-2 py-3 border-t border-slate-800">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <span aria-hidden="true">{collapsed ? <IconChevronRight size={14} /> : <IconChevronLeft size={14} />}</span>
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
