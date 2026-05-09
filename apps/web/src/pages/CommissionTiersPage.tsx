import { useEffect, useState } from "react";
import { toast } from "sonner";
import { commissionTiersApi } from "../services/phase2ApiService";

interface Tier {
  id?: string;
  minSalePrice: number | null;
  maxSalePrice: number | null;
  ratePercent: number;
  flatBonus: number;
  sortOrder: number;
}
interface Rule {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  priority: number;
  projectId: string | null;
  validFrom: string | null;
  validUntil: string | null;
  tiers: Tier[];
}

export default function CommissionTiersPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTiers, setDraftTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await commissionTiersApi.list();
      setRules(data);
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const startEdit = (rule: Rule) => {
    setEditingId(rule.id);
    setDraftTiers(rule.tiers.map((t) => ({ ...t })));
  };

  const updateTier = (idx: number, key: keyof Tier, value: any) => {
    const next = [...draftTiers];
    (next[idx] as any)[key] = value === "" ? null : Number(value);
    setDraftTiers(next);
  };

  const addTier = () => {
    setDraftTiers([
      ...draftTiers,
      {
        minSalePrice: 0,
        maxSalePrice: null,
        ratePercent: 3,
        flatBonus: 0,
        sortOrder: draftTiers.length,
      },
    ]);
  };

  const save = async () => {
    if (!editingId) return;
    try {
      await commissionTiersApi.update(editingId, { tiers: draftTiers });
      toast.success("Tiers updated");
      setEditingId(null);
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? e.message);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">Tiered Commission Rules</h1>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : rules.length === 0 ? (
        <p className="text-muted-foreground">No tiered commission rules configured.</p>
      ) : (
        rules.map((rule) => (
          <section key={rule.id} className="border rounded p-4 space-y-3">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="font-medium">{rule.name}</h2>
                <p className="text-xs text-muted-foreground">
                  {rule.projectId ? "Project-scoped" : "Global"} · priority {rule.priority} · {rule.isActive ? "active" : "inactive"}
                </p>
              </div>
              {editingId !== rule.id ? (
                <button className="text-sm text-primary hover:underline" onClick={() => startEdit(rule)}>
                  Edit Tiers
                </button>
              ) : (
                <div className="flex gap-2">
                  <button className="text-sm text-muted-foreground hover:underline" onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                  <button className="bg-primary text-white text-sm px-3 py-1 rounded" onClick={save}>
                    Save
                  </button>
                </div>
              )}
            </header>

            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground border-b">
                  <th className="py-1">Min Sale</th>
                  <th>Max Sale</th>
                  <th>Rate %</th>
                  <th>Flat Bonus</th>
                </tr>
              </thead>
              <tbody>
                {(editingId === rule.id ? draftTiers : rule.tiers).map((t, idx) => (
                  <tr key={t.id ?? `new-${idx}`} className="border-b">
                    {editingId === rule.id ? (
                      <>
                        <td><input className="border rounded px-1 py-0.5 w-28" type="number" value={t.minSalePrice ?? ""} onChange={(e) => updateTier(idx, "minSalePrice", e.target.value)} /></td>
                        <td><input className="border rounded px-1 py-0.5 w-28" type="number" value={t.maxSalePrice ?? ""} onChange={(e) => updateTier(idx, "maxSalePrice", e.target.value)} placeholder="∞" /></td>
                        <td><input className="border rounded px-1 py-0.5 w-20" type="number" step="0.1" value={t.ratePercent} onChange={(e) => updateTier(idx, "ratePercent", e.target.value)} /></td>
                        <td><input className="border rounded px-1 py-0.5 w-24" type="number" value={t.flatBonus} onChange={(e) => updateTier(idx, "flatBonus", e.target.value)} /></td>
                      </>
                    ) : (
                      <>
                        <td className="py-1">{t.minSalePrice?.toLocaleString() ?? "0"}</td>
                        <td>{t.maxSalePrice?.toLocaleString() ?? "∞"}</td>
                        <td>{t.ratePercent}%</td>
                        <td>{t.flatBonus.toLocaleString()}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {editingId === rule.id && (
              <button className="text-xs text-primary hover:underline" onClick={addTier}>
                + Add tier
              </button>
            )}
          </section>
        ))
      )}
    </div>
  );
}
