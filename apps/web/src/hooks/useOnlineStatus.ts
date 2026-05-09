import { useEffect, useState } from "react";

/**
 * Subscribes to browser online/offline events and returns the current state.
 *
 * Note: navigator.onLine reports "have a network interface" not "internet
 * actually works" — the axios interceptor in lib/api.ts catches the
 * complementary case where the browser thinks it's online but a request
 * fails to reach the server.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return online;
}
