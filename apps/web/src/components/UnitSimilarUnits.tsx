import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { formatAreaShort } from "../utils/formatArea";

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
  NOT_RELEASED: "bg-gray-100 text-gray-600",
  AVAILABLE:    "bg-emerald-100 text-emerald-700",
  RESERVED:     "bg-amber-100 text-amber-700",
  BOOKED:       "bg-violet-100 text-violet-700",
  SOLD:         "bg-red-100 text-red-700",
  BLOCKED:      "bg-slate-200 text-slate-600",
  HANDED_OVER:  "bg-teal-100 text-teal-700",
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
      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Similar Units</p>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (units.length === 0) return null;

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Similar Units
          <span className="ml-2 text-slate-400 font-normal">{type.replace(/_/g, " ")}</span>
        </p>
      </div>
      <p className="text-[10px] text-slate-400 mb-3">
        {availableCount} of {units.length} available in this project
      </p>

      <div className="space-y-1">
        {units.map((u) => (
          <button
            key={u.id}
            onClick={() => navigate(`/projects/${u.projectId}/units/${u.id}`)}
            className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 transition-colors text-left group"
          >
            <span className="font-mono text-xs font-semibold text-slate-800 w-12 flex-shrink-0 group-hover:text-blue-600">
              {u.unitNumber}
            </span>
            <span className="text-[10px] text-slate-400 flex-shrink-0">Fl.{u.floor}</span>
            <span className="text-[10px] text-slate-400 flex-1">{formatAreaShort(u.area)}</span>
            <span className="text-[10px] font-semibold text-slate-700">
              AED {u.price.toLocaleString("en-AE")}
            </span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLORS[u.status] || "bg-slate-100 text-slate-600"}`}>
              {u.status.replace(/_/g, " ")}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
