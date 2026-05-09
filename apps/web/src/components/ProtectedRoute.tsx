import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { isClerkEnabled } from "../lib/auth";
import { Spinner } from "./ui/spinner";

/**
 * Gate for the authenticated app shell. Behaviour:
 *
 *  - When Clerk is NOT configured (no VITE_CLERK_PUBLISHABLE_KEY), this
 *    component is a no-op pass-through. Local development continues to work
 *    against the API's mock-auth fallback.
 *
 *  - When Clerk IS configured, we wait for the session to load, then either
 *    render `children` (signed in) or redirect to `/sign-in` with a
 *    `?next=...` hint so we can return the user to the page they wanted.
 */
export default function ProtectedRoute({ children }: { children: ReactNode }) {
  if (!isClerkEnabled()) return <>{children}</>;
  return <ClerkProtected>{children}</ClerkProtected>;
}

function ClerkProtected({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const location = useLocation();

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner size="lg" label="Loading session" />
      </div>
    );
  }

  if (!isSignedIn) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/sign-in?next=${next}`} replace />;
  }

  return <>{children}</>;
}
