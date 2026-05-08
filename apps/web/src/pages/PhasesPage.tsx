import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { phasesApi } from "../services/phase2ApiService";

interface Phase {
  id: string;
  name: string;
  code: string | null;
  sortOrder: number;
  floorFrom: number | null;
  floorTo: number | null;
  releaseStage: "INTERNAL" | "BROKER_PREVIEW" | "PUBLIC";
  releaseStageAt: string | null;
  publicLaunchDate: string | null;
  _count?: { units: number };
}

const STAGE_COLORS: Record<string, string> = {
  INTERNAL: "bg-gray-200 text-gray-800",
  BROKER_PREVIEW: "bg-amber-100 text-amber-800",
  PUBLIC: "bg-green-100 text-green-800",
};

export default function PhasesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [phases, setPhases] = useState<Phase[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await phasesApi.listForProject(projectId);
      setPhases(data);
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [projectId]);

  const advance = async (phase: Phase) => {
    const nextStage =
      phase.releaseStage === "INTERNAL"
        ? "BROKER_PREVIEW"
        : phase.releaseStage === "BROKER_PREVIEW"
          ? "PUBLIC"
          : null;
    if (!nextStage) {
      toast.info("Phase is already in PUBLIC release.");
      return;
    }
    try {
      await phasesApi.changeReleaseStage(phase.id, nextStage);
      toast.success(`Phase advanced to ${nextStage}`);
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? e.message);
    }
  };

  if (!projectId) return <div className="p-6">Project ID required.</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Project Phases</h1>
      </div>
      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : phases.length === 0 ? (
        <p className="text-gray-500">No phases configured for this project.</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left text-xs uppercase text-gray-500 border-b">
              <th className="py-2">Phase</th>
              <th>Code</th>
              <th>Floors</th>
              <th>Units</th>
              <th>Release Stage</th>
              <th>Public Launch</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {phases.map((p) => (
              <tr key={p.id} className="border-b">
                <td className="py-2">{p.name}</td>
                <td>{p.code ?? "—"}</td>
                <td>{p.floorFrom != null ? `${p.floorFrom}-${p.floorTo ?? "?"}` : "—"}</td>
                <td>{p._count?.units ?? "—"}</td>
                <td>
                  <span className={`px-2 py-1 rounded text-xs ${STAGE_COLORS[p.releaseStage]}`}>
                    {p.releaseStage}
                  </span>
                </td>
                <td>{p.publicLaunchDate ? new Date(p.publicLaunchDate).toLocaleDateString() : "—"}</td>
                <td>
                  {p.releaseStage !== "PUBLIC" && (
                    <button
                      className="text-blue-600 hover:underline text-sm"
                      onClick={() => advance(p)}
                    >
                      Advance Stage →
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
