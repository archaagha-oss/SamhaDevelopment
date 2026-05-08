/**
 * Single source of truth for the current user's ID.
 *
 * TODO: replace with Clerk's useUser() once auth is wired. Until then, this
 * matches the API's mock auth (req.auth.userId = "dev-user-1") and avoids
 * sprinkling that string across the codebase.
 */
export const CURRENT_USER_ID =
  import.meta.env.VITE_DEV_USER_ID ?? "dev-user-1";

export function useCurrentUser() {
  return {
    id: CURRENT_USER_ID,
    firstName: "Dev",
    fullName: "Dev User",
    email: "dev@samha.local",
  };
}
