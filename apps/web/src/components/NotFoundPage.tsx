import { useNavigate } from "react-router-dom";

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[70vh] px-6 text-center">
      {/* Icon */}
      <div className="w-24 h-24 rounded-3xl bg-slate-800 border border-slate-700 flex items-center justify-center text-5xl mb-8 select-none">
        🏚️
      </div>

      {/* Heading */}
      <h1 className="text-white text-3xl font-bold mb-3 tracking-tight">
        404 — Page Not Found
      </h1>

      {/* Subtext */}
      <p className="text-slate-400 text-sm mb-10 max-w-sm leading-relaxed">
        The page you're looking for doesn't exist or may have been moved.
        Head back to the dashboard to continue.
      </p>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="px-5 py-2.5 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 text-sm font-medium rounded-lg transition-all"
        >
          ← Go Back
        </button>
        <button
          onClick={() => navigate("/")}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
