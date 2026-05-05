import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { useDeals } from "../hooks/useDeals";
import DealFormModal from "./DealFormModal";
import DealEditModal from "./DealEditModal";
import EmptyState from "./EmptyState";

interface Deal {
  id: string; dealNumber: string;
  lead: { firstName: string; lastName: string };
  unit: { unitNumber: string; type: string; price: number };
  stage: string; salePrice: number; discount: number; reservationDate: string;
  payments?: { status: string; amount: number }[];
  commission?: { status: string; amount: number };
  oqoodDeadline?: string;
}

const STAGES = ["RESERVATION_PENDING","RESERVATION_CONFIRMED","SPA_PENDING","SPA_SENT","SPA_SIGNED","OQOOD_PENDING","OQOOD_REGISTERED","INSTALLMENTS_ACTIVE","HANDOVER_PENDING","COMPLETED","CANCELLED"];

const STAGE_BADGE: Record<string, string> = {
  RESERVATION_PENDING:   "bg-slate-100 text-slate-600",
  RESERVATION_CONFIRMED: "bg-blue-100 text-blue-700",
  SPA_PENDING:           "bg-yellow-100 text-yellow-700",
  SPA_SENT:              "bg-yellow-100 text-yellow-700",
  SPA_SIGNED:            "bg-violet-100 text-violet-700",
  OQOOD_PENDING:         "bg-orange-100 text-orange-700",
  OQOOD_REGISTERED:      "bg-teal-100 text-teal-700",
  INSTALLMENTS_ACTIVE:   "bg-indigo-100 text-indigo-700",
  HANDOVER_PENDING:      "bg-emerald-100 text-emerald-700",
  COMPLETED:             "bg-emerald-100 text-emerald-700",
  CANCELLED:             "bg-red-100 text-red-700",
};

const COM_BADGE: Record<string, string> = {
  NOT_DUE: "text-slate-400", PENDING_APPROVAL: "text-amber-600 font-semibold",
  APPROVED: "text-blue-600 font-semibold", PAID: "text-emerald-600 font-semibold",
  CANCELLED: "text-red-500",
};

function paymentProgress(deal: Deal) {
  if (!deal.payments?.length) return 0;
  return Math.round(deal.payments.filter((p) => p.status === "PAID").length / deal.payments.length * 100);
}

interface Props {
  onViewDeal?: (id: string) => void;
}

