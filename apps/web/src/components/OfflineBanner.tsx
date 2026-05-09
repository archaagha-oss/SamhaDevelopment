import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

/**
 * Sticky banner shown along the top of the app whenever the browser
 * reports navigator.onLine === false. Stays out of the way otherwise.
 *
 * The matching axios response interceptor (see lib/api.ts) handles the
 * complementary case where the browser thinks it's online but requests
 * still fail (DNS, gateway, etc.).
 */
export default function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-warning text-warning-foreground text-xs font-medium px-4 py-2 flex items-center gap-2 justify-center"
    >
      <WifiOff className="size-3.5 shrink-0" aria-hidden="true" />
      You're offline. We'll keep your work and retry when the connection comes back.
    </div>
  );
}
