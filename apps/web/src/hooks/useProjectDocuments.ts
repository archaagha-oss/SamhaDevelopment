import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

export type DocumentVisibility = "INTERNAL" | "PUBLIC";

export interface ProjectDocument {
  id: string;
  name: string;
  type: string;
  mimeType: string;
  visibility: DocumentVisibility;
  contractStatus: string;
  expiryDate: string | null;
  uploadedAt: string;
  createdAt: string;
}

export function useProjectDocuments(projectId: string, visibility?: DocumentVisibility) {
  return useQuery({
    queryKey: ["project", projectId, "documents", visibility ?? "all"],
    queryFn: async () => {
      const res = await axios.get(`/api/projects/${projectId}/documents`, {
        params: visibility ? { visibility } : undefined,
      });
      return (res.data?.data ?? []) as ProjectDocument[];
    },
    enabled: !!projectId,
    staleTime: 60_000,
  });
}

export function useUploadProjectDocument(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      file: File;
      name?: string;
      type?: string;
      visibility?: DocumentVisibility;
    }) => {
      const fd = new FormData();
      fd.append("file", input.file);
      if (input.name) fd.append("name", input.name);
      if (input.type) fd.append("type", input.type);
      if (input.visibility) fd.append("visibility", input.visibility);
      const res = await axios.post(`/api/projects/${projectId}/documents/upload`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data as ProjectDocument;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId, "documents"] });
    },
  });
}

export function useUpdateProjectDocument(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { docId: string; visibility?: DocumentVisibility; name?: string }) => {
      const { docId, ...rest } = input;
      const res = await axios.patch(`/api/projects/${projectId}/documents/${docId}`, rest);
      return res.data as ProjectDocument;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId, "documents"] });
    },
  });
}

export function useDeleteProjectDocument(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (docId: string) => {
      const res = await axios.delete(`/api/projects/${projectId}/documents/${docId}`);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId, "documents"] });
    },
  });
}
