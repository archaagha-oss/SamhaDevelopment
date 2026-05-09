import { useEffect } from "react";
import { useAuth, useClerk } from "@clerk/clerk-react";
import { useQueryClient } from "@tanstack/react-query";
import { setSessionTokenGetter } from "../lib/auth";

/**
 * Two responsibilities, one mount point inside <ClerkProvider>:
 *
 *  1. Hand axios a getter for the current Clerk session JWT, so every API
 *     call carries `Authorization: Bearer <jwt>`.
 *  2. Clear the React Query cache when the user signs out, so the next user
 *     in the same browser tab can never see the previous user's leads /
 *     deals / payment data.
 *
 * Render this once, immediately under <ClerkProvider>. It renders nothing.
 */
export default function AuthSync() {
  const { isSignedIn, getToken } = useAuth();
  const { addListener } = useClerk();
  const queryClient = useQueryClient();

  // Keep the axios interceptor's token getter pointed at the current session.
  useEffect(() => {
    setSessionTokenGetter(() => getToken({ skipCache: false }));
    return () => setSessionTokenGetter(null);
  }, [getToken]);

  // When the active session disappears, drop every cached query — otherwise
  // a fresh sign-in would briefly render the previous user's data.
  useEffect(() => {
    if (!addListener) return;
    const unsub = addListener(({ session }) => {
      if (!session) queryClient.clear();
    });
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [addListener, queryClient]);

  // Belt-and-braces — also clear the cache the moment isSignedIn flips false.
  useEffect(() => {
    if (isSignedIn === false) queryClient.clear();
  }, [isSignedIn, queryClient]);

  return null;
}
