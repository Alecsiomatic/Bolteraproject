// Extended types for Phase 1 implementation

export type VenueLayoutVersion = {
  id: string;
  venueId: string;
  name: string;
  version: number;
  layoutJson: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  isDefault: boolean;
  publishedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VenueProduct = {
  id: string;
  venueId: string;
  type: "meal" | "drink" | "gift" | "parking" | "merch";
  name: string;
  description: string | null;
  price: number;
  stock: number | null;
  metadata: Record<string, unknown> | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type VenueTemplate = {
  id: string;
  venueId: string | null;
  name: string;
  description: string | null;
  category: "theater" | "stadium" | "club" | "cinema" | "concert";
  capacity: number | null;
  layoutJson: Record<string, unknown>;
  thumbnailUrl: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
};

export type VenueAlert = {
  id: string;
  venueId: string;
  zoneId: string | null;
  condition: "available_lt" | "sold_rate_gt" | "last_sale_age_gt";
  threshold: number;
  notifyEmails: string[];
  isActive: boolean;
  lastTriggered: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ZonePriceTier = {
  id: string;
  zoneId: string;
  eventId: string | null;
  sessionId: string | null;
  price: number;
  validFrom: string | null;
  validTo: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type VenueTableDetail = {
  id: string;
  venueId: string;
  shape: string;
  centerX: number;
  centerY: number;
  rotation: number;
  seatCount: number;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  seats: Array<{
    id: string;
    label: string;
    offsetX?: number;
    offsetY?: number;
    angle?: number;
  }>;
};

// Extended seat metadata structure
export type SeatMetadataExtended = {
  tableId?: string;
  offsetX?: number;
  offsetY?: number;
  angle?: number;
  shape?: "circle" | "square" | "rect";
  radius?: number;
  cornerRadius?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  addOns?: Array<{
    productId: string;
    quantity: number;
  }>;
  canvas?: {
    position?: { x: number; y: number; angle?: number };
    size?: { width: number; height: number };
    label?: string;
  };
};

// Version conflict response
export type LayoutVersionConflict = {
  error: "version_conflict";
  message: string;
  currentVersion: number;
  requestedVersion: number;
  lastEditedBy: string | null;
  diff?: {
    added: number;
    modified: number;
    deleted: number;
  };
};
