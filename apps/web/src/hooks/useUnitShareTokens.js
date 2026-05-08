import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
export function useUnitShareTokens(unitId) {
    return useQuery({
        queryKey: ["unit", unitId, "share-tokens"],
        queryFn: async () => {
            const res = await axios.get(`/api/units/${unitId}/share-tokens`);
            return (res.data?.data ?? []);
        },
        enabled: !!unitId,
        staleTime: 30000,
    });
}
export function useCreateUnitShareToken(unitId) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (input) => {
            const res = await axios.post(`/api/units/${unitId}/share-tokens`, input);
            return res.data;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["unit", unitId, "share-tokens"] });
        },
    });
}
export function useRevokeUnitShareToken(unitId) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (tokenId) => {
            const res = await axios.post(`/api/units/${unitId}/share-tokens/${tokenId}/revoke`);
            return res.data;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["unit", unitId, "share-tokens"] });
        },
    });
}
export function useDeleteUnitShareToken(unitId) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (tokenId) => {
            const res = await axios.delete(`/api/units/${unitId}/share-tokens/${tokenId}`);
            return res.data;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["unit", unitId, "share-tokens"] });
        },
    });
}
