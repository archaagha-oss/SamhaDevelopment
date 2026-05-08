import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { classifyError } from '../types/errors';
export function useUpdateUnit(unitId) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (updates) => {
            const res = await axios.patch(`/api/units/${unitId}`, updates);
            return res.data;
        },
        onSuccess: (updatedUnit) => {
            queryClient.setQueryData(['unit', unitId], updatedUnit);
            queryClient.invalidateQueries({
                queryKey: ['unit', unitId, 'history'],
            });
            // Invalidate units lists across all projects so they refresh
            queryClient.invalidateQueries({
                queryKey: ['units'],
            });
        },
        onError: (err) => {
            const apiError = classifyError(err);
            throw apiError;
        },
    });
}
export function useChangeStatus(unitId) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input) => {
            const body = typeof input === 'string' ? { newStatus: input } : input;
            const res = await axios.patch(`/api/units/${unitId}/status`, body);
            return res.data;
        },
        onSuccess: (updatedUnit) => {
            queryClient.setQueryData(['unit', unitId], updatedUnit);
            queryClient.invalidateQueries({
                queryKey: ['unit', unitId, 'history'],
            });
            // Invalidate units lists across all projects so they refresh
            queryClient.invalidateQueries({
                queryKey: ['units'],
            });
        },
        onError: (err) => {
            const apiError = classifyError(err);
            throw apiError;
        },
    });
}
export function useDeleteUnit(unitId) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            await axios.delete(`/api/units/${unitId}`);
        },
        onSuccess: () => {
            queryClient.removeQueries({ queryKey: ['unit', unitId] });
            queryClient.invalidateQueries({ queryKey: ['units'] });
        },
        onError: (err) => {
            const apiError = classifyError(err);
            throw apiError;
        },
    });
}
