import { useQuery } from "@tanstack/react-query";
import axios from "axios";
export function useProjectStatusHistory(projectId, limit = 50) {
    return useQuery({
        queryKey: ["project", projectId, "status-history", limit],
        queryFn: async () => {
            const res = await axios.get(`/api/projects/${projectId}/status-history`, {
                params: { limit },
            });
            return (res.data?.data ?? []);
        },
        enabled: !!projectId,
        staleTime: 60000,
    });
}
