import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
export function useProjectDocuments(projectId, visibility) {
    return useQuery({
        queryKey: ["project", projectId, "documents", visibility ?? "all"],
        queryFn: async () => {
            const res = await axios.get(`/api/projects/${projectId}/documents`, {
                params: visibility ? { visibility } : undefined,
            });
            return (res.data?.data ?? []);
        },
        enabled: !!projectId,
        staleTime: 60000,
    });
}
export function useUploadProjectDocument(projectId) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (input) => {
            const fd = new FormData();
            fd.append("file", input.file);
            if (input.name)
                fd.append("name", input.name);
            if (input.type)
                fd.append("type", input.type);
            if (input.visibility)
                fd.append("visibility", input.visibility);
            const res = await axios.post(`/api/projects/${projectId}/documents/upload`, fd, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            return res.data;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["project", projectId, "documents"] });
        },
    });
}
export function useUpdateProjectDocument(projectId) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (input) => {
            const { docId, ...rest } = input;
            const res = await axios.patch(`/api/projects/${projectId}/documents/${docId}`, rest);
            return res.data;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["project", projectId, "documents"] });
        },
    });
}
export function useDeleteProjectDocument(projectId) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (docId) => {
            const res = await axios.delete(`/api/projects/${projectId}/documents/${docId}`);
            return res.data;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["project", projectId, "documents"] });
        },
    });
}
