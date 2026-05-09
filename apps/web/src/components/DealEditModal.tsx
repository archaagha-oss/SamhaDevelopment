import { useState, useEffect } from "react";
import axios from "axios";

interface Deal {
  id: string;
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
}

interface Props {
  deal: Deal;
  onClose: () => void;
  onSaved: () => void;
}

interface BrokerCompany { id: string; name: string; agents: { id: string; name: string }[]; }
interface Agent { id: string; name: string; }

const inp = "w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring focus:bg-card disabled:opacity-50";
const lbl = "block text-xs font-semibold text-muted-foreground mb-1";

const LOCKED_STAGES = ["SPA_SIGNED", "OQOOD_PENDING", "OQOOD_REGISTERED", "INSTALLMENTS_ACTIVE", "HANDOVER_PENDING", "COMPLETED", "CANCELLED"];

export default function DealEditModal({ deal, onClose, onSaved }: Props) {
  const isLocked = LOCKED_STAGES.includes(deal.stage);

  const [form, setForm] = useState({
    salePrice: String(deal.salePrice),
    discount: String(deal.discount || 0),
    brokerCompanyId: deal.brokerCompany?.id ?? "",
    brokerAgentId: deal.brokerAgent?.id ?? "",
    commissionRateOverride: deal.commissionRateOverride ? String(deal.commissionRateOverride) : "",
    adminFeeWaived: deal.adminFeeWaived ?? false,
    adminFeeWaivedReason: deal.adminFeeWaivedReason ?? "",
    dldPaidBy: (deal.dldPaidBy ?? "BUYER") as "BUYER" | "DEVELOPER",
    dldWaivedReason: deal.dldWaivedReason ?? "",
    assignedAgentId: deal.assignedAgent?.id ?? "",
  });

  const [brokerCompanies, setBrokerCompanies] = useState<BrokerCompany[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    axios.get("/api/brokers/companies").then((r) => setBrokerCompanies(r.data || [])).catch(() => {});
    axios.get("/api/users").then((r) => setAgents((r.data || []).filter((u: any) => u.status === "ACTIVE" && u.role !== "VIEWER"))).catch(() => {});
  }, []);

  const selectedCompany = brokerCompanies.find((c) => c.id === form.brokerCompanyId);
  const brokerAgents = selectedCompany?.agents ?? [];
  const netPrice = (parseFloat(form.salePrice) || 0) - (parseFloat(form.discount) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await axios.patch(`/api/deals/${deal.id}`, {
        salePrice: parseFloat(form.salePrice),
        discount: parseFloat(form.discount) || 0,
        brokerCompanyId: form.brokerCompanyId || null,
        brokerAgentId: form.brokerAgentId || null,
        commissionRateOverride: form.brokerCompanyId && form.commissionRateOverride ? parseFloat(form.commissionRateOverride) : null,
        adminFeeWaived: form.adminFeeWaived,
        adminFeeWaivedReason: form.adminFeeWaived ? form.adminFeeWaivedReason || null : null,
        dldPaidBy: form.dldPaidBy,
        dldWaivedReason: form.dldPaidBy === "DEVELOPER" ? form.dldWaivedReason || null : null,
        assignedAgentId: form.assignedAgentId || null,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to update deal");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <h2 className="font-bold text-foreground text-lg">Edit deal</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-2xl leading-none">×</button>
        </div>

        <form id="deal-edit-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {isLocked && (
            <div className="bg-warning-soft border border-warning/30 rounded-lg px-3 py-2 text-xs text-warning">
              Deal is past SPA Signing stage. Sale price and discount are locked. You can still update broker, agent, and fee settings.
            </div>
          )}

          {/* Sale Price + Discount */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Sale Price (AED)</label>
              <input
                required type="number" min="1" step="1"
                disabled={isLocked}
                value={form.salePrice}
                onChange={(e) => setForm((f) => ({ ...f, salePrice: e.target.value }))}
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>Discount (AED)</label>
              <input
                type="number" min="0" step="1"
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
              <span className="font-bold text-foreground">AED {netPrice.toLocaleString()}</span>
            </div>
          )}

          {/* Assigned Agent */}
          <div>
            <label className={lbl}>Assigned Sales Agent</label>
            <select
              value={form.assignedAgentId}
              onChange={(e) => setForm((f) => ({ ...f, assignedAgentId: e.target.value }))}
              className={inp}
            >
              <option value="">Unassigned</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          {/* Broker */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Broker Company</label>
              <select
                value={form.brokerCompanyId}
                onChange={(e) => setForm((f) => ({ ...f, brokerCompanyId: e.target.value, brokerAgentId: "" }))}
                className={inp}
              >
                <option value="">None (direct)</option>
                {brokerCompanies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
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
                {brokerAgents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>

          {form.brokerCompanyId && (
            <div>
              <label className={lbl}>Commission Rate Override (%)</label>
              <input
                type="number" step="0.1" min="0" max="20"
                value={form.commissionRateOverride}
                onChange={(e) => setForm((f) => ({ ...f, commissionRateOverride: e.target.value }))}
                placeholder="Leave blank for company default"
                className={inp}
              />
            </div>
          )}

          {/* Admin Fee + DLD */}
          <div className="space-y-3 border border-border rounded-lg p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fee Overrides</p>
            <div className="flex items-center gap-3">
              <input
                type="checkbox" id="adminFeeWaived" checked={form.adminFeeWaived}
                onChange={(e) => setForm((f) => ({ ...f, adminFeeWaived: e.target.checked }))}
                className="w-4 h-4 rounded border-border"
              />
              <label htmlFor="adminFeeWaived" className="text-sm text-foreground font-medium">Waive Admin Fee</label>
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
            <p className="text-sm text-destructive bg-destructive-soft border border-destructive/30 px-3 py-2 rounded-lg">{error}</p>
          )}
        </form>

        <div className="px-6 py-4 border-t border-border flex gap-3 flex-shrink-0">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 bg-muted text-foreground font-medium rounded-lg hover:bg-muted text-sm transition-colors">
            Cancel
          </button>
          <button form="deal-edit-form" type="submit" disabled={submitting}
            className="flex-1 py-2.5 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 text-sm transition-colors disabled:opacity-50">
            {submitting ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
