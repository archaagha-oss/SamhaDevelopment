import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export type Role = "ADMIN" | "MANAGER" | "MEMBER" | "VIEWER";

export interface CurrentUser {
  id: string;
  clerkId: string;
  name: string;
  email: string;
  role: Role;
  status: "ACTIVE" | "ON_LEAVE" | "SUSPENDED" | "DEACTIVATED";
  jobTitle: string | null;
  avatarUrl: string | null;
  phone: string | null;
  managerId: string | null;
}

/**
 * Source of truth for the calling user — including their role.
 *
 * Replaces `localStorage.getItem("samha:role")`, which was easy to spoof in
 * dev tools and got out of sync with the server. Cached for 5 minutes; the
 * API enforces the role on every protected request, so a stale UI hint can
 * never bypass authorization.
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: ["currentUser"],
    queryFn: async (): Promise<CurrentUser> => {
      const res = await axios.get("/api/users/me");
      return res.data;
    },
    staleTime: 5 * 60 * 1000, // 5 min
    gcTime:    30 * 60 * 1000,
    retry: 1,
  });
}

/**
 * Convenience: returns the role string or null while loading. Use this for
 * sidebar / nav visibility decisions where you don't want a flicker.
 */
export function useCurrentRole(): Role | null {
  const { data } = useCurrentUser();
  return data?.role ?? null;
}
