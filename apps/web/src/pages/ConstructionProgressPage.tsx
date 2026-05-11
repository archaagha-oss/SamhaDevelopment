import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { constructionApi } from "../services/phase2ApiService";
import { PageHeader, PageContainer } from "../components/layout";

interface Milestone {
  id: string;
  stage: string;
  label: string;
  description: string | null;
  percentComplete: number;
  expectedDate: string | null;
  achievedDate: string | null;
  phaseId: string | null;
}

// Legacy stage buckets — kept for backwards-compat reference. The current
// backend (ConstructionMilestone) doesn't carry a `stage` enum; the API
// client normalises every milestone to a single "MILESTONE" stage so the
// section-grouping render path below collapses to one flat list.
const STAGES = ["MILESTONE"];

export default function ConstructionProgressPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await constructionApi.listForProject(projectId);
      setMilestones(data);
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [projectId]);

  const updatePct = async (m: Milestone, value: number) => {
    if (Number.isNaN(value) || value < 0 || value > 100) {
      toast.error("Percent must be between 0 and 100");
      return;
    }
    try {
      const result = await constructionApi.updatePercent(m.id, value);
      const fired = (result as any).paymentsTriggered?.length ?? 0;
      toast.success(`Updated to ${value}%${fired ? ` — ${fired} payment(s) fired` : ""}`);
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
          { label: "Construction" },
        ]}
        title="Construction progress"
        subtitle={
          <>
            When a milestone's percent crosses a payment-plan trigger threshold, matching{" "}
            <code className="px-1 bg-muted rounded">ON_CONSTRUCTION_PCT</code> payments fire automatically.
          </>
        }
      />
      <div className="flex-1 overflow-auto">
        <PageContainer>
          <div className="space-y-5">

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-3">
          {STAGES.map((stage) => {
            const items = milestones.filter((m) => m.stage === stage);
            if (items.length === 0) return null;
            return (
              <section key={stage} className="border rounded p-4">
                <h3 className="font-semibold text-sm uppercase text-foreground mb-2">{stage}</h3>
                <div className="space-y-2">
                  {items.map((m) => (
                    <div key={m.id} className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="text-sm font-medium">{m.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {m.description ?? ""}
                          {m.expectedDate && ` · expected ${new Date(m.expectedDate).toLocaleDateString()}`}
                          {m.achievedDate && ` · achieved ${new Date(m.achievedDate).toLocaleDateString()}`}
                        </div>
                        <div className="w-full bg-neutral-200 rounded h-2 mt-1">
                          <div
                            className="bg-primary h-2 rounded"
                            style={{ width: `${m.percentComplete}%` }}
                          />
                        </div>
                      </div>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        defaultValue={m.percentComplete}
                        className="w-20 border rounded px-2 py-1 text-sm"
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (v !== m.percentComplete) void updatePct(m, v);
                        }}
                      />
                      <span className="text-sm w-10 text-right">%</span>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
          {milestones.length === 0 && (
            <p className="text-muted-foreground">No construction milestones yet.</p>
          )}
        </div>
      )}
          </div>
        </PageContainer>
      </div>
    </div>
  );
}
