import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
export function useUnit(unitId) {
    return useQuery({
        queryKey: ['unit', unitId],
        queryFn: async () => {
            const res = await axios.get(`/api/units/${unitId}`);
            return res.data;
        },
        enabled: !!unitId,
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 30 * 60 * 1000, // 30 minutes
        retry: 2,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    });
}
export function useUnitHistory(unitId, page = 1) {
    return useQuery({
        queryKey: ['unit', unitId, 'history', page],
        queryFn: async () => {
            const res = await axios.get(`/api/units/${unitId}/history`, {
                params: { page, limit: 20 },
            });
            return res.data;
        },
        enabled: !!unitId,
        staleTime: 10 * 60 * 1000,
        gcTime: 60 * 60 * 1000,
    });
}
