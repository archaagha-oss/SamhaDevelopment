import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import {
  DetailPageLayout, DetailPageLoading, DetailPageNotFound,
} from "../components/layout";

interface Deal {
  id: string;
  dealNumber: string;
  salePrice: number;
  discount: number;
  dldPaidBy?: string;
  adminFeeWaived?: boolean;
  adminFeeWaivedReason?: string;
  dldWaivedReason?: string;
  commissionRateOverride?: number;
  brokerCompany?: { id: string; name: string } | null;
  brokerAgent?: { id: string; name: string } | null;
  assignedAgent?: { id: string; name: string } | null;
  stage: string;
  lead?: { firstName: string; lastName: string };
  unit?: { unitNumber: string };
}

interface BrokerCompany {
  id: string;
  name: string;
  agents: { id: string; name: string }[];
}

interface Agent {
  id: string;
  name: string;
  status?: string;
  role?: string;
}

const inp =
  "w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring focus:bg-card disabled:opacity-50";
const lbl = "block text-xs font-semibold text-muted-foreground mb-1";

// Once a deal is past SPA signing, sale price and discount are commercially
// frozen — only fee/broker/assignment fields remain editable.
const LOCKED_STAGES = [
  "SPA_SIGNED", "OQOOD_PENDING", "OQOOD_REGISTERED",
  "INSTALLMENTS_ACTIVE", "HANDOVER_PENDING", "COMPLETED", "CANCELLED",
];

const dealsCrumbs = [{ label: "Home", path: "/" }, { label: "Deals", path: "/deals" }];