export default function DealsPage({ onViewDeal }: Props = {}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [showNewDeal, setShowNewDeal] = useState(false);
  const [selectedStage, setSelectedStage] = useState<string | null>(searchParams.get("stage"));
  const [currentPage, setCurrentPage] = useState(Number(searchParams.get("page")) || 1);
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get("q") || "");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const [sortCol, setSortCol] = useState<string>(searchParams.get("sort") || "reservationDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">((searchParams.get("dir") as "asc" | "desc") || "desc");
  const [editDeal, setEditDeal] = useState<Deal | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  // Debounce search input 350ms before firing API call
  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(val);
      setCurrentPage(1);
    }, 350);
  };

  const { data: dealsResponse, isLoading } = useDeals(currentPage, 50, selectedStage, debouncedSearch || undefined);
  const deals = (dealsResponse?.data || []) as Deal[];
  const totalPages = dealsResponse?.pagination.pages || 1;
  const total = dealsResponse?.pagination.total || 0;

  useEffect(() => { setCurrentPage(1); }, [selectedStage]);

  // Sync filters → URL
  useEffect(() => {
    const p: Record<string, string> = {};
    if (debouncedSearch) p.q = debouncedSearch;
    if (selectedStage)   p.stage = selectedStage;
    if (currentPage > 1) p.page  = String(currentPage);
    if (sortCol !== "reservationDate") p.sort = sortCol;
    if (sortDir !== "desc") p.dir = sortDir;
    setSearchParams(p, { replace: true });
  }, [debouncedSearch, selectedStage, currentPage, sortCol, sortDir]);

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const colAccessor: Record<string, (d: Deal) => any> = {
    dealNumber: (d) => d.dealNumber,
    buyer: (d) => `${d.lead.firstName} ${d.lead.lastName}`,
    unit: (d) => d.unit.unitNumber,
    stage: (d) => d.stage,
    salePrice: (d) => d.salePrice,
    reservationDate: (d) => d.reservationDate,
  };

  const sorted = [...deals].sort((a, b) => {
    const av = colAccessor[sortCol]?.(a) ?? "";
    const bv = colAccessor[sortCol]?.(b) ?? "";
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === "asc" ? cmp : -cmp;
  });

  const SortIcon = ({ col }: { col: string }) => (
    <span className={`ml-1 text-[10px] ${sortCol === col ? "text-slate-700" : "text-slate-300"}`}>
      {sortCol === col ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
    </span>
  );

  const handleQuickCancel = async (deal: Deal) => {
    const reason = prompt("Cancel reason:");
    if (!reason) return;
    setCancelingId(deal.id);
    try {
      await axios.patch(`/api/deals/${deal.id}/stage`, { newStage: "CANCELLED", reason });
      toast.success("Deal cancelled");
      queryClient.invalidateQueries({ queryKey: ["deals"] });
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to cancel deal");
    } finally {
      setCancelingId(null);
    }
  };

  const filtered = sorted;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Deals</h1>
            <p className="text-slate-400 text-xs mt-0.5">{total} deals {selectedStage ? `· ${selectedStage.replace(/_/g," ")}` : "· all stages"}</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search deal, buyer, unit…"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 w-56 focus:outline-none focus:border-blue-400 bg-slate-50"
            />
            <button
              onClick={() => setShowNewDeal(true)}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5"
            >
              <span className="text-base leading-none">+</span> New Deal
            </button>
          </div>
        </div>
        {/* Stage filters */}
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setSelectedStage(null)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${!selectedStage ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >All</button>
          {STAGES.map((s) => (
            <button
              key={s}
              onClick={() => setSelectedStage(s === selectedStage ? null : s)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${selectedStage === s ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >{s.replace(/_/g," ")}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto scrollbar-thin">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
              <tr>
                {[
                  { label: "Deal #", col: "dealNumber" },
                  { label: "Buyer", col: "buyer" },
                  { label: "Unit", col: "unit" },
                  { label: "Stage", col: "stage" },
                  { label: "Sale Price", col: "salePrice" },
                  { label: "Payments", col: null },
                  { label: "Commission", col: null },
                  { label: "", col: null },
                ].map(({ label, col }) => (
                  <th
                    key={label || "actions"}
                    onClick={col ? () => handleSort(col) : undefined}
                    className={`text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap ${col ? "cursor-pointer hover:text-slate-800 select-none" : ""}`}
                  >
                    {label}{col && <SortIcon col={col} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={8}>
                  <EmptyState
                    icon="◈"
                    title={debouncedSearch || selectedStage ? "No deals match your filters" : "No deals yet"}
                    description={debouncedSearch || selectedStage ? "Try adjusting your search or stage filter." : "Create your first deal to get started."}
                    action={!debouncedSearch && !selectedStage ? { label: "New Deal", onClick: () => setShowNewDeal(true) } : undefined}
                  />
                </td></tr>
              ) : filtered.map((deal) => {
                const pct = paymentProgress(deal);
                const isMenuOpen = openMenuId === deal.id;
                return (
                  <tr
                    key={deal.id}
                    onClick={() => onViewDeal ? onViewDeal(deal.id) : navigate(`/deals/${deal.id}`)}
                    className="hover:bg-blue-50/50 cursor-pointer transition-colors group"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{deal.dealNumber}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                        {deal.lead.firstName} {deal.lead.lastName}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-700">{deal.unit.unitNumber}</p>
                      <p className="text-xs text-slate-400">{deal.unit.type}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STAGE_BADGE[deal.stage] || "bg-slate-100 text-slate-600"}`}>
                        {deal.stage.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">AED {deal.salePrice.toLocaleString()}</p>
                      {deal.discount > 0 && <p className="text-xs text-emerald-600">-{deal.discount.toLocaleString()}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-slate-500">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {deal.commission ? (
                        <span className={`text-xs ${COM_BADGE[deal.commission.status] || "text-slate-500"}`}>
                          {deal.commission.status.replace(/_/g, " ")}
                        </span>
                      ) : <span className="text-xs text-slate-300">—</span>}
                    </td>
                    {/* Kebab menu */}
                    <td className="px-2 py-3 relative" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setOpenMenuId(isMenuOpen ? null : deal.id)}
                        className="p-1.5 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        ⋮
                      </button>
                      {isMenuOpen && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                          <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1">
                            <button
                              onClick={() => { setOpenMenuId(null); navigate(`/deals/${deal.id}`); }}
                              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            >
                              View Details
                            </button>
                            <button
                              onClick={() => { setOpenMenuId(null); setEditDeal(deal); }}
                              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            >
                              Edit Deal
                            </button>
                            {deal.stage !== "CANCELLED" && deal.stage !== "COMPLETED" && (
                              <button
                                onClick={() => { setOpenMenuId(null); handleQuickCancel(deal); }}
                                disabled={cancelingId === deal.id}
                                className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 disabled:opacity-50"
                              >
                                Cancel Deal
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-t border-slate-200 flex-shrink-0">
        <p className="text-xs text-slate-500">Page {currentPage} of {totalPages}</p>
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >← Prev</button>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >Next →</button>
        </div>
      </div>

      {showNewDeal && (
        <DealFormModal
          onClose={() => setShowNewDeal(false)}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ["deals"] });
            setShowNewDeal(false);
          }}
        />
      )}
      {editDeal && (
        <DealEditModal
          deal={editDeal as any}
          onClose={() => setEditDeal(null)}
          onSaved={() => { setEditDeal(null); queryClient.invalidateQueries({ queryKey: ["deals"] }); }}
        />
      )}
    </div>
  );
}
