import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { handoverApi } from "../services/phase2ApiService";
import {
  DetailPageLayout, DetailPageLoading,
} from "../components/layout";
import DealSubTabs from "../components/deal/DealSubTabs";

interface ChecklistItem {
  id: string;
  category: string;
  label: string;
  required: boolean;
  completed: boolean;
  completedAt: string | null;
  completedBy: string | null;
  notes: string | null;
  sortOrder: number;
}
interface Checklist {
  id: string;
  dealId: string;
  status: "IN_PROGRESS" | "COMPLETED";
  completedAt: string | null;
  completedBy: string | null;
  notes: string | null;
  items: ChecklistItem[];
  createdAt: string;
  updatedAt: string;
}

const STATE_BADGES = {
  COMPLETED: "bg-success-soft text-success-soft-foreground",
  PENDING:   "bg-warning-soft text-warning-soft-foreground",
} as const;

export default function HandoverChecklistPage() {
  const { dealId } = useParams<{ dealId: string }>();
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!dealId) return;
    setLoading(true);
    try {
      const c = await handoverApi.byDeal(dealId);
      setChecklist(c);
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [dealId]);

  const toggle = async (item: ChecklistItem, completed: boolean) => {
    try {
      await handoverApi.setItem(item.id, { completed });
      toast.success("Item updated");
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? e.message);
    }
  };

  const finish = async () => {
    if (!checklist || !dealId) return;
    try {
      await handoverApi.complete(dealId);
      toast.success("Checklist completed");
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? e.message);
    }
  };

  if (!dealId) return <div className="p-6">Deal ID required.</div>;

  const dealCrumbs = [
    { label: "Home", path: "/" },
    { label: "Deals", path: "/deals" },
    ...(dealId ? [{ label: "Deal", path: `/deals/${dealId}` }] : []),
    { label: "Handover" },
  ];

  if (loading || !checklist) {
    return <DetailPageLoading crumbs={dealCrumbs} title="Loading checklist…" />;
  }

  const ready = checklist.items.filter((i) => i.required).every((i) => i.completed);
  const isComplete = checklist.status === "COMPLETED";

  // Group by category for cleaner rendering — preserves backend sort order
  // within a category (handoverService orders by category, sortOrder, createdAt).
  const grouped = checklist.items.reduce<Record<string, ChecklistItem[]>>((acc, it) => {
    (acc[it.category] ||= []).push(it);
    return acc;
  }, {});
  const categories = Object.keys(grouped);

  return (
    <DetailPageLayout
      crumbs={dealCrumbs}
      title="Handover checklist"
      subtitle={
        <>
          Started {new Date(checklist.createdAt).toLocaleDateString()}.
          {checklist.completedAt && ` Completed ${new Date(checklist.completedAt).toLocaleDateString()}.`}
        </>
      }
      tabs={dealId ? <DealSubTabs dealId={dealId} currentKey="handover" /> : undefined}
      main={<>

      <div className="space-y-4">
        {categories.map((cat) => (
          <div key={cat} className="border rounded">
            <div className="px-4 py-2 bg-muted/50 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {cat}
            </div>
            <div className="divide-y">
              {grouped[cat].map((it) => {
                const state = it.completed ? "COMPLETED" : "PENDING";
                return (
                  <div key={it.id} className="px-4 py-3 flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${STATE_BADGES[state]}`}>{state}</span>
                    <div className="flex-1">
                      <div className="font-medium">
                        {it.label}
                        {it.required && <span className="text-destructive ml-1">*</span>}
                      </div>
                      {it.completedAt && (
                        <div className="text-xs text-muted-foreground">
                          Done {new Date(it.completedAt).toLocaleDateString()} by {it.completedBy ?? "—"}
                        </div>
                      )}
                    </div>
                    {!isComplete && (
                      <div className="flex gap-2">
                        {!it.completed ? (
                          <button className="text-success text-xs hover:underline" onClick={() => toggle(it, true)}>
                            Mark Done
                          </button>
                        ) : (
                          <button className="text-muted-foreground text-xs hover:underline" onClick={() => toggle(it, false)}>
                            Reopen
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {!isComplete && (
        <div className="border rounded p-4 bg-muted/50 space-y-2 mt-4">
          <h2 className="font-medium">Sign off</h2>
          <p className="text-xs text-muted-foreground">
            All required items {ready ? "have been completed" : "must be completed"} before sign-off.
            Completing the checklist marks the deal as COMPLETED.
          </p>
          <div className="flex gap-2 items-center">
            <button
              disabled={!ready}
              className="bg-success disabled:bg-neutral-300 text-white px-4 py-1 rounded text-sm"
              onClick={finish}
            >
              Sign off &amp; complete
            </button>
          </div>
        </div>
      )}
        </>}
    />
  );
}
