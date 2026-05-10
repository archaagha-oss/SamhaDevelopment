import { useEffect, useState } from "react";
import axios from "axios";
import Modal from "./Modal";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface Props {
  dealId: string;
  onClose: () => void;
  onSaved?: () => void;
}

interface Purchaser {
  id?: string;
  leadId: string | null;
  name: string;
  ownershipPercentage: number;
  address: string;
  phone: string;
  email: string;
  nationality: string;
  emiratesId: string;
  passportNumber: string;
  companyRegistrationNumber: string;
  authorizedSignatory: string;
  sourceOfFunds: string;
  isPrimary: boolean;
  sortOrder: number;
}

const inp =
  "w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring focus:bg-card";
const lbl = "block text-xs font-semibold text-muted-foreground mb-1";

const blank = (sortOrder: number, isPrimary: boolean): Purchaser => ({
  leadId: null,
  name: "",
  ownershipPercentage: 0,
  address: "",
  phone: "",
  email: "",
  nationality: "",
  emiratesId: "",
  passportNumber: "",
  companyRegistrationNumber: "",
  authorizedSignatory: "",
  sourceOfFunds: "",
  isPrimary,
  sortOrder,
});

// Editor for the SPA "Purchaser 1 / 2 / 3" block. Each row is jointly and
// severally liable; the sum of ownership percentages must equal 100% and
// exactly one row must be marked primary.
export default function DealPurchasersModal({ dealId, onClose, onSaved }: Props) {
  const [purchasers, setPurchasers] = useState<Purchaser[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      axios.get(`/api/deals/${dealId}/purchasers`),
      axios.get(`/api/deals/${dealId}`),
    ])
      .then(([pRes, dRes]) => {
        const existing = (pRes.data ?? []) as Array<Partial<Purchaser> & { id: string }>;
        if (existing.length > 0) {
          setPurchasers(
            existing.map((p, i) => ({
              id: p.id,
              leadId: (p.leadId as string | null) ?? null,
              name: p.name ?? "",
              ownershipPercentage: p.ownershipPercentage ?? 0,
              address: (p.address as string) ?? "",
              phone: (p.phone as string) ?? "",
              email: (p.email as string) ?? "",
              nationality: (p.nationality as string) ?? "",
              emiratesId: (p.emiratesId as string) ?? "",
              passportNumber: (p.passportNumber as string) ?? "",
              companyRegistrationNumber: (p.companyRegistrationNumber as string) ?? "",
              authorizedSignatory: (p.authorizedSignatory as string) ?? "",
              sourceOfFunds: (p.sourceOfFunds as string) ?? "",
              isPrimary: !!p.isPrimary,
              sortOrder: p.sortOrder ?? i,
            })),
          );
        } else {
          // Seed from the deal's primary lead so the user has a starting point.
          const lead = dRes.data?.lead;
          if (lead) {
            setPurchasers([
              {
                ...blank(0, true),
                leadId: lead.id,
                name: `${lead.firstName ?? ""} ${lead.lastName ?? ""}`.trim(),
                ownershipPercentage: 100,
                address: lead.address ?? "",
                phone: lead.phone ?? "",
                email: lead.email ?? "",
                nationality: lead.nationality ?? "",
                emiratesId: lead.emiratesId ?? "",
                passportNumber: lead.passportNumber ?? "",
                companyRegistrationNumber: lead.companyRegistrationNumber ?? "",
                authorizedSignatory: lead.authorizedSignatory ?? "",
                sourceOfFunds: lead.sourceOfFunds ?? "",
              },
            ]);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dealId]);

  const total = purchasers.reduce((s, p) => s + (p.ownershipPercentage || 0), 0);
  const primaryCount = purchasers.filter((p) => p.isPrimary).length;

  const update = (idx: number, patch: Partial<Purchaser>) =>
    setPurchasers((arr) => arr.map((p, i) => (i === idx ? { ...p, ...patch } : p)));

  const addPurchaser = () =>
    setPurchasers((arr) => [
      ...arr,
      blank(arr.length, arr.length === 0),
    ]);

  const removePurchaser = (idx: number) =>
    setPurchasers((arr) => arr.filter((_, i) => i !== idx));

  const setPrimary = (idx: number) =>
    setPurchasers((arr) => arr.map((p, i) => ({ ...p, isPrimary: i === idx })));

  const handleSave = async () => {
    setError(null);
    setSaved(false);

    if (purchasers.length === 0) {
      setError("At least one purchaser is required");
      return;
    }
    if (Math.abs(total - 100) > 0.01) {
      setError(`Ownership must sum to 100% (currently ${total.toFixed(2)}%)`);
      return;
    }
    if (primaryCount !== 1) {
      setError("Exactly one purchaser must be marked primary");
      return;
    }

    setSubmitting(true);
    try {
      await axios.put(`/api/deals/${dealId}/purchasers`, {
        purchasers: purchasers.map((p, i) => ({
          leadId: p.leadId ?? undefined,
          name: p.name,
          ownershipPercentage: p.ownershipPercentage,
          address: p.address || null,
          phone: p.phone || null,
          email: p.email || null,
          nationality: p.nationality || null,
          emiratesId: p.emiratesId || null,
          passportNumber: p.passportNumber || null,
          companyRegistrationNumber: p.companyRegistrationNumber || null,
          authorizedSignatory: p.authorizedSignatory || null,
          sourceOfFunds: p.sourceOfFunds || null,
          isPrimary: p.isPrimary,
          sortOrder: i,
        })),
      });
      setSaved(true);
      onSaved?.();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to save purchasers");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={
        <div>
          <h2 className="font-bold text-foreground">Joint purchasers</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            All purchasers are jointly and severally liable under the SPA. Ownership must sum to 100%.
          </p>
        </div>
      }
    >
      <div className="px-6 py-5 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Spinner size="md" />
          </div>
        ) : (
            <>
              {purchasers.map((p, idx) => (
                <div key={idx} className="border border-border rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground text-sm">Purchaser {idx + 1}</h3>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input
                          type="radio"
                          name="primary"
                          checked={p.isPrimary}
                          onChange={() => setPrimary(idx)}
                        />
                        <span className="text-muted-foreground">Primary</span>
                      </label>
                      {purchasers.length > 1 && (
                        <button
                          onClick={() => removePurchaser(idx)}
                          className="text-xs text-destructive hover:text-destructive"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className={lbl}>Name *</label>
                      <input
                        required
                        value={p.name}
                        onChange={(e) => update(idx, { name: e.target.value })}
                        className={inp}
                      />
                    </div>
                    <div>
                      <label className={lbl}>Ownership % *</label>
                      <input
                        required
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={p.ownershipPercentage}
                        onChange={(e) =>
                          update(idx, { ownershipPercentage: parseFloat(e.target.value) || 0 })
                        }
                        className={inp}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>Address</label>
                    <input
                      value={p.address}
                      onChange={(e) => update(idx, { address: e.target.value })}
                      className={inp}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className={lbl}>Phone</label>
                      <input value={p.phone} onChange={(e) => update(idx, { phone: e.target.value })} className={inp} />
                    </div>
                    <div>
                      <label className={lbl}>Email</label>
                      <input type="email" value={p.email} onChange={(e) => update(idx, { email: e.target.value })} className={inp} />
                    </div>
                    <div>
                      <label className={lbl}>Nationality</label>
                      <input value={p.nationality} onChange={(e) => update(idx, { nationality: e.target.value })} className={inp} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={lbl}>Emirates ID</label>
                      <input value={p.emiratesId} onChange={(e) => update(idx, { emiratesId: e.target.value })} className={inp} />
                    </div>
                    <div>
                      <label className={lbl}>Passport No</label>
                      <input value={p.passportNumber} onChange={(e) => update(idx, { passportNumber: e.target.value })} className={inp} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={lbl}>Company Registration No</label>
                      <input value={p.companyRegistrationNumber} onChange={(e) => update(idx, { companyRegistrationNumber: e.target.value })} className={inp} />
                    </div>
                    <div>
                      <label className={lbl}>Authorized Signatory</label>
                      <input value={p.authorizedSignatory} onChange={(e) => update(idx, { authorizedSignatory: e.target.value })} className={inp} />
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>Source of Funds</label>
                    <input
                      value={p.sourceOfFunds}
                      onChange={(e) => update(idx, { sourceOfFunds: e.target.value })}
                      placeholder="e.g. Salary, Husband Savings"
                      className={inp}
                    />
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between">
                <button
                  onClick={addPurchaser}
                  className="px-3 py-1.5 text-xs font-semibold bg-muted text-foreground rounded-lg hover:bg-muted"
                >
                  + Add Purchaser
                </button>
                <div className="text-xs">
                  <span className={Math.abs(total - 100) > 0.01 ? "text-destructive font-semibold" : "text-success font-semibold"}>
                    Total: {total.toFixed(2)}%
                  </span>
                </div>
              </div>

              {error && <p className="text-sm text-destructive bg-destructive-soft px-3 py-2 rounded-lg">{error}</p>}
              {saved && (
                <p className="text-sm text-success bg-success-soft px-3 py-2 rounded-lg">
                  Purchasers saved.
                </p>
              )}

              <div className="flex gap-3 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={onClose}
                >
                  {saved ? "Close" : "Cancel"}
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  onClick={handleSave}
                  disabled={submitting}
                >
                  {submitting ? "Saving…" : "Save purchasers"}
                </Button>
              </div>
            </>
          )}
      </div>
    </Modal>
  );
}
