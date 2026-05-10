import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Check, CircleDollarSign } from "lucide-react";
import EmptyState from "./EmptyState";
import { PageContainer, PageHeader } from "./layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SELECT_CLASS =
  "w-full h-10 text-sm border border-input rounded-md px-3 bg-background text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface Commission {
  id: string; amount: number; rate: number; status: string;
  spaSignedMet: boolean; oqoodMet: boolean;
  paidDate?: string; paidAmount?: number; paidVia?: string;
  deal: {
    dealNumber: string; stage: string;
    unit: { unitNumber: string };
    lead: { firstName: string; lastName: string };
    salePrice: number;
  };
  brokerCompany?: { name: string };
}
interface Stats { [status: string]: { count: number; total: number } | undefined; }

type Tab = "PENDING_APPROVAL" | "APPROVED" | "PAID";

const fmtM = (n: number) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(2)}M` : n >= 1000 ? `${(n/1000).toFixed(0)}K` : String(n);

export default function CommissionDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("PENDING_APPROVAL");
  const [pending, setPending] = useState<Commission[]>([]);
  const [approved, setApproved] = useState<Commission[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [loading, setLoading] = useState(true);
  const [paid, setPaid] = useState<Commission[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [showPayModal, setShowPayModal] = useState<Commission | null>(null);
  const [payForm, setPayForm] = useState({ paidAmount: "", paidVia: "BANK_TRANSFER", receiptKey: "" });
  const [payingId, setPayingId] = useState<string | null>(null);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      axios.get("/api/commissions/pending"),
      axios.get("/api/commissions/stats"),
      axios.get("/api/commissions", { params: { status: "APPROVED", limit: 100 } }),
      axios.get("/api/commissions", { params: { status: "PAID", limit: 100 } }),
    ]).then(([pendingRes, statsRes, approvedRes, paidRes]) => {
      setPending(pendingRes.data);
      setStats(statsRes.data);
      setApproved(approvedRes.data.data || approvedRes.data);
      setPaid(paidRes.data.data || paidRes.data);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(fetchData, []);

  const handleApprove = async (id: string) => {
    setApprovingId(id);
    try {
      await axios.patch(`/api/commissions/${id}/approve`, { approvedBy: "system" });
      toast.success("Commission approved");
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to approve");
    } finally {
      setApprovingId(null);
    }
  };

  const handleMarkPaid = async () => {
    if (!showPayModal) return;
    setPayingId(showPayModal.id);
    try {
      await axios.patch(`/api/commissions/${showPayModal.id}/paid`, {
        paidAmount: payForm.paidAmount || showPayModal.amount,
        paidVia: payForm.paidVia,
        receiptKey: payForm.receiptKey || null,
      });
      toast.success("Commission marked as paid");
      setShowPayModal(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to mark as paid");
    } finally {
      setPayingId(null);
    }
  };

  const canApprove = (c: Commission) => c.spaSignedMet && c.oqoodMet;
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });

  const kpis = [
    { label: "Pending Approval", key: "PENDING_APPROVAL", color: "text-warning",   bg: "bg-warning-soft" },
    { label: "Approved",         key: "APPROVED",         color: "text-primary",    bg: "bg-info-soft" },
    { label: "Paid",             key: "PAID",             color: "text-success", bg: "bg-success-soft" },
    { label: "Not Due",          key: "NOT_DUE",          color: "text-muted-foreground",   bg: "bg-muted/50" },
  ];

  const tableRows = tab === "PENDING_APPROVAL" ? pending : tab === "APPROVED" ? approved : paid;

  const TAB_DEFS: Array<{ id: Tab; label: string; count: number }> = [
    { id: "PENDING_APPROVAL", label: "Pending approval", count: pending.length },
    { id: "APPROVED",         label: "Ready to pay",     count: approved.length },
    { id: "PAID",             label: "Paid",             count: paid.length },
  ];

  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader
        crumbs={[{ label: "Home", path: "/" }, { label: "Commissions" }]}
        title="Commissions"
        subtitle="Review, approve and pay broker commissions"
        actions={<Button variant="outline" onClick={fetchData}>Refresh</Button>}
        tabs={
          <div
            className="flex gap-1.5 overflow-x-auto sm:flex-wrap -mx-1 px-1 scrollbar-thin py-2 items-center"
            role="tablist"
            aria-label="Commission status"
          >
            {TAB_DEFS.map(({ id, label, count }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  role="tab"
                  aria-selected={active}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {label}
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] tabular-nums ${
                    active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-card text-muted-foreground"
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        }
      />

      <PageContainer padding="default" className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(({ label, key, color, bg }) => {
          const s = stats[key];
          return (
            <div key={key} className={`${bg} rounded-xl p-4 border border-border`}>
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className={`text-2xl font-bold tabular-nums ${color}`}>{s?.count ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-0.5">AED {fmtM(s?.total ?? 0)}</p>
            </div>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-7 h-7 border-2 border-primary/40 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                {["Deal", "Buyer", "Unit", "Broker", "Amount", "Rate", tab === "PAID" ? "Paid on" : "Conditions", "Action"].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tableRows.length === 0 ? (
                <tr><td colSpan={8}>
                  <EmptyState
                    icon={<CircleDollarSign className="size-10 text-muted-foreground" aria-hidden="true" />}
                    title={tab === "PENDING_APPROVAL" ? "No commissions pending approval" : "No commissions awaiting payment"}
                    description={tab === "PENDING_APPROVAL"
                      ? "Commissions appear here once SPA is signed and Oqood is registered."
                      : "Once commissions are approved, they appear here for payment processing."}
                    action={{ label: "Browse deals", onClick: () => navigate("/deals") }}
                  />
                </td></tr>
              ) : tableRows.map((c) => {
                const approvable = canApprove(c);
                return (
                  <tr key={c.id} className="hover:bg-muted/80 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{c.deal.dealNumber}</td>
                    <td className="px-4 py-3 font-semibold text-foreground">
                      {c.deal.lead.firstName} {c.deal.lead.lastName}
                    </td>
                    <td className="px-4 py-3 text-foreground">{c.deal.unit.unitNumber}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.brokerCompany?.name || "—"}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-foreground">AED {c.amount.toLocaleString()}</p>
                      {tab === "PAID" && c.paidAmount && c.paidAmount !== c.amount && (
                        <p className="text-xs text-muted-foreground">Paid: AED {c.paidAmount.toLocaleString()}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.rate}%</td>
                    <td className="px-4 py-3">
                      {tab === "PAID" ? (
                        <div>
                          {c.paidDate && <p className="text-xs font-semibold text-success">{fmtDate(c.paidDate)}</p>}
                          {c.paidVia && <p className="text-xs text-muted-foreground">{c.paidVia.replace(/_/g, " ")}</p>}
                        </div>
                      ) : (
                        <div className="flex gap-1.5">
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded font-medium ${c.spaSignedMet ? "bg-success-soft text-success" : "bg-destructive-soft text-destructive"}`}
                            aria-label={`SPA ${c.spaSignedMet ? "signed" : "not signed"}`}
                            title={c.spaSignedMet ? "SPA signed" : "SPA not yet signed"}
                          >
                            SPA {c.spaSignedMet ? "Signed" : "Pending"}
                          </span>
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded font-medium ${c.oqoodMet ? "bg-success-soft text-success" : "bg-destructive-soft text-destructive"}`}
                            aria-label={`Oqood ${c.oqoodMet ? "registered" : "not registered"}`}
                            title={c.oqoodMet ? "Oqood registered" : "Oqood not yet registered"}
                          >
                            Oqood {c.oqoodMet ? "Done" : "Pending"}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {tab === "PENDING_APPROVAL" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant={approvable ? "default" : "secondary"}
                          onClick={() => handleApprove(c.id)}
                          disabled={!approvable || approvingId === c.id}
                          className="text-xs"
                        >
                          {approvingId === c.id ? "…" : approvable ? "Approve" : "Blocked"}
                        </Button>
                      ) : tab === "APPROVED" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="success"
                          onClick={() => {
                            setShowPayModal(c);
                            setPayForm({
                              paidAmount: String(c.amount),
                              paidVia: "BANK_TRANSFER",
                              receiptKey: "",
                            });
                          }}
                          disabled={payingId === c.id}
                          className="text-xs"
                        >
                          {payingId === c.id ? "…" : "Mark paid"}
                        </Button>
                      ) : (
                        <span className="text-xs text-success font-semibold inline-flex items-center gap-1">
                          <Check className="size-3.5" aria-hidden="true" />
                          Paid
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <Dialog
        open={!!showPayModal}
        onOpenChange={(open) => {
          if (!open && payingId === null) setShowPayModal(null);
        }}
      >
        <DialogContent className="max-w-sm">
          {showPayModal && (
            <>
              <DialogHeader>
                <DialogTitle>Mark commission as paid</DialogTitle>
                <DialogDescription>
                  {showPayModal.deal.dealNumber}
                  {showPayModal.brokerCompany?.name ? ` · ${showPayModal.brokerCompany.name}` : ""}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Amount paid (AED)
                  </label>
                  <Input
                    type="number"
                    value={payForm.paidAmount}
                    onChange={(e) =>
                      setPayForm((f) => ({ ...f, paidAmount: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Payment method
                  </label>
                  <select
                    aria-label="Payment method"
                    value={payForm.paidVia}
                    onChange={(e) =>
                      setPayForm((f) => ({ ...f, paidVia: e.target.value }))
                    }
                    className={SELECT_CLASS}
                  >
                    {["BANK_TRANSFER", "CHEQUE", "CASH"].map((m) => (
                      <option key={m} value={m}>
                        {m.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Receipt / reference (optional)
                  </label>
                  <Input
                    type="text"
                    value={payForm.receiptKey}
                    onChange={(e) =>
                      setPayForm((f) => ({ ...f, receiptKey: e.target.value }))
                    }
                    placeholder="e.g. CHQ-2026-001"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowPayModal(null)}
                  disabled={payingId !== null}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="success"
                  onClick={handleMarkPaid}
                  disabled={payingId !== null}
                >
                  {payingId ? "Saving…" : "Confirm paid"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      </PageContainer>
    </div>
  );
}
