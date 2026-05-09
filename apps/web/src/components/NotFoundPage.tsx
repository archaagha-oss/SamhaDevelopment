import { useNavigate } from "react-router-dom";
import { ArrowLeft, MapPinOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[70vh] px-6 text-center">
      <div className="w-24 h-24 rounded-3xl bg-muted border border-border flex items-center justify-center mb-8 text-muted-foreground">
        <MapPinOff className="size-10" aria-hidden="true" />
      </div>

      <h1 className="text-foreground text-3xl font-semibold mb-3 tracking-tight">
        404 — Page Not Found
      </h1>

      <p className="text-muted-foreground text-sm mb-10 max-w-sm leading-relaxed">
        The page you're looking for doesn't exist or may have been moved.
        Head back to the dashboard to continue.
      </p>

      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Go back
        </Button>
        <Button type="button" onClick={() => navigate("/")}>
          Back to dashboard
        </Button>
      </div>
    </div>
  );
}
