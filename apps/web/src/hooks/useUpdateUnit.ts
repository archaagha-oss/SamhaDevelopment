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

export interface ChangeStatusInput {
  newStatus: string;
  reason?: string;
}

export function useChangeStatus(unitId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ChangeStatusInput | string) => {
      const body = typeof input === 'string' ? { newStatus: input } : input;
      const res = await axios.patch(`/api/units/${unitId}/status`, body);
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

export function useDeleteUnit(unitId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await axios.delete(`/api/units/${unitId}`);
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['unit', unitId] });
      queryClient.invalidateQueries({ queryKey: ['units'] });
    },
    onError: (err: any) => {
      const apiError = classifyError(err);
      throw apiError;
    },
  });
}
