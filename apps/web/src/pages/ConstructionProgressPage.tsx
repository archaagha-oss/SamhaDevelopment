import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { constructionApi } from "../services/phase2ApiService";
import { PageHeader, PageContainer } from "../components/layout";
import ProjectSubTabs from "../components/project/ProjectSubTabs";
import { optimisticAction } from "../lib/optimisticToast";
import { formatDate } from "../utils/format";
import { useSettings } from "../contexts/SettingsContext";

// ---------------------------------------------------------------------------
// Types — mirror the constructionApi response shape so we can avoid any-casts.
// ---------------------------------------------------------------------------

interface Milestone {
  id:              string;
  projectId:       string;
  label:           string;
  description:     string | null;
  targetDate:      string;
  completedDate:   string | null;
  progressPercent: number;
  sortOrder:       number;
  notes:           string | null;
  lastUpdatedBy?:  string | null;
}

interface ProgressData {
  overallPercent:  number;
  completedCount:  number;
  totalCount:      number;
  milestones:      Milestone[];
  nextMilestone:   Milestone | null;
  paymentTriggers: number[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusFromPercent(pct: number): { label: string; classes: string } {
  if (pct >= 100) {
    return { label: "Complete", classes: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" };
  }
  if (pct > 0) {
    return { label: "In progress", classes: "bg-amber-500/15 text-amber-700 border-amber-500/30" };
  }
  return { label: "Not started", classes: "bg-muted text-muted-foreground border-border" };
}

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // YYYY-MM-DD for <input type="date">.
  return d.toISOString().slice(0, 10);
}

// Sort by sortOrder asc, then targetDate asc. Stable secondary on id so
// ties don't flicker between renders.
function sortMilestones(arr: Milestone[]): Milestone[] {
  return [...arr].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    const ta = new Date(a.targetDate).getTime();
    const tb = new Date(b.targetDate).getTime();
    if (ta !== tb) return ta - tb;
    return a.id.localeCompare(b.id);
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ConstructionProgressPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { settings } = useSettings();

  const [data, setData]       = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);

  // Add-milestone inline form state.
  const [newLabel, setNewLabel]             = useState("");
  const [newTargetDate, setNewTargetDate]   = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [adding, setAdding]                 = useState(false);

  const load = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await constructionApi.getProgress(projectId);
      setData(res as ProgressData);
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // ── Mutation helpers ────────────────────────────────────────────────────

  const patchMilestone = async (
    m: Milestone,
    patch: Partial<Pick<Milestone, "label" | "targetDate" | "completedDate" | "notes" | "description" | "progressPercent">>,
    opts: { silent?: boolean } = {},
  ) => {
    try {
      // updatePercent is the one path that surfaces paymentsTriggered today,
      // but the new backend response includes it on every PATCH. Use the
      // generic `update` and read paymentsTriggered off the result.
      const result: any = await constructionApi.update(m.id, patch);
      const triggered: Array<{ paymentId: string }> = result?.paymentsTriggered ?? [];
      if (patch.progressPercent !== undefined) {
        if (triggered.length > 0) {
          toast.success(
            `Updated to ${patch.progressPercent}% — ${triggered.length} payment(s) marked due`,
          );
        } else if (!opts.silent) {
          toast.success(`Updated to ${patch.progressPercent}%`);
        }
      } else if (!opts.silent) {
        toast.success("Saved");
      }
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? e.message);
    }
  };

  const updatePercent = (m: Milestone, value: number) => {
    if (Number.isNaN(value) || value < 0 || value > 100) {
      toast.error("Percent must be between 0 and 100");
      return;
    }
    if (value === m.progressPercent) return;
    void patchMilestone(m, { progressPercent: value }, { silent: false });
  };

