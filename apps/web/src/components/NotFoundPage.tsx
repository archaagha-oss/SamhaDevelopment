import { useNavigate } from "react-router-dom";
import { Home, ArrowLeft, Search } from "lucide-react";
import { Button } from "./ui/Button";

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[70vh] px-6 text-center">
      <div className="w-20 h-20 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 mb-6">
        <Search className="h-9 w-9" />
      </div>

      <h1 className="text-white text-3xl font-semibold mb-2 tracking-tight">404 — Page not found</h1>
      <p className="text-slate-400 text-sm mb-8 max-w-sm leading-relaxed">
        The page you're looking for doesn't exist or may have been moved. Head back to the dashboard to continue.
      </p>

      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => navigate(-1)} leadingIcon={<ArrowLeft className="h-4 w-4" />}>
          Go back
        </Button>
        <Button onClick={() => navigate("/")} leadingIcon={<Home className="h-4 w-4" />}>
          Dashboard
        </Button>
      </div>
    </div>
  );
}
