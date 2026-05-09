import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export interface CurrentUser {
  id: string;
  clerkId?: string | null;
  name: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "MEMBER" | "VIEWER";
  status: string;
  jobTitle?: string | null;
  avatarUrl?: string | null;
  employeeId?: string | null;
}

/**
 * Source of truth for the signed-in user's identity and role.
 *
 * Pulls `GET /api/users/me`. The role here is what every navigation /
 * permission check should consult — never read `localStorage.getItem("samha:role")`,
 * which the user can edit in DevTools to grant themselves admin nav links
 * (the API still enforces server-side, but the leaky UI is misleading).
 *
 * Long staleTime + no retries on 401/403 — the axios interceptor already
 * handles those by redirecting.
 */
export function useCurrentUser() {
  return useQuery<CurrentUser, Error>({
    queryKey: ["users", "me"],
    queryFn: async () => {
      const res = await axios.get<CurrentUser>("/api/users/me");
      return res.data;
    },
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: (failureCount, err: any) => {
      const status = err?.response?.status;
      if (status === 401 || status === 403 || status === 404) return false;
      return failureCount < 2;
    },
  });
}
