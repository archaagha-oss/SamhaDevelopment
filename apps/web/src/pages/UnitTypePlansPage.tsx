import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { formatDirham } from "@/lib/money";
import { typePlansApi } from "../services/phase2ApiService";
import { PageHeader, PageContainer } from "../components/layout";
import ConfirmDialog from "../components/ConfirmDialog";

interface Plan {
  id: string;
  code: string;
  name: string;
  type: string;
  area: number | null;
  internalArea: number | null;
  externalArea: number | null;
  bathrooms: number | null;
  parkingSpaces: number | null;
  basePrice: number | null;
  _count?: { units: number };
}

const EMPTY: Partial<Plan> = {
  code: "",
  name: "",
  type: "ONE_BR",
  area: 0,
  internalArea: 0,
  externalArea: 0,
  bathrooms: 1,
  parkingSpaces: 1,
  basePrice: 0,
};

export default function UnitTypePlansPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<Plan>>(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await typePlansApi.listForProject(projectId);
      setPlans(data);
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [projectId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;
    try {
      await typePlansApi.create({ ...form, projectId });
      toast.success("Type plan created");
      setShowForm(false);
      setForm(EMPTY);
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? err.message);
    }
  };

  const remove = (id: string, units: number) => {
    if (units > 0) {
      toast.error(`Cannot delete: ${units} units still use this plan.`);
      return;
    }
    setConfirmDelete({ id });
  };

  const performDelete = async (id: string) => {
    try {
      await typePlansApi.remove(id);
      toast.success("Deleted");
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? e.message);
    }
  };

  if (!projectId) return <div className="p-6">Project ID required.</div>;

  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader
        crumbs={[
          { label: "Home", path: "/" },
          { label: "Projects", path: "/projects" },
          { label: "Type plans" },
        ]}
        title="Unit type plans"
        subtitle="Standardized layouts (1BR, 2BR, etc.) — area, bathrooms, parking — that units of the same type share."
        actions={
          <button
            className="text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-4 py-2 transition-colors"
            onClick={() => setShowForm((s) => !s)}
          >
            {showForm ? "Cancel" : "Create type plan"}
          </button>
        }
      />
      <div className="flex-1 overflow-auto">
        <PageContainer>
          <div className="space-y-5">

      {showForm && (
        <form className="grid grid-cols-3 gap-3 bg-muted/50 p-4 rounded" onSubmit={submit}>
          {(
            [
              ["code", "Code"],
              ["name", "Name"],
              ["type", "Type"],
              ["area", "Total area (sqm)"],
              ["internalArea", "Internal area"],
              ["externalArea", "External area"],
              ["bathrooms", "Bathrooms"],
              ["parkingSpaces", "Parking"],
              ["basePrice", "Base price"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex flex-col text-xs text-foreground">
              {label}
              <input
                className="border rounded px-2 py-1 mt-1 text-sm"
                value={(form as any)[key] ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    [key]: ["area", "internalArea", "externalArea", "bathrooms", "parkingSpaces", "basePrice"].includes(
                      key,
                    )
                      ? Number(e.target.value)
                      : e.target.value,
                  })
                }
              />
            </label>
          ))}
          <div className="col-span-3 text-right">
            <button className="bg-primary text-white px-3 py-1 rounded text-sm" type="submit">
              Save
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : plans.length === 0 ? (
        <p className="text-muted-foreground">No type plans yet.</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left text-xs uppercase text-muted-foreground border-b">
              <th className="py-2">Code</th>
              <th>Name</th>
              <th>Type</th>
              <th>Area</th>
              <th>Bathrooms</th>
              <th>Base price</th>
              <th>Units</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id} className="border-b">
                <td className="py-2 font-mono">{p.code}</td>
                <td>{p.name}</td>
                <td>{p.type}</td>
                <td>{p.area ?? "—"}</td>
                <td>{p.bathrooms ?? "—"}</td>
                <td>{p.basePrice != null ? formatDirham(p.basePrice) : "—"}</td>
                <td>{p._count?.units ?? 0}</td>
                <td>
                  <button
                    className="text-destructive hover:underline text-sm"
                    onClick={() => remove(p.id, p._count?.units ?? 0)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
          </div>
        </PageContainer>
      </div>
      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete type plan?"
        message="This unit type plan will be permanently removed. Units already linked to other plans aren't affected."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          const target = confirmDelete;
          setConfirmDelete(null);
          if (target) performDelete(target.id);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
