import { useNavigate } from "react-router-dom";

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[70vh] px-6 text-center">
      {/* Icon */}
      <div className="w-24 h-24 rounded-3xl bg-muted border border-border flex items-center justify-center text-5xl mb-8 select-none">
        🏚️
      </div>

      {/* Heading */}
      <h1 className="text-foreground text-3xl font-semibold mb-3 tracking-tight">
        404 — Page Not Found
      </h1>

      {/* Subtext */}
      <p className="text-muted-foreground text-sm mb-10 max-w-sm leading-relaxed">
        The page you're looking for doesn't exist or may have been moved.
        Head back to the dashboard to continue.
      </p>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="px-5 py-2.5 text-muted-foreground hover:text-foreground border border-border hover:bg-muted text-sm font-medium rounded-lg transition-colors"
        >
          ← Go Back
        </button>
        <button
          onClick={() => navigate("/")}
          className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-lg transition-colors shadow-sm"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
