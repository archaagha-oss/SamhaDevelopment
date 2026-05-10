import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { handoverApi } from "../services/phase2ApiService";
import {
  DetailPageLayout, DetailPageLoading, DetailPageNotFound,
} from "../components/layout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

interface ChecklistItem {
  id: string;
  code: string;
  label: string;
  required: boolean;
  status: "PENDING" | "COMPLETED" | "WAIVED" | "NOT_APPLICABLE";
  completedAt: string | null;
  completedBy: string | null;
  notes: string | null;
  evidenceKey: string | null;
  sortOrder: number;
}
interface Checklist {
  id: string;
  dealId: string;
  unitId: string;
  startedAt: string;
  completedAt: string | null;
  items: ChecklistItem[];
}

const STATUS_BADGES: Record<string, string> = {
  PENDING: "bg-warning-soft text-warning-soft-foreground",
  COMPLETED: "bg-success-soft text-success-soft-foreground",
  WAIVED: "bg-neutral-200 text-foreground",
  NOT_APPLICABLE: "bg-muted text-muted-foreground",
};

export default function HandoverChecklistPage() {
  const { dealId } = useParams<{ dealId: string }>();
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [customerName, setCustomerName] = useState("");

  const load = async () => {
    if (!dealId) return;
    setLoading(true);
    try {
      try {
        const c = await handoverApi.byDeal(dealId);
        setChecklist(c);
      } catch (err: any) {
        if (err.response?.status === 404) setChecklist(null);
        else throw err;
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [dealId]);

  const ensure = async () => {
    if (!dealId) return;
    try {
      await handoverApi.ensure(dealId);
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? e.message);
    }
  };

  const toggle = async (item: ChecklistItem, status: ChecklistItem["status"]) => {
    try {
      await handoverApi.setItem(item.id, { status });
      toast.success("Item updated");
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? e.message);
    }
  };

  const finish = async () => {
    if (!checklist) return;
    if (!customerName) {
      toast.error("Customer name required for sign-off");
      return;
    }
    try {
      await handoverApi.complete(checklist.id, { customerName });
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

  if (loading) return <DetailPageLoading crumbs={dealCrumbs} title="Loading checklist…" />;

  if (!checklist) {
    return (
      <DetailPageNotFound
        crumbs={dealCrumbs}
        title="No handover checklist yet"
        message="Create a handover checklist to start tracking the items required before sign-off."
        backLabel="Create checklist"
        onBack={ensure}
      />
    );
  }

  const ready = checklist.items.filter((i) => i.required).every((i) => i.status !== "PENDING");

  return (
    <DetailPageLayout
      crumbs={dealCrumbs}
      title="Handover checklist"
      subtitle={
        <>
          Started {new Date(checklist.startedAt).toLocaleDateString()}.
          {checklist.completedAt && ` Completed ${new Date(checklist.completedAt).toLocaleDateString()}.`}
        </>
      }
      main={<>

      <div className="border rounded divide-y">
        {checklist.items.map((it) => (
          <div key={it.id} className="px-4 py-3 flex items-center gap-3">
            <span className={`px-2 py-0.5 rounded text-xs ${STATUS_BADGES[it.status]}`}>{it.status}</span>
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
            <div className="flex gap-2">
              {it.status !== "COMPLETED" && (
                <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs text-success" onClick={() => toggle(it, "COMPLETED")}>
                  Mark done
                </Button>
              )}
              {it.status === "COMPLETED" && (
                <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs text-muted-foreground" onClick={() => toggle(it, "PENDING")}>
                  Reopen
                </Button>
              )}
              {!it.required && it.status === "PENDING" && (
                <>
                  <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => toggle(it, "WAIVED")}>
                    Waive
                  </Button>
                  <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => toggle(it, "NOT_APPLICABLE")}>
                    N/A
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {!checklist.completedAt && (
        <div className="border rounded p-4 bg-muted/50 space-y-2">
          <h2 className="font-medium">Customer sign-off</h2>
          <p className="text-xs text-muted-foreground">
            All required items {ready ? "have been completed" : "must be completed"} before customer sign-off.
          </p>
          <div className="flex gap-2 items-center">
            <Input
              className="h-9 flex-1"
              placeholder="Customer name (printed)"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
            <Button
              type="button"
              variant="success"
              size="sm"
              disabled={!ready}
              onClick={finish}
            >
              Sign off &amp; complete
            </Button>
          </div>
        </div>
      )}
        </>}
    />
  );
}
