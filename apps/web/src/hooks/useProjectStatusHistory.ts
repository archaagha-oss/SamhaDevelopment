import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export interface ProjectStatusHistoryEntry {
  id: string;
  projectId: string;
  field: string;
  oldValue: string | null;
  newValue: string;
  oldProjectStatus: string | null;
  newProjectStatus: string | null;
  oldCompletionStatus: string | null;
  newCompletionStatus: string | null;
  oldHandoverDate: string | null;
  newHandoverDate: string | null;
  changedBy: string;
  reason: string | null;
  changedAt: string;
}

export function useProjectStatusHistory(projectId: string, limit: number = 50) {
  return useQuery({
    queryKey: ["project", projectId, "status-history", limit],
    queryFn: async () => {
      const res = await axios.get(`/api/projects/${projectId}/status-history`, {
        params: { limit },
      });
      return (res.data?.data ?? []) as ProjectStatusHistoryEntry[];
    },
    enabled: !!projectId,
    staleTime: 60_000,
  });
}
