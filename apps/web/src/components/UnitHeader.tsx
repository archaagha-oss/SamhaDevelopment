import { useNavigate } from "react-router-dom";

interface Props {
  unitNumber: string;
  status: string;
  projectId: string;
  projectName?: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  NOT_RELEASED: { bg: "bg-muted",    text: "text-foreground" },
  AVAILABLE:    { bg: "bg-success-soft", text: "text-success" },
  ON_HOLD:      { bg: "bg-warning-soft",  text: "text-warning" },
  RESERVED:     { bg: "bg-warning-soft",   text: "text-warning" },
  BOOKED:       { bg: "bg-stage-active",  text: "text-accent-2" },
  SOLD:         { bg: "bg-destructive-soft",     text: "text-destructive" },
  BLOCKED:      { bg: "bg-neutral-200",   text: "text-muted-foreground" },
  HANDED_OVER:  { bg: "bg-chart-5/15",    text: "text-chart-5" },
};

export default function UnitHeader({ unitNumber, status, projectId, projectName }: Props) {
  const navigate = useNavigate();
  const statusConfig = STATUS_COLORS[status] || STATUS_COLORS.AVAILABLE;

  return (
    <div className="bg-card border-b border-border sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-6 py-3">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
          <button onClick={() => navigate("/projects")} className="hover:text-foreground transition-colors">
            Projects
          </button>
          <span>/</span>
          <button onClick={() => navigate(`/projects/${projectId}`)} className="hover:text-foreground transition-colors">
            {projectName || "Project"}
          </button>
          <span>/</span>
          <span className="text-muted-foreground font-medium">Unit {unitNumber}</span>
        </div>

        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-foreground">Unit {unitNumber}</h1>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusConfig.bg} ${statusConfig.text}`}>
            {status.replace(/_/g, " ")}
          </span>
        </div>
      </div>
    </div>
  );
}
