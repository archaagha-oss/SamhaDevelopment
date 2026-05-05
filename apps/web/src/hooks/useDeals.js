import { useQuery } from "@tanstack/react-query";
import axios from "axios";
export function useDeals(page = 1, limit = 50, stage, search) {
    return useQuery({
        queryKey: ["deals", page, limit, stage, search],
        queryFn: async () => {
            const params = { page, limit };
            if (stage)
                params.stage = stage;
            if (search)
                params.search = search;
            const response = await axios.get("/api/deals", { params });
            return response.data;
        },
        staleTime: 1000 * 60 * 2,
    });
}
export function useDeal(dealId) {
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
export function useDealPayments(dealId) {
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
