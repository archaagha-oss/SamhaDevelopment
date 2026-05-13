import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { PageContainer, PageHeader } from "../components/layout";

/**
 * Manager-facing leaderboard backed by GET /api/reports/agents/leaderboard.
 * Closes audit gap #3.
 *
 * Columns are kept sortable client-side too so a manager can re-rank by any
 * metric without a round-trip; the server-side sort param drives initial order
 * and matters when the result set is large enough to be paginated.
 */

type SortKey =
  | "salesValueClosed"
  | "conversionRate"
  | "activitiesInWindow"
  | "dealsClosedInWindow"
  | "newLeadsInWindow";

interface Row {
  agent: { id: string; name: string; email: string; role: string; jobTitle: string | null; avatarUrl: string | null };
  leadCount: number;
  newLeadsInWindow: number;
  activitiesInWindow: number;
  dealsCreatedInWindow: number;
  dealsClosedInWindow: number;
  salesValueClosed: number;
  conversionRate: number;
}

interface LeaderboardResponse {
  since: string;
  until: string;
  sort: SortKey;
  rows: Row[];
}

const WINDOWS: Array<{ label: string; days: number }> = [
  { label: "Last 7 days",  days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "Year to date", days: 365 },
];

function formatAed(n: number): string {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(n);
}

export default function AgentLeaderboardPage() {
  const [days, setDays] = useState(30);
  const [sort, setSort] = useState<SortKey>("salesValueClosed");

  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  }, [days]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["agentLeaderboard", since, sort],
    queryFn: async (): Promise<LeaderboardResponse> => {
      const res = await axios.get("/api/reports/agents/leaderboard", {
        params: { since, sort, limit: 50 },
      });
      return res.data;
    },
    staleTime: 60_000,
  });

  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader
        crumbs={[{ label: "Home", path: "/" }, { label: "Agent leaderboard" }]}
        title="Agent leaderboard"
        subtitle={`${data?.rows.length ?? 0} agents · last ${days} days`}
        actions={(
          <div className="flex gap-2">
            <select
              className="h-9 px-2.5 text-sm border border-input rounded-lg bg-card focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              aria-label="Time window"
            >
              {WINDOWS.map((w) => (
                <option key={w.days} value={w.days}>{w.label}</option>
              ))}
            </select>
            <select
              className="h-9 px-2.5 text-sm border border-input rounded-lg bg-card focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="Sort by"
            >
              <option value="salesValueClosed">Sort: Sales value</option>
              <option value="conversionRate">Sort: Conversion %</option>
              <option value="dealsClosedInWindow">Sort: Deals closed</option>
              <option value="activitiesInWindow">Sort: Activities</option>
              <option value="newLeadsInWindow">Sort: New leads</option>
            </select>
          </div>
        )}
      />
      <div className="flex-1 overflow-auto">
      <PageContainer padding="default" className="space-y-4">
      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {isError && <div className="text-sm text-destructive">Failed to load leaderboard.</div>}

      {data && (
        <div className="overflow-x-auto border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-3 py-2 w-10">#</th>
                <th className="text-left px-3 py-2">Agent</th>
                <th className="text-right px-3 py-2">New leads</th>
                <th className="text-right px-3 py-2">Activities</th>
                <th className="text-right px-3 py-2">Deals created</th>
                <th className="text-right px-3 py-2">Deals closed</th>
                <th className="text-right px-3 py-2">Conv. %</th>
                <th className="text-right px-3 py-2">Sales value</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, idx) => (
                <tr key={r.agent.id} className="border-t">
                  <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.agent.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.agent.jobTitle ?? r.agent.role} · {r.agent.email}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.newLeadsInWindow}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.activitiesInWindow}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.dealsCreatedInWindow}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.dealsClosedInWindow}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.conversionRate.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatAed(r.salesValueClosed)}</td>
                </tr>
              ))}
              {data.rows.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">No active agents in window.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Window: {data?.since.slice(0, 10)} → {data?.until.slice(0, 10)}.
        Sales-value-closed is summed from sale price on deals that reached
        the COMPLETED stage in the window. Internal-agent commission isn't
        tracked directly today (Commission rows are broker-keyed); see
        LAUNCH_READINESS_AUDIT.md for follow-up.
      </p>
      </PageContainer>
      </div>
    </div>
  );
}
