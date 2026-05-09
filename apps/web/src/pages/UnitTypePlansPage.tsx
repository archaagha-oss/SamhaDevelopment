import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { typePlansApi } from "../services/phase2ApiService";
import { PageHeader, PageContainer } from "../components/layout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Spinner } from "../components/ui/spinner";
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

const NUMERIC_KEYS = new Set([
  "area",
  "internalArea",
  "externalArea",
  "bathrooms",
  "parkingSpaces",
  "basePrice",
]);

const FORM_FIELDS: Array<[keyof Plan, string]> = [
  ["code", "Code"],
  ["name", "Name"],
  ["type", "Type"],
  ["area", "Total area (sqm)"],
  ["internalArea", "Internal area"],
  ["externalArea", "External area"],
  ["bathrooms", "Bathrooms"],
  ["parkingSpaces", "Parking"],
  ["basePrice", "Base price (AED)"],
];

export default function UnitTypePlansPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<Plan>>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<Plan | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const requestDelete = (plan: Plan) => {
    const units = plan._count?.units ?? 0;
    if (units > 0) {
      toast.error(`Cannot delete: ${units} units still use this plan.`);
      return;
    }
    setPendingDelete(plan);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await typePlansApi.remove(pendingDelete.id);
      toast.success("Deleted");
      setPendingDelete(null);
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? e.message);
    } finally {
      setDeleting(false);
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
          <Button
            type="button"
            size="sm"
            variant={showForm ? "outline" : "default"}
            onClick={() => setShowForm((s) => !s)}
          >
            {showForm ? "Cancel" : "Create type plan"}
          </Button>
        }
      />
      <div className="flex-1 overflow-auto">
        <PageContainer>
          <div className="space-y-5">
            {showForm && (
              <form
                className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-muted/50 p-4 rounded-lg border border-border"
                onSubmit={submit}
              >
                {FORM_FIELDS.map(([key, label]) => (
                  <label key={key} className="flex flex-col text-xs text-foreground gap-1">
                    {label}
                    <Input
                      value={(form as any)[key] ?? ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          [key]: NUMERIC_KEYS.has(key as string)
                            ? Number(e.target.value)
                            : e.target.value,
                        })
                      }
                    />
                  </label>
                ))}
                <div className="col-span-1 sm:col-span-3 text-right">
                  <Button type="submit" size="sm">
                    Save
                  </Button>
                </div>
              </form>
            )}

            {loading ? (
              <p className="text-muted-foreground flex items-center gap-2">
                <Spinner size="sm" /> Loading…
              </p>
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
                      <td>
                        {p.basePrice != null
                          ? `AED ${p.basePrice.toLocaleString()}`
                          : "—"}
                      </td>
                      <td>{p._count?.units ?? 0}</td>
                      <td>
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          onClick={() => requestDelete(p)}
                          className="h-auto p-0 text-sm text-destructive"
                        >
                          Delete
                        </Button>
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
        open={!!pendingDelete}
        title="Delete type plan?"
        message={
          pendingDelete
            ? `"${pendingDelete.code} — ${pendingDelete.name}" will be permanently deleted. This cannot be undone.`
            : ""
        }
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
