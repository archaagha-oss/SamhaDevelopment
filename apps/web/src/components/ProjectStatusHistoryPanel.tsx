import { useProjectStatusHistory } from "../hooks/useProjectStatusHistory";

interface Props {
  projectId: string;
  limit?: number;
}

function describe(field: string, oldValue: string | null, newValue: string): string {
  if (field === "projectStatus") {
    return `Project status: ${oldValue ?? "—"} → ${newValue}`;
  }
  if (field === "completionStatus") {
    return `Completion stage: ${oldValue?.replace(/_/g, " ") ?? "—"} → ${newValue.replace(/_/g, " ")}`;
  }
  if (field === "handoverDate") {
    const fmt = (v: string | null) => (v ? new Date(v).toLocaleDateString() : "—");
    return `Handover date: ${fmt(oldValue)} → ${fmt(newValue || null)}`;
  }
  return `${field}: ${oldValue ?? "—"} → ${newValue}`;
}

export default function ProjectStatusHistoryPanel({ projectId, limit = 20 }: Props) {
  const query = useProjectStatusHistory(projectId, limit);

  return (
    <section style={{ marginTop: 24 }}>
      <h3 style={{ margin: 0, fontSize: 16 }}>Status history</h3>
      {query.isLoading ? (
        <p style={{ color: "hsl(var(--muted-foreground))", marginTop: 8 }}>Loading…</p>
      ) : (query.data ?? []).length === 0 ? (
        <p style={{ color: "hsl(var(--muted-foreground))", marginTop: 8, fontSize: 14 }}>No status changes yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0 0" }}>
          {(query.data ?? []).map((entry) => (
            <li
              key={entry.id}
              style={{
                padding: 10,
                border: "1px solid hsl(var(--border))",
                borderRadius: 6,
                marginBottom: 6,
                fontSize: 14,
              }}
            >
              <p style={{ margin: 0 }}>{describe(entry.field, entry.oldValue, entry.newValue)}</p>
              <p style={{ margin: "4px 0 0 0", color: "hsl(var(--muted-foreground))", fontSize: 12 }}>
                {new Date(entry.changedAt).toLocaleString()} · {entry.changedBy}
                {entry.reason ? ` · ${entry.reason}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
