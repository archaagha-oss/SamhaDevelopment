import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { snagsApi } from "../services/phase2ApiService";

interface SnagItem {
  id: string;
  room: string | null;
  category: string | null;
  description: string;
  severity: "COSMETIC" | "MINOR" | "MAJOR" | "CRITICAL";
  status: string;
  contractorName: string | null;
  dueDate: string | null;
  fixedDate: string | null;
  closedDate: string | null;
  photos: Array<{ id: string; s3Key: string; caption: string | null; kind: string }>;
}
interface SnagList {
  id: string;
  label: string;
  raisedAt: string;
  closedAt: string | null;
  items: SnagItem[];
}

const SEVERITY_COLORS: Record<string, string> = {
  COSMETIC: "bg-neutral-200 text-foreground",
  MINOR: "bg-info-soft text-primary",
  MAJOR: "bg-warning-soft text-warning-soft-foreground",
  CRITICAL: "bg-destructive-soft text-destructive-soft-foreground",
};

const STATUS_OPTIONS = ["RAISED", "ACKNOWLEDGED", "IN_PROGRESS", "FIXED", "REJECTED", "CLOSED"];

export default function SnagListPage() {
  const { unitId } = useParams<{ unitId: string }>();
  const [lists, setLists] = useState<SnagList[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState<Record<string, string>>({});

  const load = async () => {
    if (!unitId) return;
    setLoading(true);
    try {
      const data = await snagsApi.listForUnit(unitId);
      setLists(data);
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [unitId]);

  const ensureList = async () => {
    if (!unitId) return;
    if (lists.length > 0) return lists[0].id;
    try {
      const list = await snagsApi.createList(unitId, "Walk-through");
      await load();
      return list.id;
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? e.message);
    }
  };

  const addItem = async (listId: string) => {
    if (!newItem.description) {
      toast.error("Description required");
      return;
    }
    try {
      await snagsApi.addItem(listId, {
        room: newItem.room,
        category: newItem.category,
        description: newItem.description,
        severity: newItem.severity ?? "MINOR",
        contractorName: newItem.contractorName,
        dueDate: newItem.dueDate,
      });
      toast.success("Snag added");
      setNewItem({});
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? e.message);
    }
  };

  const setStatus = async (item: SnagItem, status: string) => {
    try {
      await snagsApi.setStatus(item.id, status);
      toast.success(`Status updated`);
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? e.message);
    }
  };

  if (!unitId) return <div className="p-6">Unit ID required.</div>;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Snag Lists</h1>
        <button
          className="bg-primary text-white px-3 py-1 rounded text-sm"
          onClick={ensureList}
        >
          + New List
        </button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : lists.length === 0 ? (
        <p className="text-muted-foreground">No snag lists for this unit yet.</p>
      ) : (
        lists.map((list) => (
          <section key={list.id} className="border rounded p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">
                {list.label}{" "}
                <span className="text-xs text-muted-foreground">
                  · raised {new Date(list.raisedAt).toLocaleDateString()}
                </span>
              </h2>
              {list.closedAt && (
                <span className="text-xs text-success">Closed {new Date(list.closedAt).toLocaleDateString()}</span>
              )}
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground border-b">
                  <th className="py-1">Room</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Severity</th>
                  <th>Contractor</th>
                  <th>Due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((it) => (
                  <tr key={it.id} className="border-b">
                    <td className="py-1">{it.room ?? "—"}</td>
                    <td>{it.category ?? "—"}</td>
                    <td>{it.description}</td>
                    <td>
                      <span className={`px-2 py-0.5 rounded text-xs ${SEVERITY_COLORS[it.severity]}`}>
                        {it.severity}
                      </span>
                    </td>
                    <td>{it.contractorName ?? "—"}</td>
                    <td>{it.dueDate ? new Date(it.dueDate).toLocaleDateString() : "—"}</td>
                    <td>
                      <select
                        className="border rounded px-1 py-0.5 text-xs"
                        value={it.status}
                        onChange={(e) => setStatus(it, e.target.value)}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="py-2"><input className="border rounded px-1 py-0.5 text-xs w-full" placeholder="Room" value={newItem.room ?? ""} onChange={(e) => setNewItem({ ...newItem, room: e.target.value })} /></td>
                  <td><input className="border rounded px-1 py-0.5 text-xs w-full" placeholder="Category" value={newItem.category ?? ""} onChange={(e) => setNewItem({ ...newItem, category: e.target.value })} /></td>
                  <td><input className="border rounded px-1 py-0.5 text-xs w-full" placeholder="Description" value={newItem.description ?? ""} onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} /></td>
                  <td>
                    <select className="border rounded px-1 py-0.5 text-xs" value={newItem.severity ?? "MINOR"} onChange={(e) => setNewItem({ ...newItem, severity: e.target.value })}>
                      {Object.keys(SEVERITY_COLORS).map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td><input className="border rounded px-1 py-0.5 text-xs w-full" placeholder="Contractor" value={newItem.contractorName ?? ""} onChange={(e) => setNewItem({ ...newItem, contractorName: e.target.value })} /></td>
                  <td><input className="border rounded px-1 py-0.5 text-xs w-full" type="date" value={newItem.dueDate ?? ""} onChange={(e) => setNewItem({ ...newItem, dueDate: e.target.value })} /></td>
                  <td>
                    <button className="bg-primary text-white text-xs px-2 py-1 rounded" onClick={() => addItem(list.id)}>
                      + Add
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        ))
      )}
    </div>
  );
}
