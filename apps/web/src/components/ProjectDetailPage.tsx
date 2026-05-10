import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useFeatureFlag } from "../hooks/useFeatureFlag";
import axios from "axios";
import { Pencil } from "lucide-react";
import UnitsTable from "./UnitsTable";
import ProjectUpdatesTab from "./ProjectUpdatesTab";
import ProjectStatusHistoryPanel from "./ProjectStatusHistoryPanel";
import { StageBadge } from "./ui/stage-badge";

interface Project {
  id: string;
  name: string;
  location: string;
  description?: string;
  totalUnits: number;
  totalFloors?: number;
  projectStatus: "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
  completionStatus?: "OFF_PLAN" | "UNDER_CONSTRUCTION" | "READY";
  handoverDate: string;
  launchDate?: string;
  startDate?: string;
  createdAt?: string;
  _count?: { units: number };
}

// Project lifecycle status → semantic stage tone tokens.
// See: design-system/MASTER.md
const PROJECT_STATUS: Record<string, { label: string; cls: string }> = {
  ACTIVE:    { label: "Active",    cls: "bg-stage-success text-stage-success-foreground" },
  ON_HOLD:   { label: "On hold",   cls: "bg-stage-attention text-stage-attention-foreground" },
  COMPLETED: { label: "Completed", cls: "bg-stage-info text-stage-info-foreground" },
  CANCELLED: { label: "Cancelled", cls: "bg-stage-danger text-stage-danger-foreground" },
};

const COMPLETION_LABEL: Record<string, string> = {
  OFF_PLAN: "Off-Plan",
  UNDER_CONSTRUCTION: "Under construction",
  READY: "Ready",
};

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  stage: string;
  budget?: number;
}

interface Deal {
  id: string;
  dealNumber: string;
  lead: { firstName: string; lastName: string };
  unit: { unitNumber: string };
  stage: string;
  salePrice: number;
}

interface Broker {
  id: string;
  name: string;
  commissionRate: number;
  _count?: { deals: number };
}

type Tab = "overview" | "units" | "leads" | "deals" | "brokers" | "updates" | "history";

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });

