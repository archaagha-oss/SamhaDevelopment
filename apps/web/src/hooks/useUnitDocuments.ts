import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export interface UnitDocument {
  id: string;
  name: string;
  type: string;
  mimeType: string;
  contractStatus: string;
  visibility: "INTERNAL" | "PUBLIC";
  expiryDate: string | null;
  uploadedAt: string;
  createdAt: string;
  dealId: string | null;
  projectId: string | null;
  scope: "DEAL" | "PROJECT";
}

export function useUnitDocuments(unitId: string) {
  return useQuery({
    queryKey: ["unit", unitId, "documents"],
    queryFn: async () => {
      const res = await axios.get(`/api/units/${unitId}/documents`);
      return (res.data?.data ?? []) as UnitDocument[];
    },
    enabled: !!unitId,
    staleTime: 60_000,
  });
}
