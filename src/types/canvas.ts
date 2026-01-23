import { FabricObject } from "fabric";

export type SeatType = "regular" | "vip" | "accessible" | "blocked";
export type SeatShape = "circle" | "square" | "icon";
export type SeatStatus = "available" | "reserved" | "sold" | "blocked" | "selected";

// Extendemos la clase base de Fabric para incluir nuestros metadatos personalizados
export interface CustomFabricObject extends FabricObject {
  id: string;
  name?: string;
  zoneId?: string;
  price?: number;
  capacity?: number;
  type?: string; 
  status?: SeatStatus;
  seatType?: SeatType;
  tableId?: string;
  attachedSeats?: Array<{ id: string; offsetX: number; offsetY: number }>;
  _customType?: "section" | "seat" | "text" | "zone" | "guide" | "grid" | "table"; // guide para líneas temporales, grid para cuadrícula
  reservedBy?: string;
  reservedAt?: Date;
  soldAt?: Date;
}

export interface Seat {
  id: string;
  row: string;
  number: number;
  type: SeatType;
  status: SeatStatus;
  zoneId: string;
  x: number;
  y: number;
  price?: number;
  reservedBy?: string;
  reservedAt?: Date;
  soldAt?: Date;
}

export interface Zone {
  id: string;
  name: string;
  color?: string;
  type?: "section" | "stage" | "aisle" | "custom";
  price?: number;
  capacity?: number;
  visible?: boolean; 
}

export interface RemoteSeatPayload {
  id: string;
  label: string;
  rowLabel?: string;
  columnNumber?: number;
  zoneId: string;
  status: SeatStatus;
  seatType?: string;
  basePrice?: number;
  tableId?: string;
  metadata?: {
    offsetX?: number;
    offsetY?: number;
    angle?: number;
    shape?: string;
    canvas?: {
      left?: number;
      top?: number;
      size?: { width?: number; height?: number; radius?: number };
      style?: { fill?: string; stroke?: string };
    };
  };
}

export interface SeatingGrid {
  rows: number;
  columns: number;
  rowSpacing: number;
  seatSpacing: number;
  startRow: string;
  seatType: SeatType;
  seatShape: SeatShape;
  zoneId: string;
  zoneName?: string;
  zoneColor?: string;
  /** Prefijo para los labels de asientos (ej: "Z1" genera "Z1-A1", "Z1-A2") */
  labelPrefix?: string;
}

export type ToolType = 
  | "select" 
  | "rectangle" 
  | "circle" 
  | "polygon"
  | "section"           // For drawing section polygons (hierarchical layouts)
  | "section-circle"    // For drawing circular/ellipse sections
  | "section-arc"       // For drawing arc/curve sections (stadium style)
  | "seating-grid"
  | "text"
  | "hand";

// Section types for hierarchical layouts
export interface LayoutSection {
  id: string;
  name: string;
  description?: string;
  color: string;
  polygonPoints: Array<{ x: number; y: number }>;
  labelPosition?: { x: number; y: number };
  capacity: number;
  displayOrder: number;
  isActive: boolean;
  hoverColor: string;
  selectedColor: string;
  thumbnailUrl?: string;
  zoneId?: string;
  childLayoutId?: string;
  metadata?: Record<string, any>;
}

// Interfaz para el estado del historial
export interface CanvasState {
    canvasJSON: any;
    zones: Zone[];
    zoom?: number;
    viewportTransform?: number[];
}