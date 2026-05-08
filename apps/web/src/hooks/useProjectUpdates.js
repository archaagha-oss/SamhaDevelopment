import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
export function useProjectUpdates(projectId) {
    return useQuery({
        queryKey: ["project", projectId, "updates"],
        queryFn: async () => {
            const res = await axios.get(`/api/projects/${projectId}/updates`);
            return (res.data?.data ?? []);
        },
        enabled: !!projectId,
        staleTime: 30000,
    });
}
export function useCreateProjectUpdate(projectId) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (input) => {
            const res = await axios.post(`/api/projects/${projectId}/updates`, input);
            return res.data;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["project", projectId, "updates"] });
        },
    });
}
export function useUpdateProjectUpdate(projectId) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (input) => {
            const { updateId, ...rest } = input;
            const res = await axios.patch(`/api/projects/${projectId}/updates/${updateId}`, rest);
            return res.data;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["project", projectId, "updates"] });
        },
    });
}
export function useDeleteProjectUpdate(projectId) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (updateId) => {
            const res = await axios.delete(`/api/projects/${projectId}/updates/${updateId}`);
            return res.data;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["project", projectId, "updates"] });
        },
    });
}
export function useUploadProjectUpdateMedia(projectId) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (input) => {
            const fd = new FormData();
            fd.append("file", input.file);
            if (input.caption)
                fd.append("caption", input.caption);
            const res = await axios.post(`/api/projects/${projectId}/updates/${input.updateId}/media`, fd, { headers: { "Content-Type": "multipart/form-data" } });
            return res.data;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["project", projectId, "updates"] });
        },
    });
}
export function useDeleteProjectUpdateMedia(projectId) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (input) => {
            const res = await axios.delete(`/api/projects/${projectId}/updates/${input.updateId}/media/${input.mediaId}`);
            return res.data;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["project", projectId, "updates"] });
        },
    });
}
