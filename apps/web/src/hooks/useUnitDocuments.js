import { useQuery } from "@tanstack/react-query";
import axios from "axios";
export function useUnitDocuments(unitId) {
    return useQuery({
        queryKey: ["unit", unitId, "documents"],
        queryFn: async () => {
            const res = await axios.get(`/api/units/${unitId}/documents`);
            return (res.data?.data ?? []);
        },
        enabled: !!unitId,
        staleTime: 60000,
    });
}