  const removeMilestone = async (m: Milestone) => {
    if (!projectId) return;
    // Optimistically drop from local state so the row disappears immediately;
    // the Undo branch re-creates with the same field set (id will differ —
    // backend issues a fresh cuid — but the user sees their milestone back).
    setData((prev) =>
      prev ? { ...prev, milestones: prev.milestones.filter((x) => x.id !== m.id) } : prev,
    );
    try {
      await optimisticAction({
        do: () => constructionApi.remove(m.id),
        undo: async () => {
          await constructionApi.create(projectId, {
            label:           m.label,
            targetDate:      m.targetDate,
            description:     m.description ?? undefined,
            progressPercent: m.progressPercent,
            sortOrder:       m.sortOrder,
            notes:           m.notes ?? undefined,
          });
        },
        message:     `Deleted "${m.label}"`,
        description: "Undo to restore",
        onUndone:    () => { void load(); },
      });
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? e.message);
      await load();
    }
  };

  const addMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;
    if (!newLabel.trim()) {
      toast.error("Label is required");
      return;
    }
    if (!newTargetDate) {
      toast.error("Target date is required");
      return;
    }
    setAdding(true);
    try {
      await constructionApi.create(projectId, {
        label:       newLabel.trim(),
        targetDate:  newTargetDate,
        description: newDescription.trim() || undefined,
      });
      setNewLabel("");
      setNewTargetDate("");
      setNewDescription("");
      toast.success("Milestone added");
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? e.message);
    } finally {
      setAdding(false);
    }
  };

  // ── Derived ─────────────────────────────────────────────────────────────

  const sortedMilestones = useMemo(
    () => (data ? sortMilestones(data.milestones) : []),
    [data],
  );

  if (!projectId) {
    return <div className="p-6">Project ID required.</div>;
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader
        crumbs={[
          { label: "Home", path: "/" },
          { label: "Projects", path: "/projects" },
          { label: "Project", path: `/projects/${projectId}` },
          { label: "Construction" },
        ]}
        title="Construction progress"
        subtitle="Track each construction milestone and trigger any payments tied to overall progress."
      />
      {projectId && <ProjectSubTabs projectId={projectId} currentKey="construction" showOverview />}
      <div className="flex-1 overflow-auto">
        <PageContainer>
          <div className="space-y-6">
            {loading || !data ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : (
              <>
                <OverallCard data={data} settings={settings} />

                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Milestones
                    </h2>
                    <span className="text-xs text-muted-foreground">
                      {sortedMilestones.length} total
                    </span>
                  </div>

                  {sortedMilestones.length === 0 ? (
                    <div className="bg-card border border-border rounded-lg p-6 text-center text-muted-foreground">
                      No construction milestones yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {sortedMilestones.map((m) => (
                        <MilestoneRow
                          key={m.id}
                          milestone={m}
                          settings={settings}
                          onPatch={(patch) => patchMilestone(m, patch)}
                          onPercent={(v) => updatePercent(m, v)}
                          onDelete={() => removeMilestone(m)}
                        />
                      ))}
                    </div>
                  )}

                  {/* Add-milestone form */}
                  <form
                    onSubmit={addMilestone}
                    className="bg-card border border-border rounded-lg p-4"
                  >
                    <div className="text-sm font-medium text-foreground mb-3">
                      Add milestone
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
                      <input
                        type="text"
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        placeholder="Label (e.g. Roof slab cast)"
                        className="border border-border bg-background rounded-md px-3 py-1.5 text-sm"
                        required
                      />
                      <input
                        type="date"
                        value={newTargetDate}
                        onChange={(e) => setNewTargetDate(e.target.value)}
                        className="border border-border bg-background rounded-md px-3 py-1.5 text-sm"
                        required
                      />
                      <button
                        type="submit"
                        disabled={adding}
                        className="bg-primary text-white text-sm rounded-md px-4 py-1.5 disabled:opacity-50"
                      >
                        {adding ? "Adding…" : "Add"}
                      </button>
                    </div>
                    <input
                      type="text"
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder="Description (optional)"
                      className="mt-2 w-full border border-border bg-background rounded-md px-3 py-1.5 text-sm"
                    />
                  </form>
                </section>
              </>
            )}
          </div>
        </PageContainer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function OverallCard({
  data,
  settings,
}: {
  data: ProgressData;
  settings: ReturnType<typeof useSettings>["settings"];
}) {
  const { overallPercent, completedCount, totalCount, nextMilestone, paymentTriggers } = data;

  // Next payment threshold that hasn't yet fired (strictly greater than the
  // current overall %). The page surfaces this as a "next payment fires at X%"
  // hint so the operator understands what's gated.
  const nextThreshold = paymentTriggers
    .filter((p) => p > overallPercent)
    .sort((a, b) => a - b)[0];

  return (
    <section className="bg-card border border-border rounded-lg p-5 space-y-4">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-sm text-muted-foreground">Overall progress</div>
          <div className="text-4xl font-semibold text-foreground tabular-nums">
            {overallPercent}%
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-foreground">
            {completedCount} of {totalCount} milestones complete
          </div>
          {nextMilestone && (
            <div className="text-xs text-muted-foreground mt-0.5">
              Up next: {nextMilestone.label}
              {nextMilestone.targetDate && ` — target ${formatDate(nextMilestone.targetDate, settings)}`}
            </div>
          )}
        </div>
      </div>

      <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
        <div
          className="bg-primary h-full rounded-full transition-all"
          style={{ width: `${Math.min(100, Math.max(0, overallPercent))}%` }}
        />
      </div>

      {paymentTriggers.length > 0 && (
        <div className="text-xs text-muted-foreground border-t border-border pt-3">
          Payments are wired to fire at:{" "}
          <span className="font-medium text-foreground">
            {paymentTriggers.map((p) => `${p}%`).join(", ")}
          </span>
          {nextThreshold !== undefined && (
            <span>
              {" · "}
              Next payment fires at <span className="font-medium text-foreground">{nextThreshold}%</span>
            </span>
          )}
        </div>
      )}
    </section>
  );
}

function MilestoneRow({
  milestone,
  settings,
  onPatch,
  onPercent,
  onDelete,
}: {
  milestone: Milestone;
  settings: ReturnType<typeof useSettings>["settings"];
  onPatch: (patch: Partial<Pick<Milestone, "label" | "targetDate" | "completedDate" | "notes" | "description" | "progressPercent">>) => void;
  onPercent: (value: number) => void;
  onDelete: () => void;
}) {
  // Local "draft" state for inline-editable fields. Server is the source of
  // truth — we commit on blur and re-load.
  const [labelDraft, setLabelDraft]             = useState(milestone.label);
  const [targetDraft, setTargetDraft]           = useState(toDateInput(milestone.targetDate));
  const [completedDraft, setCompletedDraft]     = useState(toDateInput(milestone.completedDate));
  const [notesDraft, setNotesDraft]             = useState(milestone.notes ?? "");
  const [percentDraft, setPercentDraft]         = useState(milestone.progressPercent);

  // Keep drafts in sync when the milestone updates from the server (e.g. after
  // a percent change auto-stamps completedDate).
  useEffect(() => { setLabelDraft(milestone.label); }, [milestone.label]);
  useEffect(() => { setTargetDraft(toDateInput(milestone.targetDate)); }, [milestone.targetDate]);
  useEffect(() => { setCompletedDraft(toDateInput(milestone.completedDate)); }, [milestone.completedDate]);
  useEffect(() => { setNotesDraft(milestone.notes ?? ""); }, [milestone.notes]);
  useEffect(() => { setPercentDraft(milestone.progressPercent); }, [milestone.progressPercent]);

  const status = statusFromPercent(milestone.progressPercent);

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      {/* Header row — label + status + delete */}
      <div className="flex items-start gap-3">
        <input
          type="text"
          value={labelDraft}
          onChange={(e) => setLabelDraft(e.target.value)}
          onBlur={() => {
            const trimmed = labelDraft.trim();
            if (!trimmed) {
              setLabelDraft(milestone.label);
              return;
            }
            if (trimmed !== milestone.label) onPatch({ label: trimmed });
          }}
          className="flex-1 text-base font-medium text-foreground bg-transparent border border-transparent hover:border-border focus:border-border focus:outline-none focus:ring-1 focus:ring-ring rounded px-2 py-1 -mx-2 -my-1"
        />
        <span
          className={`text-xs px-2 py-0.5 rounded-full border ${status.classes} whitespace-nowrap`}
        >
          {status.label}
        </span>
        <button
          type="button"
          onClick={onDelete}
          className="text-muted-foreground hover:text-destructive p-1"
          aria-label={`Delete ${milestone.label}`}
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Progress slider + numeric */}
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={100}
          value={percentDraft}
          onChange={(e) => setPercentDraft(Number(e.target.value))}
          onMouseUp={() => {
            if (percentDraft !== milestone.progressPercent) onPercent(percentDraft);
          }}
          onTouchEnd={() => {
            if (percentDraft !== milestone.progressPercent) onPercent(percentDraft);
          }}
          onKeyUp={(e) => {
            if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
              if (percentDraft !== milestone.progressPercent) onPercent(percentDraft);
            }
          }}
          className="flex-1 accent-primary"
        />
        <input
          type="number"
          min={0}
          max={100}
          value={percentDraft}
          onChange={(e) => setPercentDraft(Number(e.target.value))}
          onBlur={() => {
            if (percentDraft !== milestone.progressPercent) onPercent(percentDraft);
          }}
          className="w-20 border border-border bg-background rounded px-2 py-1 text-sm text-right tabular-nums"
        />
        <span className="text-sm text-muted-foreground w-4">%</span>
      </div>

      {/* Inline progress bar — visual reinforcement of the slider */}
      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
        <div
          className="bg-primary h-full rounded-full transition-all"
          style={{ width: `${milestone.progressPercent}%` }}
        />
      </div>

      {/* Dates + notes */}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-muted-foreground">Target date</span>
          <input
            type="date"
            value={targetDraft}
            onChange={(e) => setTargetDraft(e.target.value)}
            onBlur={() => {
              if (targetDraft && targetDraft !== toDateInput(milestone.targetDate)) {
                onPatch({ targetDate: targetDraft });
              }
            }}
            className="mt-1 w-full border border-border bg-background rounded-md px-3 py-1.5 text-sm"
          />
          {milestone.targetDate && (
            <span className="text-xs text-muted-foreground mt-1 block">
              {formatDate(milestone.targetDate, settings)}
            </span>
          )}
        </label>
        <label className="block">
          <span className="text-xs text-muted-foreground">Completed date</span>
          <input
            type="date"
            value={completedDraft}
            onChange={(e) => setCompletedDraft(e.target.value)}
            onBlur={() => {
              const next = completedDraft || null;
              const current = toDateInput(milestone.completedDate);
              if ((next ?? "") !== current) {
                onPatch({ completedDate: next as any });
              }
            }}
            className="mt-1 w-full border border-border bg-background rounded-md px-3 py-1.5 text-sm"
          />
          {milestone.completedDate && (
            <span className="text-xs text-muted-foreground mt-1 block">
              {formatDate(milestone.completedDate, settings)}
            </span>
          )}
        </label>
      </div>

      <label className="block">
        <span className="text-xs text-muted-foreground">Notes</span>
        <textarea
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
          onBlur={() => {
            const next = notesDraft.trim();
            if (next !== (milestone.notes ?? "")) {
              onPatch({ notes: next || null });
            }
          }}
          rows={2}
          placeholder="Site notes, blockers, photos pending…"
          className="mt-1 w-full border border-border bg-background rounded-md px-3 py-1.5 text-sm resize-y"
        />
      </label>
    </div>
  );
}
