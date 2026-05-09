import { useEffect, useState } from "react";
import { toast } from "sonner";
import { commissionTiersApi } from "../services/phase2ApiService";
import { PageHeader, PageContainer } from "../components/layout";

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

  const activeCount = rules.filter((r) => r.isActive).length;

  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader
        crumbs={[{ label: "Home", path: "/" }, { label: "Commission tiers" }]}
        title="Commission tiers"
        subtitle={
          loading
            ? "Loading…"
            : `${rules.length} rule${rules.length === 1 ? "" : "s"} · ${activeCount} active · sale-price brackets that determine commission`
        }
      />
      <div className="flex-1 overflow-auto">
        <PageContainer>
          <div className="space-y-5">
            {loading ? (
              <div className="flex items-center justify-center h-40" role="status" aria-busy="true" aria-label="Loading">
                <div className="w-7 h-7 border-2 border-primary/40 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : rules.length === 0 ? (
              <div className="bg-card rounded-xl border border-dashed border-border py-16 text-center">
                <p className="text-sm text-muted-foreground">No tiered commission rules configured.</p>
              </div>
            ) : (
              rules.map((rule) => (
                <section key={rule.id} className="bg-card rounded-xl border border-border p-5 space-y-3">
                  <header className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <h2 className="font-semibold text-foreground">{rule.name}</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {rule.projectId ? "Project-scoped" : "Global"} · priority {rule.priority} ·{" "}
                        <span className={rule.isActive ? "text-success" : "text-muted-foreground"}>
                          {rule.isActive ? "active" : "inactive"}
                        </span>
                      </p>
                    </div>
                    {editingId !== rule.id ? (
                      <button
                        className="text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-4 py-2 transition-colors"
                        onClick={() => startEdit(rule)}
                      >
                        Edit tiers
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition-colors"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </button>
                        <button
                          className="text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-4 py-2 transition-colors"
                          onClick={save}
                        >
                          Save changes
                        </button>
                      </div>
                    )}
                  </header>

                  <div className="overflow-x-auto -mx-1 px-1">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 border-b border-border">
                        <tr>
                          {["Min Sale", "Max Sale", "Rate %", "Flat Bonus"].map((h) => (
                            <th
                              key={h}
                              className="text-left px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {(editingId === rule.id ? draftTiers : rule.tiers).map((t, idx) => (
                          <tr key={t.id ?? `new-${idx}`}>
                            {editingId === rule.id ? (
                              <>
                                <td className="px-3 py-2">
                                  <input
                                    className="border border-border rounded px-2 py-1 w-28 text-sm bg-card focus:outline-none focus:border-ring"
                                    type="number"
                                    value={t.minSalePrice ?? ""}
                                    onChange={(e) => updateTier(idx, "minSalePrice", e.target.value)}
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    className="border border-border rounded px-2 py-1 w-28 text-sm bg-card focus:outline-none focus:border-ring"
                                    type="number"
                                    value={t.maxSalePrice ?? ""}
                                    onChange={(e) => updateTier(idx, "maxSalePrice", e.target.value)}
                                    placeholder="∞"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    className="border border-border rounded px-2 py-1 w-20 text-sm bg-card focus:outline-none focus:border-ring"
                                    type="number"
                                    step="0.1"
                                    value={t.ratePercent}
                                    onChange={(e) => updateTier(idx, "ratePercent", e.target.value)}
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    className="border border-border rounded px-2 py-1 w-24 text-sm bg-card focus:outline-none focus:border-ring"
                                    type="number"
                                    value={t.flatBonus}
                                    onChange={(e) => updateTier(idx, "flatBonus", e.target.value)}
                                  />
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="px-3 py-2 text-sm text-foreground tabular-nums">
                                  {t.minSalePrice?.toLocaleString() ?? "0"}
                                </td>
                                <td className="px-3 py-2 text-sm text-foreground tabular-nums">
                                  {t.maxSalePrice?.toLocaleString() ?? "∞"}
                                </td>
                                <td className="px-3 py-2 text-sm text-foreground tabular-nums">{t.ratePercent}%</td>
                                <td className="px-3 py-2 text-sm text-foreground tabular-nums">
                                  {t.flatBonus.toLocaleString()}
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {editingId === rule.id && (
                    <button className="text-xs text-primary hover:underline" onClick={addTier}>
                      + Add tier
                    </button>
                  )}
                </section>
              ))
            )}
          </div>
        </PageContainer>
      </div>
    </div>
  );
}