const daysUntil = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const constructionEnabled = useFeatureFlag("constructionProgress");
  const escrowEnabled = useFeatureFlag("escrowModule");
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    setError(null);

    Promise.all([
      axios.get(`/api/projects/${projectId}`),
      axios.get("/api/leads", { params: { page: 1, limit: 500 } }),
      axios.get("/api/deals", { params: { page: 1, limit: 500 } }),
      axios.get("/api/brokers/companies"),
    ])
      .then(([projRes, leadsRes, dealsRes, brokersRes]) => {
        setProject(projRes.data);
        // Filter leads for this project
        const allLeads = leadsRes.data.data || [];
        const projectLeads = allLeads.filter((l: any) => !l.projectId || l.projectId === projectId).slice(0, 100);
        setLeads(projectLeads);

        // Filter deals for this project
        const allDeals = dealsRes.data.data || [];
        const projectDeals = allDeals
          .filter((d: any) => d.unit?.projectId === projectId || !d.unit?.projectId)
          .slice(0, 100);
        setDeals(projectDeals);

        setBrokers(brokersRes.data || []);
      })
      .catch((err) => {
        if (err.response?.status === 404) {
          // Project doesn't exist, redirect to projects list
          navigate("/projects");
        } else {
          setError(err.response?.data?.error || "Failed to load project");
        }
      })
      .finally(() => setLoading(false));
  }, [projectId, navigate]);

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );

  if (error || !project)
    return (
      <div className="p-6">
        <button onClick={() => navigate("/projects")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
          ← Back to Projects
        </button>
        <div className="bg-destructive-soft border border-destructive/20 rounded-lg p-6 text-center">
          <p className="text-destructive-soft-foreground font-medium">{error || "Project not found"}</p>
        </div>
      </div>
    );

  const days = daysUntil(project.handoverDate);
  const handoverTone =
    days < 0 ? "text-destructive" : days < 90 ? "text-warning" : "text-success";
  const statusCfg = PROJECT_STATUS[project.projectStatus] || PROJECT_STATUS.ACTIVE;
  const completionLabel = project.completionStatus ? COMPLETION_LABEL[project.completionStatus] : null;

  const dealCount   = deals.length;
  const leadCount   = leads.length;
  const brokerCount = brokers.length;
  const activeLeads = leads.filter((l) => !["CLOSED_WON", "CLOSED_LOST"].includes(l.stage)).length;
  const openDeals   = deals.filter((d) => !["COMPLETED", "CANCELLED"].includes(d.stage)).length;
  const handoverFmt = fmtDate(project.handoverDate);
  const daysLabel   = days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Sticky header — compact title row + meta line + KPI strip + tabs */}
      <div className="bg-card border-b border-border flex-shrink-0">
        <div className="px-4 sm:px-6 pt-4 pb-3">
          <button
            onClick={() => navigate("/projects")}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-2"
          >
            ← Projects
          </button>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground truncate">{project.name}</h1>
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold whitespace-nowrap ${statusCfg.cls}`}>
                  {statusCfg.label}
                </span>
              </div>
              {/* One-line meta — replaces 3 stacked rows of location/desc */}
              <p className="text-sm text-muted-foreground mt-1">
                <span>{project.location}</span>
                {completionLabel && <> <span className="opacity-50">·</span> {completionLabel}</>}
                <> <span className="opacity-50">·</span> Handover {handoverFmt} <span className={handoverTone}>({daysLabel})</span></>
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/projects/${projectId}/settings`)}
              className="px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 text-sm font-medium rounded-lg hover:bg-primary/15 transition-colors whitespace-nowrap inline-flex items-center gap-1.5"
            >
              <Pencil className="size-3.5" aria-hidden="true" />
              Edit
            </button>
          </div>
        </div>

        {/* KPI strip — 4 actionable metrics */}
        <div className="px-4 sm:px-6 pb-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi label="Total units" value={project.totalUnits} />
          <Kpi
            label="Handover"
            value={handoverFmt}
            sub={daysLabel}
            valueClass={handoverTone}
          />
          <Kpi label="Active leads" value={activeLeads} accent="text-chart-1" />
          <Kpi label="Open deals"   value={openDeals}   accent="text-accent-2" />
        </div>

        {/* Tab nav — underline style, matches Settings page */}
        <div
          className="px-4 sm:px-6 flex gap-1 overflow-x-auto border-t border-border"
          role="tablist"
          aria-label="Project sections"
        >
          {([
            { key: "overview", label: "Overview" },
            { key: "units",    label: "Units" },
            { key: "leads",    label: `Leads (${leadCount})` },
            { key: "deals",    label: `Deals (${dealCount})` },
            { key: "brokers",  label: `Brokers (${brokerCount})` },
            { key: "updates",  label: "Updates" },
            { key: "history",  label: "History" },
          ] as const).map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key as Tab)}
                role="tab"
                aria-selected={active}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            );
          })}
          {/* Sub-page links — navigate to dedicated routes (Phase 4 modules,
              flag-gated). Render as link-tabs so they sit alongside the
              real tabs but don't try to fake an active state. */}
          {projectId && (
            <>
              <Link
                to={`/projects/${projectId}/phases`}
                className="px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
              >
                Phases →
              </Link>
              <Link
                to={`/projects/${projectId}/type-plans`}
                className="px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
              >
                Type plans →
              </Link>
              {constructionEnabled && (
                <Link
                  to={`/projects/${projectId}/construction`}
                  className="px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                >
                  Construction →
                </Link>
              )}
              {escrowEnabled && (
                <Link
                  to={`/projects/${projectId}/escrow`}
                  className="px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                >
                  Escrow →
                </Link>
              )}
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {/* Overview Tab — slim: handover countdown + lead/deal snapshot */}
        {tab === "overview" && (
          <div className="p-4 sm:p-6 space-y-6">
            <section className="bg-card rounded-lg border border-border p-6">
              <header className="mb-4">
                <h2 className="text-sm font-semibold text-foreground">Handover countdown</h2>
                <p className="text-xs text-muted-foreground">Time remaining until {handoverFmt}.</p>
              </header>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-sm text-muted-foreground">Days to handover</span>
                <span className={`text-lg font-semibold tabular-nums ${handoverTone}`}>
                  {days < 0 ? `${Math.abs(days)} overdue` : `${days} days`}
                </span>
              </div>
              <div
                className="w-full h-2 bg-muted rounded-full overflow-hidden"
                role="progressbar"
                aria-valuenow={days}
                aria-valuemin={0}
                aria-valuemax={730}
                aria-label="Handover progress"
              >
                <div
                  className={`h-full ${
                    days < 0 ? "bg-destructive" : days < 90 ? "bg-warning" : "bg-success"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, 100 - (days / 730) * 100))}%` }}
                />
              </div>
              {(project.launchDate || project.startDate) && (
                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border text-sm">
                  {project.launchDate && (
                    <div>
                      <p className="text-xs text-muted-foreground">Launch</p>
                      <p className="font-medium text-foreground">{fmtDate(project.launchDate)}</p>
                    </div>
                  )}
                  {project.startDate && (
                    <div>
                      <p className="text-xs text-muted-foreground">Start</p>
                      <p className="font-medium text-foreground">{fmtDate(project.startDate)}</p>
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="bg-card rounded-lg border border-border p-6">
              <header className="mb-4">
                <h2 className="text-sm font-semibold text-foreground">Pipeline snapshot</h2>
                <p className="text-xs text-muted-foreground">Lead and deal activity tied to this project.</p>
              </header>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Active leads</p>
                  <p className="text-2xl font-semibold tabular-nums text-foreground">{activeLeads}</p>
                  <p className="text-xs text-muted-foreground">{leadCount} total</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Open deals</p>
                  <p className="text-2xl font-semibold tabular-nums text-foreground">{openDeals}</p>
                  <p className="text-xs text-muted-foreground">{dealCount} total</p>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* History Tab — promoted from buried section */}
        {tab === "history" && projectId && (
          <div className="p-4 sm:p-6">
            <section className="bg-card rounded-lg border border-border p-6">
              <ProjectStatusHistoryPanel projectId={projectId} />
            </section>
          </div>
        )}

        {/* Leads Tab */}
        {tab === "leads" && (
          <div className="p-4 sm:p-6">
            {leads.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No leads found for this project</p>
            ) : (
              <div className="bg-card rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr className="text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Phone</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Budget</th>
                      <th className="px-4 py-3">Stage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {leads.map((lead) => (
                      <tr
                        key={lead.id}
                        className="hover:bg-muted/40 cursor-pointer"
                        onClick={() => navigate(`/leads/${lead.id}`)}
                      >
                        <td className="px-4 py-3 font-medium text-foreground">
                          {lead.firstName} {lead.lastName}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{lead.phone}</td>
                        <td className="px-4 py-3 text-muted-foreground">{lead.email || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground tabular-nums">
                          {lead.budget ? `AED ${lead.budget.toLocaleString()}` : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <StageBadge kind="lead" stage={lead.stage} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Deals Tab */}
        {tab === "deals" && (
          <div className="p-4 sm:p-6">
            {deals.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No deals found for this project</p>
            ) : (
              <div className="bg-card rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr className="text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-3">Deal #</th>
                      <th className="px-4 py-3">Buyer</th>
                      <th className="px-4 py-3">Unit</th>
                      <th className="px-4 py-3">Sale Price</th>
                      <th className="px-4 py-3">Stage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {deals.map((deal) => (
                      <tr
                        key={deal.id}
                        className="hover:bg-muted/40 cursor-pointer"
                        onClick={() => navigate(`/deals/${deal.id}`)}
                      >
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{deal.dealNumber}</td>
                        <td className="px-4 py-3 text-foreground">
                          {deal.lead.firstName} {deal.lead.lastName}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{deal.unit.unitNumber}</td>
                        <td className="px-4 py-3 font-medium text-foreground tabular-nums">
                          AED {deal.salePrice.toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <StageBadge kind="deal" stage={deal.stage} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Brokers Tab */}
        {tab === "brokers" && (
          <div className="p-4 sm:p-6">
            {brokers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No brokers found</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {brokers.map((broker) => (
                  <div
                    key={broker.id}
                    className="bg-card rounded-lg border border-border p-4 hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="font-semibold text-foreground">{broker.name}</h4>
                      <span className="px-2 py-1 bg-stage-attention text-stage-attention-foreground rounded text-xs font-medium tabular-nums">
                        {broker.commissionRate}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Associated Deals</span>
                      <span className="font-semibold text-foreground tabular-nums">{broker._count?.deals || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Units Tab */}
        {tab === "units" && projectId && (
          <UnitsTable projectId={projectId} />
        )}

        {/* Updates Tab */}
        {tab === "updates" && projectId && (
          <ProjectUpdatesTab projectId={projectId} />
        )}
      </div>

    </div>
  );
}

// ─── Subcomponents ──────────────────────────────────────────────────────

function Kpi({
  label,
  value,
  sub,
  accent,
  valueClass,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-card rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-xl font-semibold tabular-nums ${valueClass ?? accent ?? "text-foreground"}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}
