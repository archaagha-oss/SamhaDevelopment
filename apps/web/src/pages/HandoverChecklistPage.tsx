import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { handoverApi } from "../services/phase2ApiService";

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
  PENDING: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-green-100 text-green-800",
  WAIVED: "bg-gray-200 text-gray-800",
  NOT_APPLICABLE: "bg-gray-100 text-gray-600",
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

  if (loading) return <div className="p-6 text-gray-500">Loading…</div>;

  if (!checklist) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Handover Checklist</h1>
        <p className="text-gray-500">No checklist exists for this deal.</p>
        <button className="bg-blue-600 text-white px-4 py-2 rounded text-sm" onClick={ensure}>
          + Create Checklist
        </button>
      </div>
    );
  }

  const ready = checklist.items.filter((i) => i.required).every((i) => i.status !== "PENDING");

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <h1 className="text-2xl font-semibold">Handover Checklist</h1>
      <p className="text-sm text-gray-500">
        Started {new Date(checklist.startedAt).toLocaleDateString()}.
        {checklist.completedAt && ` Completed ${new Date(checklist.completedAt).toLocaleDateString()}.`}
      </p>

      <div className="border rounded divide-y">
        {checklist.items.map((it) => (
          <div key={it.id} className="px-4 py-3 flex items-center gap-3">
            <span className={`px-2 py-0.5 rounded text-xs ${STATUS_BADGES[it.status]}`}>{it.status}</span>
            <div className="flex-1">
              <div className="font-medium">
                {it.label}
                {it.required && <span className="text-red-500 ml-1">*</span>}
              </div>
              {it.completedAt && (
                <div className="text-xs text-gray-500">
                  Done {new Date(it.completedAt).toLocaleDateString()} by {it.completedBy ?? "—"}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {it.status !== "COMPLETED" && (
                <button className="text-green-700 text-xs hover:underline" onClick={() => toggle(it, "COMPLETED")}>
                  Mark Done
                </button>
              )}
              {it.status === "COMPLETED" && (
                <button className="text-gray-500 text-xs hover:underline" onClick={() => toggle(it, "PENDING")}>
                  Reopen
                </button>
              )}
              {!it.required && it.status === "PENDING" && (
                <>
                  <button className="text-gray-700 text-xs hover:underline" onClick={() => toggle(it, "WAIVED")}>
                    Waive
                  </button>
                  <button className="text-gray-700 text-xs hover:underline" onClick={() => toggle(it, "NOT_APPLICABLE")}>
                    N/A
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {!checklist.completedAt && (
        <div className="border rounded p-4 bg-gray-50 space-y-2">
          <h2 className="font-medium">Customer Sign-off</h2>
          <p className="text-xs text-gray-600">
            All required items {ready ? "have been completed" : "must be completed"} before customer sign-off.
          </p>
          <div className="flex gap-2 items-center">
            <input
              className="border rounded px-2 py-1 text-sm flex-1"
              placeholder="Customer name (printed)"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
            <button
              disabled={!ready}
              className="bg-green-600 disabled:bg-gray-300 text-white px-4 py-1 rounded text-sm"
              onClick={finish}
            >
              Sign Off & Complete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
