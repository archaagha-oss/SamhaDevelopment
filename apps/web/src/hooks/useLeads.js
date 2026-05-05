import { useQuery } from "@tanstack/react-query";
import axios from "axios";
export function useLeads(page = 1, limit = 50, stage) {
    return useQuery({
        queryKey: ["leads", page, limit, stage],
        queryFn: async () => {
            const params = { page, limit };
            if (stage)
                params.stage = stage;
            const response = await axios.get("/api/leads", { params });
            return response.data;
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}
export function useLead(leadId) {
    return useQuery({
        queryKey: ["lead", leadId],
        queryFn: async () => {
            const response = await axios.get(`/api/leads/${leadId}`);
            return response.data;
        },
        enabled: !!leadId,
        staleTime: 1000 * 60 * 5,
    });
}
export function useLeadActivities(leadId) {
    return useQuery({
        queryKey: ["activities", leadId],
        queryFn: async () => {
            const response = await axios.get(`/api/leads/${leadId}/activities`);
            return response.data;
        },
        enabled: !!leadId,
        staleTime: 1000 * 60 * 2, // 2 minutes for activities (more frequent updates)
    });
}
