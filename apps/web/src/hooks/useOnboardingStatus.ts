import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export interface OnboardingStatus {
  hasProject: boolean;
  hasUnit: boolean;
  hasPaymentPlan: boolean;
  hasLead: boolean;
  hasTeam: boolean;
}

/**
 * Pulls the onboarding checklist status. Used by the dashboard to render
 * the first-visit setup checklist.
 *
 * staleTime is intentionally 0: each flag flips one-way (false → true),
 * the endpoint is cheap (5 parallel `findFirst({ select:{id:true} })`),
 * and the natural usage pattern is "user clicks a CTA → completes a step
 * on the destination page → returns to /dashboard". We want them to see
 * the checked-off step immediately on return, not in 5 minutes' time.
 * react-query still de-duplicates concurrent fetches, so multiple
 * <OnboardingChecklist> mounts in the same render don't multiply traffic.
 */
export function useOnboardingStatus() {
  return useQuery<OnboardingStatus, Error>({
    queryKey: ["onboarding", "status"],
    queryFn: async () => {
      const res = await axios.get<OnboardingStatus>("/api/onboarding/status");
      return res.data;
    },
    staleTime: 0,
    gcTime: 5 * 60_000,
    retry: (failureCount, err: any) => {
      const status = err?.response?.status;
      if (status === 401 || status === 403 || status === 404) return false;
      return failureCount < 1;
    },
  });
}
