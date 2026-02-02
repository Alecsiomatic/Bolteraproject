import type {
  Category,
  CreateCategoryPayload,
  CreateEventPayload,
  CreateVenuePayload,
  CreateVenueResponse,
  EventSummary,
  SaveVenueLayoutPayload,
  VenueDetail,
  VenueLayoutDetail,
  VenueSummary,
} from "@/types/api";
import type {
  VenueLayoutVersion,
  VenueTableDetail,
  LayoutVersionConflict,
} from "@/types/venue-extended";
import { API_BASE_URL } from "@/lib/api-base";

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

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> ?? {}),
  };
  
  // Add auth token if available
  const token = getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  // Only set Content-Type for requests with body
  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 409) {
      const conflict = await response.json() as LayoutVersionConflict;
      throw { status: 409, ...conflict };
    }
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = { message: "Error inesperado" };
    }
    throw { status: response.status, message: errorData.message || "No se pudo completar la solicitud", ...errorData };
  }

  return response.json() as Promise<T>;
}

// Upload helper function
async function uploadFile(folder: string, file: File): Promise<{ url: string; filename: string }> {
  const formData = new FormData();
  formData.append("file", file);
  
  const response = await fetch(`${API_BASE_URL}/api/upload/${folder}`, {
    method: "POST",
    body: formData,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Upload failed" }));
    throw new Error(error.error || "Upload failed");
  }
  
  return response.json();
}

export const api = {
  // Categories
  listCategories: (active?: boolean) => 
    apiFetch<Category[]>(`/api/categories${active !== undefined ? `?active=${active}` : ''}`),
  getCategory: (idOrSlug: string) => 
    apiFetch<Category & { events: Array<{ id: string; name: string; slug: string; thumbnailImage: string | null }> }>(`/api/categories/${idOrSlug}`),
  createCategory: (payload: CreateCategoryPayload) =>
    apiFetch<Category>("/api/categories", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateCategory: (id: string, payload: Partial<CreateCategoryPayload>) =>
    apiFetch<Category>(`/api/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteCategory: (id: string) =>
    apiFetch<{ success: boolean; message: string }>(`/api/categories/${id}`, {
      method: "DELETE",
    }),
  reorderCategories: (order: Array<{ id: string; sortOrder: number }>) =>
    apiFetch<{ success: boolean }>("/api/categories/reorder", {
      method: "POST",
      body: JSON.stringify({ order }),
    }),

  // Upload
  uploadImage: (folder: "events" | "venues" | "categories" | "users" | "misc", file: File) =>
    uploadFile(folder, file),

  // Venues & Events
  listVenues: () => apiFetch<VenueSummary[]>("/api/venues"),
  listEvents: async (options?: { all?: boolean }) => {
    const params = options?.all ? "?all=true" : "";
    const response = await apiFetch<{ events: EventSummary[]; total: number }>(`/api/events${params}`);
    return response.events;
  },
  getEvent: (eventId: string) => apiFetch<any>(`/api/events/${eventId}`),
  getEventLayout: (eventId: string) => apiFetch<any>(`/api/events/${eventId}/layout`),
  getVenue: (id: string) => apiFetch<VenueDetail>(`/api/venues/${id}`),
  getVenueLayout: (venueId: string, layoutId: string) =>
    apiFetch<VenueLayoutDetail>(`/api/venues/${venueId}/layouts/${layoutId}`),
  createEvent: (payload: CreateEventPayload) =>
    apiFetch<{ id: string; slug: string }>("/api/events", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  deleteEvent: (eventId: string) =>
    apiFetch<{ message: string; eventId: string }>(`/api/events/${eventId}`, {
      method: "DELETE",
    }),
  
  // Session CRUD
  getEventSessions: (eventId: string) =>
    apiFetch<any[]>(`/api/events/${eventId}/sessions`),
  createSession: (eventId: string, payload: {
    title?: string;
    startsAt: string;
    endsAt?: string;
    status?: string;
    capacity?: number;
  }) =>
    apiFetch<any>(`/api/events/${eventId}/sessions`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateSession: (eventId: string, sessionId: string, payload: {
    title?: string;
    startsAt?: string;
    endsAt?: string;
    status?: string;
    capacity?: number;
  }) =>
    apiFetch<any>(`/api/events/${eventId}/sessions/${sessionId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteSession: (eventId: string, sessionId: string) =>
    apiFetch<any>(`/api/events/${eventId}/sessions/${sessionId}`, {
      method: "DELETE",
    }),
  
  updateEventPriceTiers: (
    eventId: string,
    payload: {
      tiers: Array<{
        zoneId?: string;
        seatType?: string;
        label: string;
        price: number;
        fee?: number;
        currency?: string;
      }>;
    }
  ) =>
    apiFetch<{ message: string; count: number }>(`/api/events/${eventId}/price-tiers`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  createVenue: (payload: CreateVenuePayload) =>
    apiFetch<CreateVenueResponse>("/api/venues", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  deleteVenue: (venueId: string) =>
    apiFetch<{ success: boolean; message: string }>(`/api/venues/${venueId}`, {
      method: "DELETE",
    }),
  
  // ============================================
  // VENUE LAYOUTS - Multiple layouts per venue
  // ============================================
  
  /** List all layouts for a venue */
  listVenueLayouts: (venueId: string) =>
    apiFetch<Array<{
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
    }>>(`/api/venues/${venueId}/layouts`),
  
  /** Create a new layout for an existing venue */
  createLayout: (venueId: string, name?: string) =>
    apiFetch<{ layoutId: string; venueId: string; name: string; version: number }>(
      `/api/venues/${venueId}/layouts`,
      {
        method: "POST",
        body: JSON.stringify({ name, isDefault: true }),
      },
    ),
  
  /** Create a new layout (optionally copying from existing) */
  createVenueLayout: (venueId: string, name?: string, copyFromLayoutId?: string) =>
    apiFetch<{ layoutId: string; venueId: string; name: string; version: number }>(
      `/api/venues/${venueId}/layouts`,
      {
        method: "POST",
        body: JSON.stringify({ name, copyFromLayoutId }),
      },
    ),
  
  /** Duplicate an existing layout */
  duplicateVenueLayout: (venueId: string, layoutId: string, newName?: string) =>
    apiFetch<{ layoutId: string; venueId: string; name: string; version: number }>(
      `/api/venues/${venueId}/layouts/${layoutId}/duplicate`,
      {
        method: "POST",
        body: JSON.stringify({ name: newName }),
      },
    ),
  
  /** Set a layout as default for the venue */
  setDefaultLayout: (venueId: string, layoutId: string) =>
    apiFetch<{ success: boolean; message: string }>(
      `/api/venues/${venueId}/layouts/${layoutId}/set-default`,
      { method: "POST" },
    ),
  
  /** Delete a layout (cannot delete if it's the only one or has associated events) */
  deleteVenueLayout: (venueId: string, layoutId: string) =>
    apiFetch<{ success: boolean; message: string }>(
      `/api/venues/${venueId}/layouts/${layoutId}`,
      { method: "DELETE" },
    ),
  
  saveVenueLayout: (venueId: string, payload: SaveVenueLayoutPayload, version?: number, forceOverwrite?: boolean) =>
    apiFetch<{ success: boolean; version: number }>(`/api/venues/${venueId}/layout`, {
      method: "PUT",
      headers: {
        ...(version !== undefined ? { "If-Match": version.toString() } : {}),
        ...(forceOverwrite ? { "X-Force-Overwrite": "true" } : {}),
      },
      body: JSON.stringify(payload),
    }),
  getLayoutHistory: (venueId: string, layoutId: string) =>
    apiFetch<VenueLayoutVersion[]>(`/api/venues/${venueId}/layouts/${layoutId}/history`),
  getVenueTables: (venueId: string) =>
    apiFetch<VenueTableDetail[]>(`/api/venues/${venueId}/tables`),
  createLayoutSnapshot: (venueId: string, layoutId: string, name?: string) =>
    apiFetch<{ id: string; version: number; message: string }>(
      `/api/venues/${venueId}/layouts/${layoutId}/snapshot`,
      {
        method: "POST",
        body: JSON.stringify({ name }),
      },
    ),
  generateTable: (
    venueId: string,
    config: {
      name: string;
      shape: "rectangle" | "circle" | "oval";
      seatCount: number;
      width?: number;
      height?: number;
      radius?: number;
      centerX: number;
      centerY: number;
      zoneId: string;
      startNumber?: number;
      seatSpacing?: number;
    },
  ) =>
    apiFetch<{ tableId: string; seatCount: number; message: string }>(
      `/api/venues/${venueId}/tables/generate`,
      {
        method: "POST",
        body: JSON.stringify(config),
      },
    ),
  deleteTable: (venueId: string, tableId: string) =>
    apiFetch<{ message: string }>(`/api/venues/${venueId}/tables/${tableId}`, {
      method: "DELETE",
    }),
  duplicateTable: (
    venueId: string,
    tableId: string,
    config: { newName: string; offsetX?: number; offsetY?: number; startNumber?: number },
  ) =>
    apiFetch<{ tableId: string; seatCount: number; message: string }>(
      `/api/venues/${venueId}/tables/${tableId}/duplicate`,
      {
        method: "POST",
        body: JSON.stringify(config),
      },
    ),
  getVenueTemplates: (venueId: string) =>
    apiFetch<Array<{
      id: string;
      name: string;
      category: string;
      capacity: number;
      layoutJson: any;
      description: string;
      createdAt: string;
    }>>(`/api/venues/${venueId}/templates`),
  
  // Products
  listProducts: (venueId: string, filters?: { type?: string; isActive?: boolean }) => {
    const params = new URLSearchParams();
    if (filters?.type) params.set("type", filters.type);
    if (filters?.isActive !== undefined) params.set("isActive", String(filters.isActive));
    const query = params.toString() ? `?${params.toString()}` : "";
    return apiFetch<Array<{
      id: string;
      venueId: string;
      type: string;
      name: string;
      description: string | null;
      price: number;
      currency: string;
      stock: number | null;
      isActive: boolean;
      metadata: Record<string, any> | null;
      createdAt: string;
      updatedAt: string;
    }>>(`/api/venues/${venueId}/products${query}`);
  },
  getProduct: (venueId: string, productId: string) =>
    apiFetch<{
      id: string;
      venueId: string;
      type: string;
      name: string;
      description: string | null;
      price: number;
      currency: string;
      stock: number | null;
      isActive: boolean;
      metadata: Record<string, any> | null;
      createdAt: string;
      updatedAt: string;
    }>(`/api/venues/${venueId}/products/${productId}`),
  createProduct: (
    venueId: string,
    product: {
      type: "food" | "beverage" | "parking" | "merchandise" | "gift" | "other";
      name: string;
      description?: string;
      price: number;
      currency?: string;
      stock?: number | null;
      isActive?: boolean;
      metadata?: Record<string, any>;
    }
  ) =>
    apiFetch<{ id: string; message: string }>(`/api/venues/${venueId}/products`, {
      method: "POST",
      body: JSON.stringify(product),
    }),
  updateProduct: (
    venueId: string,
    productId: string,
    updates: {
      type?: "food" | "beverage" | "parking" | "merchandise" | "gift" | "other";
      name?: string;
      description?: string | null;
      price?: number;
      currency?: string;
      stock?: number | null;
      isActive?: boolean;
      metadata?: Record<string, any> | null;
    }
  ) =>
    apiFetch<{ message: string }>(`/api/venues/${venueId}/products/${productId}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    }),
  deleteProduct: (venueId: string, productId: string) =>
    apiFetch<{ message: string }>(`/api/venues/${venueId}/products/${productId}`, {
      method: "DELETE",
    }),
  bulkCreateProducts: (
    venueId: string,
    products: Array<{
      type: "food" | "beverage" | "parking" | "merchandise" | "gift" | "other";
      name: string;
      description?: string;
      price: number;
      currency?: string;
      stock?: number | null;
      isActive?: boolean;
      metadata?: Record<string, any>;
    }>
  ) =>
    apiFetch<{ count: number; message: string }>(`/api/venues/${venueId}/products/bulk`, {
      method: "POST",
      body: JSON.stringify({ products }),
    }),

  // ============================================
  // TICKET PURCHASE
  // ============================================
  
  purchaseTickets: (
    eventId: string,
    payload: {
      sessionId: string;
      seatIds: string[];
      customerEmail?: string;
      customerName?: string;
    }
  ) =>
    apiFetch<{
      success: boolean;
      orderId: string;
      tickets: number;
      totalAmount: number;
      message: string;
    }>(`/api/events/${eventId}/purchase`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getSessionAvailability: (eventId: string, sessionId: string) =>
    apiFetch<{
      sessionId: string;
      seats: Array<{
        id: string;
        zoneId: string | null;
        label: string;
        rowLabel: string | null;
        columnNumber: number | null;
        available: boolean;
        status: "available" | "sold" | "reserved";
        price: number;
      }>;
      stats: {
        total: number;
        available: number;
        sold: number;
        reserved: number;
      };
    }>(`/api/events/${eventId}/sessions/${sessionId}/availability`),

  // ============================================
  // FILE UPLOAD
  // ============================================
  uploadFile: async (file: File, folder: "events" | "venues" | "categories" | "users" | "misc"): Promise<UploadResult> => {
    const formData = new FormData();
    formData.append("file", file);
    
    const response = await fetch(`${API_BASE_URL}/api/upload/${folder}`, {
      method: "POST",
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Upload failed" }));
      throw new Error(error.error || "Upload failed");
    }
    
    return response.json();
  },
  
  uploadMultipleFiles: async (files: File[], folder: "events" | "venues" | "categories" | "users" | "misc"): Promise<MultiUploadResult> => {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    
    const response = await fetch(`${API_BASE_URL}/api/upload/${folder}/multiple`, {
      method: "POST",
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Upload failed" }));
      throw new Error(error.error || "Upload failed");
    }
    
    return response.json();
  },
  
  deleteFile: (folder: string, filename: string) =>
    apiFetch<{ success: boolean }>(`/api/upload/${folder}/${filename}`, {
      method: "DELETE",
    }),
  
  getUploadInfo: () =>
    apiFetch<{
      maxFileSize: number;
      maxFileSizeMB: number;
      allowedTypes: string[];
      allowedFolders: string[];
    }>("/api/upload/info"),
};

// ==================== RESERVATIONS API ====================
export const reservationsApi = {
  /** Create a temporary reservation for seats */
  create: (sessionId: string, seats: Array<{ seatId: string; tierId?: string; price: number }>) =>
    apiFetch<{
      success: boolean;
      reservation?: {
        id: string;
        expiresAt: string;
        expiresIn: number;
        expiresInMinutes: number;
        tickets: Array<{ id: string; seatId: string | null; tierId: string | null; price: number }>;
        session: { id: string; eventId: string; eventName: string; startsAt: string };
      };
      error?: string;
    }>("/api/reservations", {
      method: "POST",
      body: JSON.stringify({ sessionId, seats }),
    }),

  /** Cancel an active reservation */
  cancel: (ticketIds: string[]) =>
    apiFetch<{ success: boolean; message?: string; error?: string }>("/api/reservations", {
      method: "DELETE",
      body: JSON.stringify({ ticketIds }),
    }),

  /** Confirm a reservation after payment */
  confirm: (data: {
    ticketIds: string[];
    paymentReference?: string;
    paymentMethod?: string;
    buyerName: string;
    buyerEmail: string;
    buyerPhone?: string;
    couponCode?: string;
    couponDiscount?: number;
  }) =>
    apiFetch<{
      success: boolean;
      order?: { id: string; orderNumber: string; total: number; currency: string; status: string };
      ticketCodes?: string[];
      error?: string;
    }>("/api/reservations/confirm", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /** Check if a specific seat is available */
  checkSeat: (sessionId: string, seatId: string) =>
    apiFetch<{ success: boolean; seatId: string; sessionId: string; available: boolean; status: string }>(
      `/api/reservations/check/${sessionId}/${seatId}`
    ),

  /** Get availability status for all seats in a session */
  getSessionStatus: (sessionId: string) =>
    apiFetch<{
      success: boolean;
      sessionId: string;
      seats: Record<string, { status: "RESERVED" | "SOLD"; expiresAt?: string }>;
      totalReserved: number;
      totalSold: number;
    }>(`/api/reservations/session/${sessionId}/status`),

  /** Purchase general admission tickets (no seat selection) */
  purchaseGeneral: (data: {
    sessionId: string;
    tickets: Array<{ tierId: string; quantity: number }>;
    buyerName: string;
    buyerEmail: string;
    buyerPhone?: string;
    couponCode?: string;
    couponDiscount?: number;
  }) =>
    apiFetch<{
      success: boolean;
      order?: {
        id: string;
        orderNumber: string;
        subtotal: number;
        fees: number;
        discount: number;
        total: number;
        currency: string;
        status: string;
      };
      ticketCodes?: string[];
      ticketCount?: number;
      error?: string;
    }>("/api/reservations/general", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// Types for categories
export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  coverImage: string | null;
  sortOrder: number;
  isActive: boolean;
  eventCount?: number;
  createdAt: string;
  updatedAt: string;
};

export type CategoryDetail = Category & {
  events: Array<{
    id: string;
    name: string;
    slug: string;
    thumbnailImage: string | null;
    shortDescription: string | null;
  }>;
};

export type CreateCategoryPayload = {
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  color?: string;
  coverImage?: string;
  sortOrder?: number;
  isActive?: boolean;
};

// Types for upload
export type UploadResult = {
  success: boolean;
  url: string;
  filename: string;
  size: number;
  mimeType: string;
};

export type MultiUploadResult = {
  success: boolean;
  uploaded: Array<{ url: string; filename: string; size: number }>;
  errors?: string[];
};
