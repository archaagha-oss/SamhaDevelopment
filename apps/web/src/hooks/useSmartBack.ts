import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// Back-button helper that respects where the user came from.
//
// Detail pages used to hardcode their back destination (e.g. UnitDetailPage
// always returned to /projects/:projectId). That stranded users who arrived
// via a different path — clicking a unit in the cross-project /units list
// and hitting back would dump them on the project instead of back where they
// came from. With this hook the back button uses the in-app navigation
// history when there is one (`location.key !== "default"`) and falls back to
// the supplied path only when the URL was opened directly (refresh, bookmark,
// share-link).
//
// Why `location.key !== "default"`: React Router stamps the very first
// navigation in a session with the literal key "default"; any in-app
// navigation (link click, programmatic navigate) produces a unique key. So
// `key !== "default"` is the reliable test for "there's something to go back
// to within this app".

export function useSmartBack(fallback: string): () => void {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(() => {
    if (location.key !== "default") {
      navigate(-1);
      return;
    }
    navigate(fallback);
  }, [navigate, location.key, fallback]);
}