export default function DealEditPage() {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();

  const [deal,    setDeal]    = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [brokerCompanies, setBrokerCompanies] = useState<BrokerCompany[]>([]);
  const [agents,          setAgents]          = useState<Agent[]>([]);

  const [form, setForm] = useState({
    salePrice: "",
    discount: "",
    brokerCompanyId: "",
    brokerAgentId: "",
    commissionRateOverride: "",
    adminFeeWaived: false,
    adminFeeWaivedReason: "",
    dldPaidBy: "BUYER" as "BUYER" | "DEVELOPER",
    dldWaivedReason: "",
    assignedAgentId: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  useEffect(() => {
    if (!dealId) { setLoadError(true); setLoading(false); return; }
    let cancelled = false;
    async function load() {
      try {
        const [dealRes, brokersRes, usersRes] = await Promise.all([
          axios.get(`/api/deals/${dealId}`),
          axios.get("/api/brokers/companies").catch(() => ({ data: [] })),
          axios.get("/api/users").catch(() => ({ data: [] })),
        ]);
        if (cancelled) return;
        const d = dealRes.data as Deal;
        setDeal(d);
        setForm({
          salePrice: String(d.salePrice ?? ""),
          discount: String(d.discount ?? 0),
          brokerCompanyId: d.brokerCompany?.id ?? "",
          brokerAgentId: d.brokerAgent?.id ?? "",
          commissionRateOverride: d.commissionRateOverride ? String(d.commissionRateOverride) : "",
          adminFeeWaived: d.adminFeeWaived ?? false,
          adminFeeWaivedReason: d.adminFeeWaivedReason ?? "",
          dldPaidBy: (d.dldPaidBy ?? "BUYER") as "BUYER" | "DEVELOPER",
          dldWaivedReason: d.dldWaivedReason ?? "",
          assignedAgentId: d.assignedAgent?.id ?? "",
        });
        setBrokerCompanies(Array.isArray(brokersRes.data) ? brokersRes.data : []);
        setAgents(
          (Array.isArray(usersRes.data) ? usersRes.data : []).filter(
            (u: Agent) => u.status === "ACTIVE" && u.role !== "VIEWER",
          ),
        );
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [dealId]);

  const isLocked = !!deal && LOCKED_STAGES.includes(deal.stage);
  const selectedCompany = useMemo(
    () => brokerCompanies.find((c) => c.id === form.brokerCompanyId),
    [brokerCompanies, form.brokerCompanyId],
  );
  const brokerAgents = selectedCompany?.agents ?? [];
  const netPrice = (parseFloat(form.salePrice) || 0) - (parseFloat(form.discount) || 0);

  const cancelTo = dealId ? `/deals/${dealId}` : "/deals";

  async function submit() {
    if (!deal) return;
    setError(null);
    setSubmitting(true);
    try {
      await axios.patch(`/api/deals/${deal.id}`, {
        salePrice: parseFloat(form.salePrice),
        discount: parseFloat(form.discount) || 0,
        brokerCompanyId: form.brokerCompanyId || null,
        brokerAgentId: form.brokerAgentId || null,
        commissionRateOverride:
          form.brokerCompanyId && form.commissionRateOverride
            ? parseFloat(form.commissionRateOverride)
            : null,
        adminFeeWaived: form.adminFeeWaived,
        adminFeeWaivedReason: form.adminFeeWaived ? form.adminFeeWaivedReason || null : null,
        dldPaidBy: form.dldPaidBy,
        dldWaivedReason: form.dldPaidBy === "DEVELOPER" ? form.dldWaivedReason || null : null,
        assignedAgentId: form.assignedAgentId || null,
      });
      toast.success("Deal updated");
      navigate(`/deals/${deal.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to update deal");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <DetailPageLoading crumbs={dealsCrumbs} title="Loading deal…" />;

  if (loadError || !deal) {
    return (
      <DetailPageNotFound
        crumbs={dealsCrumbs}
        title="Deal not found"
        message="This deal could not be loaded. It may have been deleted."
        backLabel="Back to deals"
        onBack={() => navigate("/deals")}
      />
    );
  }

  const buyerName = deal.lead ? `${deal.lead.firstName} ${deal.lead.lastName}` : "Deal";

  return (
    <DetailPageLayout
      crumbs={[
        ...dealsCrumbs,
        { label: deal.dealNumber || buyerName, path: `/deals/${deal.id}` },
        { label: "Edit" },
      ]}
      title={`Edit deal · ${deal.dealNumber || buyerName}`}
      subtitle={
        deal.unit
          ? `${buyerName} · Unit ${deal.unit.unitNumber} · stage ${deal.stage.replace(/_/g, " ").toLowerCase()}`
          : `${buyerName} · stage ${deal.stage.replace(/_/g, " ").toLowerCase()}`
      }
      actions={
        <>
          <button
            type="button"
            onClick={() => navigate(cancelTo)}
            disabled={submitting}
            className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-4 py-2 transition-colors disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save changes"}
          </button>
        </>
      }
      main={
        <>
          {isLocked && (
            <div className="bg-warning-soft border border-warning/30 rounded-lg px-4 py-2.5 text-xs text-warning">
              Deal is past SPA signing. Sale price and discount are locked. You can still update broker, agent, and fee settings.
            </div>
          )}

          {/* Pricing */}
          <div className="bg-card rounded-xl border border-border p-5 space-y-4">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Pricing</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Sale Price (AED)</label>
                <input
                  required
                  type="number"
                  min={1}
                  step={1}
                  disabled={isLocked}
                  value={form.salePrice}
                  onChange={(e) => setForm((f) => ({ ...f, salePrice: e.target.value }))}
                  className={inp}
                />
              </div>
              <div>
                <label className={lbl}>Discount (AED)</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  disabled={isLocked}
                  value={form.discount}
                  onChange={(e) => setForm((f) => ({ ...f, discount: e.target.value }))}
                  className={inp}
                />
              </div>
            </div>
            {!isLocked && form.salePrice && (
              <div className="bg-info-soft border border-primary/40 rounded-lg px-4 py-2.5 text-sm flex justify-between">
                <span className="text-muted-foreground">Net Price</span>
                <span className="font-bold text-foreground tabular-nums">AED {netPrice.toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Assignment */}
          <div className="bg-card rounded-xl border border-border p-5 space-y-4">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Assignment</h3>
            <div>
              <label className={lbl}>Assigned Sales Agent</label>
              <select
                value={form.assignedAgentId}
                onChange={(e) => setForm((f) => ({ ...f, assignedAgentId: e.target.value }))}
                className={inp}
              >
                <option value="">Unassigned</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Broker */}
          <div className="bg-card rounded-xl border border-border p-5 space-y-4">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Broker</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Broker Company</label>
                <select
                  value={form.brokerCompanyId}
                  onChange={(e) => setForm((f) => ({ ...f, brokerCompanyId: e.target.value, brokerAgentId: "" }))}
                  className={inp}
                >
                  <option value="">None (direct)</option>
                  {brokerCompanies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>Broker Agent</label>
                <select
                  value={form.brokerAgentId}
                  onChange={(e) => setForm((f) => ({ ...f, brokerAgentId: e.target.value }))}
                  disabled={!form.brokerCompanyId}
                  className={inp}
                >
                  <option value="">Select agent…</option>
                  {brokerAgents.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            </div>
            {form.brokerCompanyId && (
              <div>
                <label className={lbl}>Commission Rate Override (%)</label>
                <input
                  type="number"
                  step={0.1}
                  min={0}
                  max={20}
                  value={form.commissionRateOverride}
                  onChange={(e) => setForm((f) => ({ ...f, commissionRateOverride: e.target.value }))}
                  placeholder="Leave blank for company default"
                  className={inp}
                />
              </div>
            )}
          </div>

          {/* Fee overrides */}
          <div className="bg-card rounded-xl border border-border p-5 space-y-4">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Fee overrides</h3>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="adminFeeWaived"
                checked={form.adminFeeWaived}
                onChange={(e) => setForm((f) => ({ ...f, adminFeeWaived: e.target.checked }))}
                className="w-4 h-4 rounded border-border accent-primary"
              />
              <label htmlFor="adminFeeWaived" className="text-sm text-foreground font-medium">
                Waive Admin Fee
              </label>
            </div>
            {form.adminFeeWaived && (
              <input
                placeholder="Reason for admin fee waiver"
                value={form.adminFeeWaivedReason}
                onChange={(e) => setForm((f) => ({ ...f, adminFeeWaivedReason: e.target.value }))}
                className={inp}
              />
            )}
            <div>
              <label className={lbl}>DLD Fee Paid By</label>
              <select
                value={form.dldPaidBy}
                onChange={(e) => setForm((f) => ({ ...f, dldPaidBy: e.target.value as "BUYER" | "DEVELOPER" }))}
                className={inp}
              >
                <option value="BUYER">Buyer</option>
                <option value="DEVELOPER">Developer (Waived for Buyer)</option>
              </select>
            </div>
            {form.dldPaidBy === "DEVELOPER" && (
              <input
                placeholder="Reason for DLD waiver"
                value={form.dldWaivedReason}
                onChange={(e) => setForm((f) => ({ ...f, dldWaivedReason: e.target.value }))}
                className={inp}
              />
            )}
          </div>

          {error && (
            <div className="bg-destructive-soft border border-destructive/30 rounded-lg px-4 py-2.5 text-sm text-destructive">
              {error}
            </div>
          )}
        </>
      }
    />
  );
}
