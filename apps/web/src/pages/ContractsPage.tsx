import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import ContractStatusModal, { ContractDoc, ContractStatus } from "../components/ContractStatusModal";
import DocumentUploadModal from "../components/DocumentUploadModal";

interface Document extends ContractDoc {
  dealId: string;
  mimeType: string;
  uploadedBy: string;
  expiryDate?: string;
  createdAt: string;
}

const CONTRACT_STATUS_CONFIG: Record<ContractStatus, { label: string; badge: string }> = {
  DRAFT:    { label: "Draft",    badge: "bg-slate-100 text-slate-600" },
  SENT:     { label: "Sent",     badge: "bg-blue-100 text-blue-700"   },
  SIGNED:   { label: "Signed",   badge: "bg-emerald-100 text-emerald-700" },
  ARCHIVED: { label: "Archived", badge: "bg-slate-200 text-slate-500" },
};

const DOC_TYPE_CONFIG: Record<string, { label: string; badge: string }> = {
  SPA:               { label: "SPA",              badge: "bg-blue-100 text-blue-700"    },
  OQOOD_CERTIFICATE: { label: "Oqood",            badge: "bg-purple-100 text-purple-700" },
  RESERVATION_FORM:  { label: "Reservation Form", badge: "bg-orange-100 text-orange-700" },
  PAYMENT_RECEIPT:   { label: "Payment Receipt",  badge: "bg-green-100 text-green-700"  },
  PASSPORT:          { label: "Passport",         badge: "bg-pink-100 text-pink-700"    },
  EMIRATES_ID:       { label: "Emirates ID",      badge: "bg-indigo-100 text-indigo-700"},
  VISA:              { label: "Visa",             badge: "bg-teal-100 text-teal-700"    },
  OTHER:             { label: "Other",            badge: "bg-slate-100 text-slate-600"  },
};

const CONTRACT_STATUS_ORDER: ContractStatus[] = ["DRAFT", "SENT", "SIGNED", "ARCHIVED"];

const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });

export default function ContractsPage() {
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
      .catch(console.error)
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
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Contracts & Documents</h1>
          <p className="text-slate-400 text-xs mt-0.5">Manage contract lifecycle across all deals</p>
        </div>
        <button onClick={load} className="text-xs text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg px-3 py-1.5 transition-colors">
          Refresh
        </button>
      </div>

      {/* Status KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {CONTRACT_STATUS_ORDER.map((status) => {
          const cfg = CONTRACT_STATUS_CONFIG[status];
          const isActive = filterStatus === status;
          return (
            <button
              key={status}
              onClick={() => setFilterStatus(isActive ? "ALL" : status)}
              className={`rounded-xl p-4 text-left border-2 transition-all bg-white ${
                isActive ? "border-slate-800 shadow-sm" : "border-transparent hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{cfg.label}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>{counts[status] ?? 0}</span>
              </div>
              <p className="text-2xl font-bold text-slate-800">{counts[status] ?? 0}</p>
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
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-72"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="ALL">All Types</option>
          {docTypes.map((t) => (
            <option key={t} value={t}>{DOC_TYPE_CONFIG[t]?.label || t}</option>
          ))}
        </select>
        {(filterStatus !== "ALL" || filterType !== "ALL" || search) && (
          <button
            onClick={() => { setFilterStatus("ALL"); setFilterType("ALL"); setSearch(""); }}
            className="text-xs text-slate-500 hover:text-slate-800 underline"
          >
            Clear filters
          </button>
        )}
        <span className="text-xs text-slate-400 ml-auto">{filtered.length} document{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">No documents found</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {["Document", "Type", "Deal", "Buyer", "Unit", "Contract Status", "Uploaded", "Actions"].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((doc) => {
                  const typeCfg   = DOC_TYPE_CONFIG[doc.type]   || { label: doc.type,             badge: "bg-slate-100 text-slate-600" };
                  const statusCfg = CONTRACT_STATUS_CONFIG[doc.contractStatus] || { label: doc.contractStatus, badge: "bg-slate-100 text-slate-600" };
                  return (
                    <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="font-medium text-slate-800 truncate" title={doc.name}>{doc.name}</p>
                        <p className="text-xs text-slate-400">{doc.mimeType.split("/")[1]?.toUpperCase()}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeCfg.badge}`}>
                          {typeCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{doc.deal.dealNumber}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{doc.deal.lead.firstName} {doc.deal.lead.lastName}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{doc.deal.unit.unitNumber}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusCfg.badge}`}>
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{fmtDate(doc.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setStatusModal(doc)}
                            className="text-xs font-medium px-2 py-1 rounded-md border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors whitespace-nowrap"
                          >
                            Update Status
                          </button>
                          <button
                            onClick={() => setUploadDealId(doc.dealId)}
                            className="text-xs font-medium px-2 py-1 rounded-md border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors"
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
          )}
        </div>
      </div>

      {/* Stage requirements summary */}
      {!loading && documents.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Document Type Summary</h3>
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
              const cfg = DOC_TYPE_CONFIG[type] || { label: type, badge: "bg-slate-100 text-slate-600" };
              return (
                <div key={type} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-100 bg-slate-50">
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${cfg.badge}`}>{cfg.label}</span>
                  <span className="text-xs text-slate-500">{stats.total} total</span>
                  <span className="text-xs text-emerald-600 font-medium">{stats.signed} signed</span>
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
    </div>
  );
}
