import { useQuery } from "@tanstack/react-query";
import axios from "axios";

interface LeadsResponse {
  data: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export function useLeads(
  page: number = 1,
  limit: number = 50,
  stage?: string | null
) {
  return useQuery<LeadsResponse>({
    queryKey: ["leads", page, limit, stage],
    queryFn: async () => {
      const params: any = { page, limit };
      if (stage) params.stage = stage;
      const response = await axios.get("/api/leads", { params });
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useLead(leadId: string) {
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

export function useLeadActivities(leadId: string) {
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
