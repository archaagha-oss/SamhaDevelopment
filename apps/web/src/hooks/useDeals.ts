import { useQuery } from "@tanstack/react-query";
import axios from "axios";

interface DealsResponse {
  data: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export function useDeals(
  page: number = 1,
  limit: number = 50,
  stage?: string | null,
  search?: string
) {
  return useQuery<DealsResponse>({
    queryKey: ["deals", page, limit, stage, search],
    queryFn: async () => {
      const params: any = { page, limit };
      if (stage) params.stage = stage;
      if (search) params.search = search;
      const response = await axios.get("/api/deals", { params });
      return response.data;
    },
    staleTime: 1000 * 60 * 2,
  });
}

export function useDeal(dealId: string) {
  return useQuery({
    queryKey: ["deal", dealId],
    queryFn: async () => {
      const response = await axios.get(`/api/deals/${dealId}`);
      return response.data;
    },
    enabled: !!dealId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useDealPayments(dealId: string) {
  return useQuery({
    queryKey: ["payments", dealId],
    queryFn: async () => {
      const response = await axios.get(`/api/payments/deal/${dealId}`);
      return response.data;
    },
    enabled: !!dealId,
    staleTime: 1000 * 60 * 5,
  });
}
