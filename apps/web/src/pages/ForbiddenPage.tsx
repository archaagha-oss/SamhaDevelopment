import { useNavigate } from "react-router-dom";
import { ShieldOff, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * 403 landing page. Reached when:
 *   - the axios response interceptor (lib/api.ts) catches a 403 and redirects
 *   - a user opens a deep link to a route their role can't access
 *
 * We don't try to deep-link "back" — historyback can re-trigger the 403 in a
 * loop. Just offer the dashboard and a way to switch accounts.
 */
export default function ForbiddenPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center bg-background">
      <div className="w-24 h-24 rounded-3xl bg-destructive-soft border border-destructive/30 text-destructive flex items-center justify-center mb-8">
        <ShieldOff className="size-10" aria-hidden="true" />
      </div>

      <h1 className="text-foreground text-3xl font-semibold mb-3 tracking-tight">
        Access denied
      </h1>

      <p className="text-muted-foreground text-sm mb-2 max-w-sm leading-relaxed">
        Your account doesn't have permission to view this page.
      </p>
      <p className="text-muted-foreground text-xs mb-10 max-w-sm leading-relaxed">
        If you believe this is a mistake, ask an administrator to update your
        role.
      </p>

      <div className="flex items-center gap-3 flex-wrap justify-center">
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
