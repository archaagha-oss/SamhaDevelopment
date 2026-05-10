import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { FileText } from "lucide-react";
import ContractStatusModal, { ContractDoc, ContractStatus } from "../components/ContractStatusModal";
import DocumentUploadModal from "../components/DocumentUploadModal";
import { PageContainer, PageHeader } from "../components/layout";
import { Button } from "@/components/ui/button";
import EmptyState from "../components/EmptyState";
import { Skeleton, SkeletonTableRows } from "../components/Skeleton";

interface Document extends ContractDoc {
  dealId: string;
  mimeType: string;
  uploadedBy: string;
  expiryDate?: string;
  createdAt: string;
}

const CONTRACT_STATUS_CONFIG: Record<ContractStatus, { label: string; badge: string }> = {
  DRAFT:    { label: "Draft",    badge: "bg-muted text-muted-foreground" },
  SENT:     { label: "Sent",     badge: "bg-info-soft text-primary"   },
  SIGNED:   { label: "Signed",   badge: "bg-success-soft text-success" },
  ARCHIVED: { label: "Archived", badge: "bg-neutral-200 text-muted-foreground" },
};

const DOC_TYPE_CONFIG: Record<string, { label: string; badge: string }> = {
  SPA:               { label: "SPA",              badge: "bg-info-soft text-primary"    },
  OQOOD_CERTIFICATE: { label: "Oqood",            badge: "bg-chart-7/15 text-chart-7" },
  RESERVATION_FORM:  { label: "Reservation Form", badge: "bg-warning-soft text-warning" },
  PAYMENT_RECEIPT:   { label: "Payment Receipt",  badge: "bg-success-soft text-success"  },
  PASSPORT:          { label: "Passport",         badge: "bg-chart-7/15 text-chart-7"    },
  EMIRATES_ID:       { label: "Emirates ID",      badge: "bg-stage-active text-stage-active-foreground"},
  VISA:              { label: "Visa",             badge: "bg-chart-5/15 text-chart-5"    },
  OTHER:             { label: "Other",            badge: "bg-muted text-muted-foreground"  },
};

const CONTRACT_STATUS_ORDER: ContractStatus[] = ["DRAFT", "SENT", "SIGNED", "ARCHIVED"];

const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });

