export type VenueStats = {
  zones: number;
  totalSeats: number;
  available: number;
  blocked: number;
  events: number;
};

// Category types
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

export type CreateCategoryPayload = {
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  coverImage?: string | null;
  sortOrder?: number;
  isActive?: boolean;
};

export type VenueSummary = {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  capacity: number | null;
  description: string | null;
  layoutJson: Record<string, unknown> | null;
  defaultLayoutId: string | null;
  createdAt: string;
  updatedAt: string;
  stats: VenueStats;
};

export type VenueZone = {
  id: string;
  venueId: string;
  name: string;
  color: string | null;
  basePrice: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type VenueSeat = {
  id: string;
  venueId: string;
  zoneId: string | null;
  label: string;
  rowLabel: string | null;
  columnNumber: number | null;
  seatType: string | null;
  basePrice: number | null;
  status: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type VenueDetail = VenueSummary & {
  zones: VenueZone[];
  seats: VenueSeat[];
};

export type VenueLayoutDetail = {
  id: string;
  venueId: string;
  name: string;
  version: number;
  layoutJson: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  isDefault: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  zones: VenueZone[];
  seats: VenueSeat[];
};

export type CreateVenuePayload = {
  name: string;
  slug?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  capacity?: number;
  description?: string;
  layout?: {
    name: string;
    version?: number;
    json?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    isDefault?: boolean;
  };
  zones?: Array<{
    clientId?: string;
    name: string;
    color?: string;
    basePrice?: number;
    metadata?: Record<string, unknown>;
  }>;
  seats?: Array<{
    label: string;
    rowLabel?: string;
    columnNumber?: number;
    zoneId?: string;
    zoneKey?: string;
    seatType?: string;
    basePrice?: number;
    status?: "AVAILABLE" | "RESERVED" | "SOLD" | "BLOCKED";
    metadata?: Record<string, unknown>;
  }>;
};

export type CreateVenueResponse = {
  id: string;
  slug: string;
  layoutId: string;
  zoneCount: number;
  seatCount: number;
  capacity: number | null;
  pendingLayout: boolean;
};

export type SaveVenueLayoutPayload = {
  layoutId: string;
  layoutJson: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  zones?: Array<{
    id: string;
    name: string;
    color?: string;
    price?: number;
    capacity?: number;
    type?: string;
    visible?: boolean;
    metadata?: Record<string, unknown>;
  }>;
  seats?: Array<{
    id: string;
    label: string;
    name?: string;
    rowLabel?: string;
    columnNumber?: number;
    zoneId?: string;
    seatType?: string;
    status?: string;
    price?: number;
    tableId?: string;
    position?: { x: number; y: number; angle?: number };
    size?: { width: number; height: number };
    metadata?: Record<string, unknown>;
  }>;
  tables?: Array<{
    id: string;
    shape: "circle" | "rectangle" | "square";
    centerX: number;
    centerY: number;
    rotation?: number;
    seatCount: number;
    zoneId?: string;
    metadata?: Record<string, unknown>;
  }>;
};

export type EventStats = {
  sessions: number;
  totalTickets: number;
  soldTickets: number;
  progress: number;
};

export type EventSummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  shortDescription?: string | null;
  status: string;
  venueId: string | null;
  categoryId: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  
  // Media
  coverImage?: string | null;
  thumbnailImage?: string | null;
  videoUrl?: string | null;
  
  // Details
  artistName?: string | null;
  organizer?: string | null;
  ageRestriction?: string | null;
  duration?: string | null;
  isFeatured?: boolean;
  showRemainingTickets?: boolean;
  
  // Relations
  venue: { id: string; name: string | null; slug: string | null } | null;
  category?: { id: string; name: string; slug: string } | null;
  
  // Stats
  stats: EventStats;
  firstSession: string | null;
  
  // Price range
  priceRange?: { min: number; max: number; currency: string } | null;
};

export type CreateEventPayload = {
  name: string;
  slug?: string;
  description?: string;
  shortDescription?: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  venueId: string;
  layoutId?: string; // ID del layout a usar (si no se especifica, usa el default del venue)
  categoryId?: string;
  createdById?: string;
  
  // Media
  coverImage?: string;
  thumbnailImage?: string;
  galleryImages?: string[];
  videoUrl?: string;
  
  // Event details
  organizer?: string;
  organizerLogo?: string;
  artistName?: string;
  ageRestriction?: string;
  doorTime?: string;
  duration?: string;
  
  // Policies
  policies?: Array<{ title: string; content: string }>;
  terms?: string;
  refundPolicy?: string;
  
  // SEO
  seoTitle?: string;
  seoDescription?: string;
  seoImage?: string;
  
  // Social
  socialLinks?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    website?: string;
  };
  hashtag?: string;
  
  // Publishing
  isFeatured?: boolean;
  salesStartAt?: string;
  salesEndAt?: string;
  
  sessions: Array<{
    clientId?: string;
    title?: string;
    layoutId?: string;
    startsAt: string;
    endsAt?: string;
    status?: "SCHEDULED" | "SALES_OPEN" | "SOLD_OUT" | "CANCELLED";
    capacity?: number;
    doorsOpenAt?: string;
    salesOpenAt?: string;
    salesCloseAt?: string;
  }>;
  tiers: Array<{
    clientId?: string;
    label: string;
    description?: string;
    price: number;
    fee?: number;
    currency?: string;
    zoneId?: string;
    seatType?: string;
    sessionKeys?: string[];
    minQuantity?: number;
    maxQuantity?: number;
    capacity?: number;
    isDefault?: boolean;
  }>;
  showRemainingTickets?: boolean;
};
