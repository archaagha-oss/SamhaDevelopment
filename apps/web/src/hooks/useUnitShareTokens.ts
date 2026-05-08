import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

export interface UnitShareToken {
  id: string;
  token: string;
  url: string;
  showPrice: boolean;
  expiresAt: string | null;
  revokedAt: string | null;
  viewCount: number;
  lastViewedAt: string | null;
  createdAt: string;
}

export function useUnitShareTokens(unitId: string) {
  return useQuery({
    queryKey: ["unit", unitId, "share-tokens"],
    queryFn: async () => {
      const res = await axios.get(`/api/units/${unitId}/share-tokens`);
      return (res.data?.data ?? []) as UnitShareToken[];
    },
    enabled: !!unitId,
    staleTime: 30_000,
  });
}

export function useCreateUnitShareToken(unitId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { showPrice?: boolean; expiresAt?: string | null }) => {
      const res = await axios.post(`/api/units/${unitId}/share-tokens`, input);
      return res.data as UnitShareToken;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unit", unitId, "share-tokens"] });
    },
  });
}

export function useRevokeUnitShareToken(unitId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tokenId: string) => {
      const res = await axios.post(`/api/units/${unitId}/share-tokens/${tokenId}/revoke`);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unit", unitId, "share-tokens"] });
    },
  });
}

export function useDeleteUnitShareToken(unitId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tokenId: string) => {
      const res = await axios.delete(`/api/units/${unitId}/share-tokens/${tokenId}`);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unit", unitId, "share-tokens"] });
    },
  });
}
