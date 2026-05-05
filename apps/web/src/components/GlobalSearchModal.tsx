import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  type: "lead" | "unit" | "deal";
  status?: string;
}

interface SearchResults {
  leads: SearchResult[];
  units: SearchResult[];
  deals: SearchResult[];
}

interface GlobalSearchModalProps {
  open: boolean;
  onClose: () => void;
}

const TABS = ["all", "leads", "units", "deals"] as const;
type Tab = (typeof TABS)[number];

// ── helpers ─────────────────────────────────────────────────────────────────

function mapLeads(data: any[]): SearchResult[] {
  return data.map((l) => ({
    id: l.id,
    title: l.name ?? "Unknown Lead",
    subtitle: [l.email, l.phone].filter(Boolean).join(" · "),
    type: "lead",
    status: l.stage,
  }));
}

function mapUnits(data: any[]): SearchResult[] {
  return data.map((u) => ({
    id: u.id,
    title: `Unit ${u.unitNumber}`,
    subtitle: [u.type, u.project?.name, u.floor != null ? `Floor ${u.floor}` : undefined]
      .filter(Boolean)
      .join(" · "),
    type: "unit",
    status: u.status,
  }));
}

function mapDeals(data: any[]): SearchResult[] {
  return data.map((d) => ({
    id: d.id,
    title: d.dealNumber ?? d.id,
    subtitle: [d.lead?.name, d.unit?.unitNumber ? `Unit ${d.unit.unitNumber}` : undefined]
      .filter(Boolean)
      .join(" · "),
    type: "deal",
    status: d.stage,
  }));
}

const statusColor: Record<string, string> = {
  available:    "text-emerald-400",
  reserved:     "text-amber-400",
  booked:       "text-blue-300",
  sold:         "text-blue-400",
  handed_over:  "text-purple-400",
  blocked:      "text-slate-400",
  new:          "text-sky-400",
  contacted:    "text-yellow-400",
  qualified:    "text-amber-400",
  negotiating:  "text-orange-400",
  closed_won:   "text-emerald-400",
  closed_lost:  "text-red-400",
  spa_signed:   "text-blue-300",
  oqood_registered: "text-purple-400",
  cancelled:    "text-red-400",
};

function getStatusColor(status?: string) {
  return statusColor[status?.toLowerCase() ?? ""] ?? "text-slate-400";
}

const typeIcon: Record<SearchResult["type"], string> = {
  lead:  "◎",
  deal:  "◈",
  unit:  "⊞",
};

// ── component ────────────────────────────────────────────────────────────────

export default function GlobalSearchModal({ open, onClose }: GlobalSearchModalProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [query, setQuery]         = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [results, setResults]     = useState<SearchResults>({ leads: [], units: [], deals: [] });
  const [loading, setLoading]     = useState(false);

  // Focus input when modal opens, reset state
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults({ leads: [], units: [], deals: [] });
      setActiveTab("all");
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Debounced search
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults({ leads: [], units: [], deals: [] }); return; }
    setLoading(true);
    try {
      const [leadsRes, unitsRes, dealsRes] = await Promise.allSettled([
        axios.get("/api/leads",  { params: { search: q, limit: 5 } }),
        axios.get("/api/units",  { params: { search: q, limit: 5 } }),
        axios.get("/api/deals",  { params: { search: q, limit: 5 } }),
      ]);
      setResults({
        leads: leadsRes.status === "fulfilled"
          ? mapLeads(leadsRes.value.data.data ?? leadsRes.value.data ?? []) : [],
        units: unitsRes.status === "fulfilled"
          ? mapUnits(unitsRes.value.data.data ?? unitsRes.value.data ?? []) : [],
        deals: dealsRes.status === "fulfilled"
          ? mapDeals(dealsRes.value.data.data ?? dealsRes.value.data ?? []) : [],
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  if (!open) return null;

  const handleSelect = (r: SearchResult) => {
    onClose();
    if (r.type === "lead") navigate(`/leads/${r.id}`);
    else if (r.type === "deal") navigate(`/deals/${r.id}`);
    else navigate("/units");
  };

  const visible: SearchResult[] =
    activeTab === "all"
      ? [...results.leads, ...results.units, ...results.deals]
      : results[activeTab];

  const totalCount =
    results.leads.length + results.units.length + results.deals.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] px-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-700 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search bar */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-700">
          <span className="text-slate-400 text-lg flex-shrink-0">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search leads, units, deals…"
            className="flex-1 bg-transparent text-slate-100 text-base placeholder-slate-500 focus:outline-none"
          />
          {loading && (
            <span className="text-slate-500 text-sm flex-shrink-0">Searching…</span>
          )}
          <button
            onClick={onClose}
            className="flex-shrink-0 text-slate-500 hover:text-slate-300 text-xs px-2 py-1 rounded border border-slate-700 font-mono transition-colors"
          >
            Esc
          </button>
        </div>

        {/* Tab bar — shown only after a query */}
        {query && totalCount > 0 && (
          <div className="flex items-center gap-1 px-4 py-2 border-b border-slate-800 bg-slate-900/50">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                  activeTab === tab
                    ? "bg-blue-600 text-white"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
              >
                {tab}
                {tab !== "all" && results[tab].length > 0 && (
                  <span className="ml-1.5 opacity-70">{results[tab].length}</span>
                )}
                {tab === "all" && totalCount > 0 && (
                  <span className="ml-1.5 opacity-70">{totalCount}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Results list */}
        <div className="max-h-[55vh] overflow-y-auto divide-y divide-slate-800/60">
          {!query && (
            <div className="px-5 py-12 text-center text-slate-500 text-sm">
              Start typing to search across leads, units, and deals
            </div>
          )}

          {query && !loading && visible.length === 0 && (
            <div className="px-5 py-12 text-center text-slate-500 text-sm">
              No results for <span className="text-slate-300">"{query}"</span>
            </div>
          )}

          {visible.map((r) => (
            <button
              key={`${r.type}-${r.id}`}
              onClick={() => handleSelect(r)}
              className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-slate-800 transition-colors text-left group"
            >
              <span className="text-slate-500 text-lg w-5 text-center flex-shrink-0 group-hover:text-slate-300 transition-colors">
                {typeIcon[r.type]}
              </span>

              <div className="flex-1 min-w-0">
                <p className="text-slate-100 text-sm font-medium truncate">{r.title}</p>
                {r.subtitle && (
                  <p className="text-slate-500 text-xs truncate mt-0.5">{r.subtitle}</p>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {r.status && (
                  <span className={`text-xs font-medium capitalize ${getStatusColor(r.status)}`}>
                    {r.status.toLowerCase().replace(/_/g, " ")}
                  </span>
                )}
                <span className="text-[10px] text-slate-600 bg-slate-800 px-2 py-0.5 rounded-full capitalize border border-slate-700">
                  {r.type}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Footer hints */}
        <div className="px-5 py-2.5 border-t border-slate-800 flex items-center gap-5 text-[11px] text-slate-600">
          <span>
            <kbd className="font-mono bg-slate-800 px-1 rounded">↑↓</kbd> navigate
          </span>
          <span>
            <kbd className="font-mono bg-slate-800 px-1 rounded">↵</kbd> select
          </span>
          <span>
            <kbd className="font-mono bg-slate-800 px-1 rounded">Esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