export default function ContractsPage() {
  const navigate = useNavigate();
  const [documents, setDocuments]   = useState<Document[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filterStatus, setFilterStatus] = useState<ContractStatus | "ALL">("ALL");
  const [filterType, setFilterType] = useState("ALL");
  const [search, setSearch]         = useState("");
  const [statusModal, setStatusModal]   = useState<Document | null>(null);
  const [uploadDealId, setUploadDealId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    axios.get("/api/documents", { params: { contractStatus: filterStatus === "ALL" ? undefined : filterStatus } })
      .then((r) => setDocuments(r.data.data || []))
      .catch((err: any) => {
        console.error(err);
        toast.error(err?.response?.data?.error || "Failed to load documents");
      })
      .finally(() => setLoading(false));
  }, [filterStatus]);

  useEffect(() => { load(); }, [load]);

  const docTypes = Array.from(new Set(documents.map((d) => d.type))).filter(Boolean);

  const filtered = documents.filter((d) => {
    if (filterType !== "ALL" && d.type !== filterType) return false;
    if (search) {
      const q = search.toLowerCase();
      const matches =
        d.name.toLowerCase().includes(q) ||
        d.deal.dealNumber.toLowerCase().includes(q) ||
        `${d.deal.lead.firstName} ${d.deal.lead.lastName}`.toLowerCase().includes(q) ||
        d.deal.unit.unitNumber.toLowerCase().includes(q);
      if (!matches) return false;
    }
    return true;
  });

  // KPI counts
  const counts = CONTRACT_STATUS_ORDER.reduce<Record<string, number>>((acc, s) => {
    acc[s] = documents.filter((d) => d.contractStatus === s).length;
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader
        crumbs={[{ label: "Home", path: "/" }, { label: "Contracts" }]}
        title="Contracts"
        subtitle="Manage contract lifecycle and supporting documents across all deals"
        actions={<Button variant="outline" onClick={load}>Refresh</Button>}
      />

      <PageContainer padding="default" className="space-y-5">
      {/* Status KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {CONTRACT_STATUS_ORDER.map((status) => {
          const cfg = CONTRACT_STATUS_CONFIG[status];
          const isActive = filterStatus === status;
          return (
            <button
              key={status}
              onClick={() => setFilterStatus(isActive ? "ALL" : status)}
              className={`rounded-xl p-4 text-left border-2 transition-all bg-card ${
                isActive ? "border-border shadow-sm" : "border-transparent hover:border-border"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{cfg.label}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>{counts[status] ?? 0}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{counts[status] ?? 0}</p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search by name, deal #, buyer, unit..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring w-72"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="ALL">All Types</option>
          {docTypes.map((t) => (
            <option key={t} value={t}>{DOC_TYPE_CONFIG[t]?.label || t}</option>
          ))}
        </select>
        {(filterStatus !== "ALL" || filterType !== "ALL" || search) && (
          <button
            onClick={() => { setFilterStatus("ALL"); setFilterType("ALL"); setSearch(""); }}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Clear filters
          </button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} document{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Table (md+) / Card list (mobile) */}
      {loading ? (
        <>
          <div className="hidden md:block bg-card rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                <SkeletonTableRows rows={5} cols={8} />
              </tbody>
            </table>
          </div>
          <div className="md:hidden space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-card rounded-xl border border-border p-4 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            ))}
          </div>
        </>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-10 text-muted-foreground" aria-hidden="true" />}
          title={search || filterStatus !== "ALL" || filterType !== "ALL" ? "No documents match your filters" : "No documents yet"}
          description={search || filterStatus !== "ALL" || filterType !== "ALL" ? "Try clearing your filters or search." : "Upload SPA, Oqood, or other contract documents from a deal's documents tab."}
          action={
            search || filterStatus !== "ALL" || filterType !== "ALL"
              ? undefined
              : { label: "Browse deals", onClick: () => navigate("/deals") }
          }
        />
      ) : (
        <>
          {/* Desktop / tablet table */}
          <div className="hidden md:block bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm min-w-[900px]">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    {["Document", "Type", "Deal", "Buyer", "Unit", "Contract Status", "Uploaded", "Actions"].map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((doc) => {
                    const typeCfg   = DOC_TYPE_CONFIG[doc.type]   || { label: doc.type,             badge: "bg-muted text-muted-foreground" };
                    const statusCfg = CONTRACT_STATUS_CONFIG[doc.contractStatus] || { label: doc.contractStatus, badge: "bg-muted text-muted-foreground" };
                    return (
                      <tr key={doc.id} className="hover:bg-muted/80 transition-colors">
                        <td className="px-4 py-3 max-w-[200px]">
                          <p className="font-medium text-foreground truncate" title={doc.name}>{doc.name}</p>
                          <p className="text-xs text-muted-foreground">{doc.mimeType.split("/")[1]?.toUpperCase()}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeCfg.badge}`}>
                            {typeCfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{doc.deal.dealNumber}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{doc.deal.lead.firstName} {doc.deal.lead.lastName}</p>
                        </td>
                        <td className="px-4 py-3 text-foreground">{doc.deal.unit.unitNumber}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusCfg.badge}`}>
                            {statusCfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{fmtDate(doc.createdAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setStatusModal(doc)}
                              className="text-xs font-medium px-2 py-1 rounded-md border border-primary/40 bg-info-soft text-primary hover:bg-info-soft transition-colors whitespace-nowrap"
                            >
                              Update Status
                            </button>
                            <button
                              onClick={() => setUploadDealId(doc.dealId)}
                              className="text-xs font-medium px-2 py-1 rounded-md border border-border bg-muted/50 text-muted-foreground hover:bg-muted transition-colors"
                            >
                              + Upload
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile card list */}
          <ul className="md:hidden space-y-3" aria-label="Documents list">
            {filtered.map((doc) => {
              const typeCfg   = DOC_TYPE_CONFIG[doc.type]   || { label: doc.type,             badge: "bg-muted text-muted-foreground" };
              const statusCfg = CONTRACT_STATUS_CONFIG[doc.contractStatus] || { label: doc.contractStatus, badge: "bg-muted text-muted-foreground" };
              return (
                <li key={doc.id} className="bg-card rounded-xl border border-border p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate" title={doc.name}>{doc.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{doc.mimeType.split("/")[1]?.toUpperCase()} · uploaded {fmtDate(doc.createdAt)}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${typeCfg.badge}`}>{typeCfg.label}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Deal</p>
                      <p className="font-mono text-foreground">{doc.deal.dealNumber}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Unit</p>
                      <p className="text-foreground">{doc.deal.unit.unitNumber}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Buyer</p>
                      <p className="text-foreground font-medium truncate">{doc.deal.lead.firstName} {doc.deal.lead.lastName}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusCfg.badge}`}>{statusCfg.label}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setStatusModal(doc)}
                        className="text-xs font-medium px-2 py-1 rounded-md border border-primary/40 bg-info-soft text-primary hover:bg-info-soft transition-colors"
                      >
                        Update
                      </button>
                      <button
                        onClick={() => setUploadDealId(doc.dealId)}
                        className="text-xs font-medium px-2 py-1 rounded-md border border-border bg-muted/50 text-muted-foreground hover:bg-muted transition-colors"
                      >
                        + Upload
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* Stage requirements summary */}
      {!loading && documents.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Document Type Summary</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(
              documents.reduce<Record<string, { total: number; signed: number }>>((acc, d) => {
                const t = d.type;
                if (!acc[t]) acc[t] = { total: 0, signed: 0 };
                acc[t].total++;
                if (d.contractStatus === "SIGNED") acc[t].signed++;
                return acc;
              }, {})
            ).map(([type, stats]) => {
              const cfg = DOC_TYPE_CONFIG[type] || { label: type, badge: "bg-muted text-muted-foreground" };
              return (
                <div key={type} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/50">
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${cfg.badge}`}>{cfg.label}</span>
                  <span className="text-xs text-muted-foreground">{stats.total} total</span>
                  <span className="text-xs text-success font-medium">{stats.signed} signed</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {statusModal && (
        <ContractStatusModal
          document={statusModal}
          onClose={() => setStatusModal(null)}
          onSuccess={() => { setStatusModal(null); load(); }}
        />
      )}

      {uploadDealId && (
        <DocumentUploadModal
          dealId={uploadDealId}
          onClose={() => setUploadDealId(null)}
          onSaved={() => { setUploadDealId(null); load(); }}
        />
      )}
      </PageContainer>
    </div>
  );
}
