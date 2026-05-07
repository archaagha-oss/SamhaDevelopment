import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { typePlansApi } from "../services/phase2ApiService";

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

  const remove = async (id: string, units: number) => {
    if (units > 0) {
      toast.error(`Cannot delete: ${units} units still use this plan.`);
      return;
    }
    if (!confirm("Delete this type plan?")) return;
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
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Unit Type Plans</h1>
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm"
          onClick={() => setShowForm((s) => !s)}
        >
          {showForm ? "Cancel" : "+ New Plan"}
        </button>
      </div>

      {showForm && (
        <form className="grid grid-cols-3 gap-3 bg-gray-50 p-4 rounded" onSubmit={submit}>
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
              ["basePrice", "Base price (AED)"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex flex-col text-xs text-gray-700">
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
            <button className="bg-blue-600 text-white px-3 py-1 rounded text-sm" type="submit">
              Save
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : plans.length === 0 ? (
        <p className="text-gray-500">No type plans yet.</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left text-xs uppercase text-gray-500 border-b">
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
                <td>{p.basePrice != null ? `AED ${p.basePrice.toLocaleString()}` : "—"}</td>
                <td>{p._count?.units ?? 0}</td>
                <td>
                  <button
                    className="text-red-600 hover:underline text-sm"
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
  );
}
