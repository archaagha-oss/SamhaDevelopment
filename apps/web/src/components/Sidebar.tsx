import { useState } from "react";

type Page = "dashboard" | "projects" | "units" | "leads" | "deals" | "finance" | "payments" | "commissions" | "brokers" | "tasks" | "contracts" | "payment-plans" | "reservations" | "offers-list" | "team" | "reports" | "contacts" | "settings";

type Role = "ADMIN" | "SALES" | "SALES_AGENT" | "SALES_MANAGER" | "FINANCE" | "OPERATIONS";

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  role?: Role;
}

const salesItems: { page: Page; label: string; icon: string }[] = [
  { page: "dashboard",   label: "Dashboard",   icon: "▦" },
  { page: "projects",    label: "Projects",    icon: "⊕" },
  { page: "units",       label: "Units",       icon: "⊞" },
  { page: "contacts",    label: "Contacts",    icon: "◎" },
  { page: "leads",       label: "Leads",       icon: "◉" },
  { page: "deals",       label: "Deals",       icon: "◈" },
  { page: "tasks",       label: "Activities",  icon: "✓" },
  { page: "reservations",  label: "Reservations", icon: "⊗" },
  { page: "offers-list",   label: "Offers",      icon: "◁" },
  { page: "contracts",   label: "Contracts",   icon: "⊜" },
  { page: "brokers",     label: "Brokers",     icon: "⊛" },
];

const financeItems: { page: Page; label: string; icon: string }[] = [
  { page: "finance",     label: "Finance",     icon: "$" },
  { page: "payments",    label: "Payments",    icon: "⊟" },
  { page: "payment-plans", label: "Pay. Plans", icon: "≡" },
  { page: "commissions", label: "Commissions", icon: "◇" },
  { page: "reports",     label: "Reports",     icon: "▤" },
];

const adminItems: { page: Page; label: string; icon: string }[] = [
  { page: "team",        label: "Team",        icon: "⊞" },
  { page: "settings",    label: "Settings",    icon: "⚙" },
];

// Role-based section visibility
function visibleSections(role: Role | undefined) {
  // Default: assume ADMIN if role unknown
  const r = role ?? "ADMIN";
  if (r === "ADMIN") return { sales: true, finance: true, admin: true };
  if (r === "SALES_MANAGER") return { sales: true, finance: true, admin: false };
  if (r === "SALES" || r === "SALES_AGENT") return { sales: true, finance: false, admin: false };
  if (r === "FINANCE") return { sales: false, finance: true, admin: false };
  if (r === "OPERATIONS") return { sales: true, finance: true, admin: false };
  return { sales: true, finance: true, admin: true };
}

function NavItem({ page, label, icon, active, collapsed, onNavigate }: {
  page: Page; label: string; icon: string; active: boolean;
  collapsed: boolean; onNavigate: (page: Page) => void;
}) {
  return (
    <button
      onClick={() => onNavigate(page)}
      title={collapsed ? label : undefined}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
        active
          ? "bg-blue-600 text-white shadow-sm"
          : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
      } ${collapsed ? "justify-center" : ""}`}
    >
      <span className="text-base flex-shrink-0 w-4 text-center leading-none">{icon}</span>
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}

function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return <div className="my-1 border-t border-slate-800" />;
  return (
    <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
      {label}
    </p>
  );
}

export default function Sidebar({ currentPage, onNavigate, role }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const sections = visibleSections(role);

  return (
    <div className={`${collapsed ? "w-14" : "w-56"} bg-slate-900 flex flex-col h-full flex-shrink-0 border-r border-slate-800 transition-all duration-200`}>
      {/* Brand */}
      <div className={`px-3 py-4 border-b border-slate-800 flex items-center ${collapsed ? "justify-center" : "gap-2.5"}`}>
        <div className="w-7 h-7 rounded-lg bg-blue-600 flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">S</div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm leading-tight truncate">Samha CRM</p>
            <p className="text-slate-500 text-xs truncate">Real Estate Pipeline</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
        {sections.sales && (
          <>
            <SectionLabel label="Sales" collapsed={collapsed} />
            {salesItems.map(({ page, label, icon }) => (
              <NavItem key={page} page={page} label={label} icon={icon}
                active={currentPage === page} collapsed={collapsed} onNavigate={onNavigate} />
            ))}
          </>
        )}

        {sections.finance && (
          <>
            <SectionLabel label="Finance" collapsed={collapsed} />
            {financeItems.map(({ page, label, icon }) => (
              <NavItem key={page} page={page} label={label} icon={icon}
                active={currentPage === page} collapsed={collapsed} onNavigate={onNavigate} />
            ))}
          </>
        )}

        {sections.admin && (
          <>
            <SectionLabel label="Admin" collapsed={collapsed} />
            {adminItems.map(({ page, label, icon }) => (
              <NavItem key={page} page={page} label={label} icon={icon}
                active={currentPage === page} collapsed={collapsed} onNavigate={onNavigate} />
            ))}
          </>
        )}
      </nav>

      {/* Collapse toggle */}
      <div className="px-2 py-3 border-t border-slate-800">
        <button
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg text-xs transition-colors"
        >
          <span className="text-sm">{collapsed ? "→" : "←"}</span>
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </div>
  );
}
