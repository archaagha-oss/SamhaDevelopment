import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
export function useAgents() {
    return useQuery({
        queryKey: ['agents'],
        queryFn: async () => {
            const res = await axios.get('/api/users');
            return (res.data || []).filter((u) => u.role === 'SALES_AGENT' || u.role === 'OPERATIONS');
        },
        staleTime: 30 * 60 * 1000, // 30 minutes
        gcTime: 2 * 60 * 60 * 1000, // 2 hours
        retry: 2,
    });
}
