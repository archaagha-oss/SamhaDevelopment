import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Unit } from '../types';
import { classifyError } from '../types/errors';

export function useUpdateUnit(unitId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<Unit>) => {
      const res = await axios.patch(`/api/units/${unitId}`, updates);
      return res.data as Unit;
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
    onError: (err: any) => {
      const apiError = classifyError(err);
      throw apiError;
    },
  });
}

export function useChangeStatus(unitId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newStatus: string) => {
      const res = await axios.patch(`/api/units/${unitId}/status`, { newStatus });
      return res.data as Unit;
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
    onError: (err: any) => {
      const apiError = classifyError(err);
      throw apiError;
    },
  });
}
