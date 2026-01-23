import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type VenueLayoutSummary = {
  id: string;
  venueId: string;
  eventId: string | null;
  name: string;
  version: number;
  isDefault: boolean;
  isTemplate: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  seatCount: number;
  zoneCount: number;
};

/**
 * Hook para obtener la lista de layouts de un venue
 */
export function useVenueLayouts(venueId?: string) {
  return useQuery({
    queryKey: ["venue-layouts", venueId],
    queryFn: () => {
      if (!venueId) throw new Error("venueId is required");
      return api.listVenueLayouts(venueId);
    },
    enabled: Boolean(venueId),
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Hook para crear un nuevo layout en un venue
 */
export function useCreateLayout(venueId?: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ name, copyFromLayoutId }: { name?: string; copyFromLayoutId?: string }) => {
      if (!venueId) throw new Error("venueId is required");
      return api.createVenueLayout(venueId, name, copyFromLayoutId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["venue-layouts", venueId] });
      queryClient.invalidateQueries({ queryKey: ["venue", venueId] });
    },
  });
}

/**
 * Hook para duplicar un layout existente
 */
export function useDuplicateLayout(venueId?: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ layoutId, newName }: { layoutId: string; newName?: string }) => {
      if (!venueId) throw new Error("venueId is required");
      return api.duplicateVenueLayout(venueId, layoutId, newName);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["venue-layouts", venueId] });
    },
  });
}

/**
 * Hook para establecer un layout como default
 */
export function useSetDefaultLayout(venueId?: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (layoutId: string) => {
      if (!venueId) throw new Error("venueId is required");
      return api.setDefaultLayout(venueId, layoutId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["venue-layouts", venueId] });
      queryClient.invalidateQueries({ queryKey: ["venue", venueId] });
    },
  });
}

/**
 * Hook para eliminar un layout
 */
export function useDeleteLayout(venueId?: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (layoutId: string) => {
      if (!venueId) throw new Error("venueId is required");
      return api.deleteVenueLayout(venueId, layoutId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["venue-layouts", venueId] });
    },
  });
}
