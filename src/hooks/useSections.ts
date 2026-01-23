import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

// Storage key matching AuthContext
const AUTH_STORAGE_KEY = "boletera.auth";

// Helper to get auth token from localStorage
function getAuthToken(): string | null {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return null;
    const data = JSON.parse(stored);
    return data?.token ?? null;
  } catch {
    return null;
  }
}

// Generic fetch wrapper
async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> ?? {}),
  };
  
  const token = getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  if (options.body && typeof options.body === 'string') {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Error inesperado" }));
    throw new Error(error.message || "Request failed");
  }

  return response.json() as Promise<T>;
}

// Types for sections API
export interface LayoutSection {
  id: string;
  name: string;
  description?: string;
  color: string;
  polygonPoints: Array<{ x: number; y: number }>;
  labelPosition?: { x: number; y: number };
  displayOrder: number;
  hoverColor: string;
  selectedColor: string;
  thumbnailUrl?: string;
  zone?: {
    id: string;
    name: string;
    color: string;
  } | null;
  pricing: {
    price: number;
    fee: number;
    total: number;
  };
  stats: {
    total: number;
    available: number;
    sold: number;
    reserved: number;
  };
  childLayoutId?: string | null;
  metadata?: Record<string, any>;
}

export interface SectionsResponse {
  sessionId: string;
  layoutId: string;
  layoutType: "flat" | "parent";
  canvas: { width: number; height: number };
  sections: LayoutSection[];
  stats: {
    totalSections: number;
    totalSeats: number;
    availableSeats: number;
    soldSeats: number;
  };
}

export interface SectionDetailResponse {
  sessionId: string;
  section: {
    id: string;
    name: string;
    description?: string;
    color: string;
    polygonPoints: Array<{ x: number; y: number }>;
    labelPosition?: { x: number; y: number };
    zone?: {
      id: string;
      name: string;
      color: string;
    } | null;
  };
  layout: {
    id: string;
    name: string;
    canvas: { width: number; height: number };
  };
  seats: Array<{
    id: string;
    zoneId: string | null;
    zoneName?: string;
    zoneColor?: string;
    label: string;
    rowLabel: string | null;
    columnNumber: number | null;
    available: boolean;
    status: "available" | "sold" | "reserved";
    price: number;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
  }>;
  stats: {
    total: number;
    available: number;
    sold: number;
    reserved: number;
  };
}

// Hook for fetching sections for an event session
export function useEventSections(eventId: string, sessionId: string) {
  return useQuery<SectionsResponse>({
    queryKey: ["event-sections", eventId, sessionId],
    queryFn: () => apiFetch(`/api/events/${eventId}/sessions/${sessionId}/sections`),
    enabled: !!eventId && !!sessionId,
    staleTime: 10000, // 10 seconds
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

// Hook for fetching specific section detail with seats
export function useSectionDetail(eventId: string, sessionId: string, sectionId: string | null) {
  return useQuery<SectionDetailResponse>({
    queryKey: ["section-detail", eventId, sessionId, sectionId],
    queryFn: () => apiFetch(`/api/events/${eventId}/sessions/${sessionId}/sections/${sectionId}`),
    enabled: !!eventId && !!sessionId && !!sectionId,
    staleTime: 5000, // 5 seconds
    refetchInterval: 15000, // Refresh every 15 seconds when viewing seats
  });
}

// Admin hooks for managing sections in layouts

export interface CreateSectionData {
  name: string;
  description?: string;
  zoneId?: string;
  color: string;
  polygonPoints: Array<{ x: number; y: number }>;
  labelPosition?: { x: number; y: number };
  capacity?: number;
  displayOrder?: number;
  hoverColor?: string;
  selectedColor?: string;
  thumbnailUrl?: string;
  metadata?: Record<string, any>;
}

// Hook for creating a section in a layout
export function useCreateSection(layoutId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSectionData) =>
      apiFetch(`/api/layouts/${layoutId}/sections`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["layout-sections", layoutId] });
      queryClient.invalidateQueries({ queryKey: ["layout-hierarchy", layoutId] });
    },
  });
}

// Hook for updating a section
export function useUpdateSection(layoutId: string, sectionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<CreateSectionData>) =>
      apiFetch(`/api/layouts/${layoutId}/sections/${sectionId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["layout-sections", layoutId] });
      queryClient.invalidateQueries({ queryKey: ["layout-hierarchy", layoutId] });
    },
  });
}

// Hook for deleting a section
export function useDeleteSection(layoutId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sectionId: string) =>
      apiFetch(`/api/layouts/${layoutId}/sections/${sectionId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["layout-sections", layoutId] });
      queryClient.invalidateQueries({ queryKey: ["layout-hierarchy", layoutId] });
    },
  });
}

// Hook for getting sections in a layout (admin)
export function useLayoutSections(layoutId: string | null) {
  return useQuery({
    queryKey: ["layout-sections", layoutId],
    queryFn: () => apiFetch(`/api/layouts/${layoutId}/sections`),
    enabled: !!layoutId,
  });
}

// Hook for getting full layout hierarchy
export function useLayoutHierarchy(layoutId: string | null) {
  return useQuery({
    queryKey: ["layout-hierarchy", layoutId],
    queryFn: () => apiFetch(`/api/layouts/${layoutId}/hierarchy`),
    enabled: !!layoutId,
  });
}

// Hook for creating child layout for a section
export function useCreateChildLayout(layoutId: string, sectionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name?: string; layoutJson?: any; metadata?: any }) =>
      apiFetch(`/api/layouts/${layoutId}/sections/${sectionId}/child-layout`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["layout-sections", layoutId] });
      queryClient.invalidateQueries({ queryKey: ["layout-hierarchy", layoutId] });
    },
  });
}

// Hook for bulk creating sections
export function useBulkCreateSections(layoutId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sections: CreateSectionData[]) =>
      apiFetch(`/api/layouts/${layoutId}/sections/bulk`, {
        method: "POST",
        body: JSON.stringify({ sections }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["layout-sections", layoutId] });
      queryClient.invalidateQueries({ queryKey: ["layout-hierarchy", layoutId] });
    },
  });
}

// Hook for reordering sections
export function useReorderSections(layoutId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sectionIds: string[]) =>
      apiFetch(`/api/layouts/${layoutId}/sections/reorder`, {
        method: "PUT",
        body: JSON.stringify({ sectionIds }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["layout-sections", layoutId] });
    },
  });
}
