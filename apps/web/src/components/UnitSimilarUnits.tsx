import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { formatAreaShort } from "../utils/formatArea";
import { formatDirham } from "@/lib/money";

interface SimilarUnit {
  id: string;
  unitNumber: string;
  floor: number;
  area: number;
  price: number;
  status: string;
  projectId: string;
}

interface Props {
  currentUnitId: string;
  projectId: string;
  type: string;
}

const STATUS_COLORS: Record<string, string> = {
  NOT_RELEASED: "bg-muted text-muted-foreground",
  AVAILABLE:    "bg-success-soft text-success",
  RESERVED:     "bg-warning-soft text-warning",
  BOOKED:       "bg-stage-active text-stage-active-foreground",
  SOLD:         "bg-destructive-soft text-destructive",
  BLOCKED:      "bg-neutral-200 text-muted-foreground",
  HANDED_OVER:  "bg-chart-5/15 text-chart-5",
};

export default function UnitSimilarUnits({ currentUnitId, projectId, type }: Props) {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["similar-units", projectId, type],
    queryFn: async () => {
      const res = await axios.get("/api/units", {
        params: { projectId, type, limit: 20 },
      });
      const units: SimilarUnit[] = res.data.data || res.data;
      return units.filter((u) => u.id !== currentUnitId).slice(0, 6);
    },
    staleTime: 5 * 60 * 1000,
  });

  const units = data ?? [];

  const availableCount = units.filter((u) => u.status === "AVAILABLE").length;

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg border border-border p-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Similar Units</p>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (units.length === 0) return null;

  return (
    <div className="bg-card rounded-lg border border-border p-5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Similar Units
          <span className="ml-2 text-muted-foreground font-normal">{type.replace(/_/g, " ")}</span>
        </p>
      </div>
      <p className="text-[10px] text-muted-foreground mb-3">
        {availableCount} of {units.length} available in this project
      </p>

      <div className="space-y-1">
        {units.map((u) => (
          <button
            key={u.id}
            onClick={() => navigate(`/projects/${u.projectId}/units/${u.id}`)}
            className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted/50 transition-colors text-left group"
          >
            <span className="font-mono text-xs font-semibold text-foreground w-12 flex-shrink-0 group-hover:text-primary">
              {u.unitNumber}
            </span>
            <span className="text-[10px] text-muted-foreground flex-shrink-0">Fl.{u.floor}</span>
            <span className="text-[10px] text-muted-foreground flex-1">{formatAreaShort(u.area)}</span>
            <span className="text-[10px] font-semibold text-foreground">
              {formatDirham(u.price)}
            </span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLORS[u.status] || "bg-muted text-muted-foreground"}`}>
              {u.status.replace(/_/g, " ")}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
