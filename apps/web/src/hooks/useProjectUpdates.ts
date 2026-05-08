import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

export interface ProjectUpdateMedia {
  id: string;
  type: "PHOTO" | "VIDEO";
  url: string;
  storage: string;
  caption: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface ProjectUpdate {
  id: string;
  projectId: string;
  title: string;
  body: string;
  isPublic: boolean;
  publishedAt: string;
  createdBy: string;
  media: ProjectUpdateMedia[];
  createdAt: string;
  updatedAt: string;
}

export function useProjectUpdates(projectId: string) {
  return useQuery({
    queryKey: ["project", projectId, "updates"],
    queryFn: async () => {
      const res = await axios.get(`/api/projects/${projectId}/updates`);
      return (res.data?.data ?? []) as ProjectUpdate[];
    },
    enabled: !!projectId,
    staleTime: 30_000,
  });
}

export function useCreateProjectUpdate(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; body: string; isPublic?: boolean }) => {
      const res = await axios.post(`/api/projects/${projectId}/updates`, input);
      return res.data as ProjectUpdate;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId, "updates"] });
    },
  });
}

export function useUpdateProjectUpdate(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { updateId: string; title?: string; body?: string; isPublic?: boolean }) => {
      const { updateId, ...rest } = input;
      const res = await axios.patch(`/api/projects/${projectId}/updates/${updateId}`, rest);
      return res.data as ProjectUpdate;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId, "updates"] });
    },
  });
}

export function useDeleteProjectUpdate(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updateId: string) => {
      const res = await axios.delete(`/api/projects/${projectId}/updates/${updateId}`);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId, "updates"] });
    },
  });
}

export function useUploadProjectUpdateMedia(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { updateId: string; file: File; caption?: string }) => {
      const fd = new FormData();
      fd.append("file", input.file);
      if (input.caption) fd.append("caption", input.caption);
      const res = await axios.post(
        `/api/projects/${projectId}/updates/${input.updateId}/media`,
        fd,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      return res.data as ProjectUpdateMedia;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId, "updates"] });
    },
  });
}

export function useDeleteProjectUpdateMedia(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { updateId: string; mediaId: string }) => {
      const res = await axios.delete(
        `/api/projects/${projectId}/updates/${input.updateId}/media/${input.mediaId}`
      );
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId, "updates"] });
    },
  });
}
