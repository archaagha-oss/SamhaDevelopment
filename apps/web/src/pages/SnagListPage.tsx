import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { Plus, ClipboardList } from "lucide-react";
import { snagsApi } from "../services/phase2ApiService";
import { PageHeader, PageContainer } from "../components/layout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Spinner } from "../components/ui/spinner";
import EmptyState from "../components/EmptyState";

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
    <div className="flex flex-col h-full bg-background">
      <PageHeader
        crumbs={[
          { label: "Home", path: "/" },
          { label: "Units", path: "/units" },
          { label: "Snag list" },
        ]}
        title="Snag list"
        subtitle="Walk-through items, severity, contractor, and resolution status."
        actions={
          <Button type="button" size="sm" onClick={ensureList}>
            Create list
          </Button>
        }
      />
      <div className="flex-1 overflow-auto">
        <PageContainer>
          <div className="space-y-5">

      {loading ? (
        <p className="text-muted-foreground flex items-center gap-2"><Spinner size="sm" /> Loading…</p>
      ) : lists.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-10 text-muted-foreground" aria-hidden="true" />}
          title="No snag lists yet"
          description="Walk-through findings, severity, contractor, and resolution status all live on a snag list. Create one when you start handover."
          action={{ label: "Create snag list", onClick: ensureList }}
        />
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
                  <td className="py-2"><Input className="h-8 text-xs" placeholder="Room" value={newItem.room ?? ""} onChange={(e) => setNewItem({ ...newItem, room: e.target.value })} /></td>
                  <td><Input className="h-8 text-xs" placeholder="Category" value={newItem.category ?? ""} onChange={(e) => setNewItem({ ...newItem, category: e.target.value })} /></td>
                  <td><Input className="h-8 text-xs" placeholder="Description" value={newItem.description ?? ""} onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} /></td>
                  <td>
                    <select
                      className="h-8 text-xs border border-input rounded-md px-2 bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={newItem.severity ?? "MINOR"}
                      onChange={(e) => setNewItem({ ...newItem, severity: e.target.value })}
                    >
                      {Object.keys(SEVERITY_COLORS).map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td><Input className="h-8 text-xs" placeholder="Contractor" value={newItem.contractorName ?? ""} onChange={(e) => setNewItem({ ...newItem, contractorName: e.target.value })} /></td>
                  <td><Input className="h-8 text-xs" type="date" value={newItem.dueDate ?? ""} onChange={(e) => setNewItem({ ...newItem, dueDate: e.target.value })} /></td>
                  <td>
                    <Button type="button" size="sm" onClick={() => addItem(list.id)}>
                      <Plus className="size-3.5" aria-hidden="true" />
                      Add
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        ))
      )}
          </div>
        </PageContainer>
      </div>
    </div>
  );
}
