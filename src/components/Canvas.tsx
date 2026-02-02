import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Canvas as FabricCanvas, Circle, Rect, Polygon, IText, Point, Group, FabricObject, util, Line, FabricImage, ActiveSelection, Path } from "fabric";
import { useSearchParams, useNavigate } from "react-router-dom";
import { ColorPicker } from "./ColorPicker";
import { SeatingGenerator } from "./SeatingGenerator";
import { TableGenerator, TableConfig } from "./TableGenerator";
import { TableGeneratorModal } from "./TableGeneratorModal";
import { SeatInspector } from "./SeatInspector";
import { PropertiesPanel } from "./PropertiesPanel";
import { ZoneManager } from "./ZoneManager";
import { SectionManager, type SectionData, type SectionShapeType } from "./SectionManager";
import { SeatStatusManager } from "./SeatStatusManager";
import { toast } from "sonner";
import { ToolType, SeatingGrid, SeatType, SeatStatus, CustomFabricObject, CanvasState, LayoutSection } from "@/types/canvas";
import { Slider } from "@/components/ui/slider";
import { Button } from "./ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Separator } from "./ui/separator";
import { Input } from "./ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { 
  MousePointer2, Square, Circle as CircleIcon, Pentagon, Type, Hand, 
  Save, Upload, Undo2, Redo2, Copy, Image as ImageIcon, FileJson, Trash2, AlertTriangle,
  Maximize, ZoomIn, ZoomOut
} from "lucide-react";
import { api } from "@/lib/api";
import { useVenueLayout } from "@/hooks/useVenueLayout";
import { useEventLayout } from "@/hooks/useEventLayout";
import type { VenueLayoutDetail, VenueSeat, VenueZone } from "@/types/api";
import type { SeatMetadataExtended, VenueTableDetail } from "@/types/venue-extended";
import { mapSeatFromDb, mapZoneFromDb } from "@/lib/canvas-transformers";
import type { GeneratedSeat, SeatGenerationOptions } from "@/lib/polygon-seat-generator";

// Zustand stores y hooks mejorados
import { useCanvasStore } from "@/stores/canvasStore";
import { useSelectionStore } from "@/stores/selectionStore";
import { useHistoryStore } from "@/stores/historyStore";
import { useZonesStore, type Zone } from "@/stores/zonesStore";
import { useZoomController } from "@/hooks/useZoomController";
import { useCanvasKeyboard } from "@/hooks/useCanvasKeyboard";
import { SaveIndicator } from "@/components/canvas/SaveIndicator";
import { ZoomControls } from "@/components/canvas/ZoomControls";
import { CANVAS_CONFIG, ZOOM_CONFIG } from "@/lib/canvas-constants";

// ============================================
// FABRIC.JS CUSTOM PROPERTIES REGISTRATION
// ============================================
// IMPORTANTE: Registrar propiedades custom ANTES de usar cualquier objeto Fabric.js
// Esto permite que toJSON() incluya estas propiedades automáticamente
const CUSTOM_FABRIC_PROPERTIES = [
  '_customType',  // seat, zone, table, section, border, grid, background-image
  'id',           // unique identifier
  'name',         // display name / label
  'sectionId',    // section this object belongs to
  'zoneId',       // zone this object belongs to
  'tableId',      // table this seat belongs to
  'status',       // available, reserved, sold, blocked
  'seatType',     // STANDARD, VIP, WHEELCHAIR, etc.
  'price',        // seat price
  'capacity',     // zone/table capacity
  'attachedSeats', // seats attached to a table
  'reservedBy',   // user who reserved
  'metadata',     // additional metadata
];

// Registrar en FabricObject para que todas las clases lo hereden
FabricObject.customProperties = CUSTOM_FABRIC_PROPERTIES;

// También registrar en clases específicas para asegurar compatibilidad
Circle.customProperties = CUSTOM_FABRIC_PROPERTIES;
Rect.customProperties = CUSTOM_FABRIC_PROPERTIES;
Group.customProperties = CUSTOM_FABRIC_PROPERTIES;
Polygon.customProperties = CUSTOM_FABRIC_PROPERTIES;
// ============================================

// Constantes para Snapping (las de zoom ahora vienen de canvas-constants)
const SNAP_THRESHOLD = 15;
const GRID_SIZE = 40; 
const DEFAULT_SEAT_SIZE = 28;
const DEFAULT_SEAT_COLOR = "#0EA5E9";
const DEFAULT_SEAT_STROKE = "#1e293b";

// Usar constantes centralizadas
const CANVAS_WIDTH = CANVAS_CONFIG.WIDTH;
const CANVAS_HEIGHT = CANVAS_CONFIG.HEIGHT;

type RemoteSeatPayload = {
  id: string;
  label: string;
  name?: string;
  zoneId?: string | null;
  seatType?: SeatType;
  status?: SeatStatus;
  price?: number;
  tableId?: string;
  metadata?: Record<string, unknown> | null;
};

type RemoteLayoutPayload = {
  canvas?: Record<string, unknown>;
  zones?: Zone[];
  seats?: RemoteSeatPayload[];
  sections?: SectionData[];
};

// Usar funciones centralizadas de canvas-transformers.ts
// Las funciones mapSeatFromDb y mapZoneFromDb ya están importadas arriba

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// Alias para compatibilidad con código existente
const mapSeatFromApi = (seat: VenueSeat): RemoteSeatPayload => mapSeatFromDb(seat);
const mapZoneFromApi = (zone: VenueZone): Zone => mapZoneFromDb(zone);

const extractRemoteLayoutPayload = (layoutJson?: Record<string, unknown> | null): RemoteLayoutPayload | null => {
  if (!layoutJson) {
    console.log("[extractRemoteLayoutPayload] layoutJson is null/undefined");
    return null;
  }
  console.log("[extractRemoteLayoutPayload] layoutJson keys:", Object.keys(layoutJson));
  const payload: RemoteLayoutPayload = {};
  const canvasValue = layoutJson["canvas"];
  console.log("[extractRemoteLayoutPayload] canvasValue type:", typeof canvasValue, "isRecord:", isRecord(canvasValue));
  if (isRecord(canvasValue) || Array.isArray(canvasValue)) {
    payload.canvas = canvasValue as Record<string, unknown>;
    console.log("[extractRemoteLayoutPayload] canvas objects count:", (canvasValue as any)?.objects?.length);
  }
  const zonesValue = layoutJson["zones"];
  if (Array.isArray(zonesValue)) {
    payload.zones = zonesValue as Zone[];
  }
  const seatsValue = layoutJson["seats"];
  if (Array.isArray(seatsValue)) {
    payload.seats = seatsValue as RemoteSeatPayload[];
  }
  const sectionsValue = layoutJson["sections"];
  if (Array.isArray(sectionsValue)) {
    payload.sections = sectionsValue as SectionData[];
  }
  return payload;
};

const buildRemotePayloadFromLayout = (layout?: VenueLayoutDetail | null): RemoteLayoutPayload | null => {
  if (!layout) return null;
  const storedPayload = extractRemoteLayoutPayload(layout.layoutJson);
  const zones = storedPayload?.zones?.length ? storedPayload.zones : layout.zones.map(mapZoneFromApi);
  const seats = storedPayload?.seats?.length ? storedPayload.seats : layout.seats.map(mapSeatFromApi);

  return {
    canvas: storedPayload?.canvas,
    zones,
    seats,
    sections: storedPayload?.sections ?? [],
  };
};

const getStringMeta = (metadata: Record<string, unknown>, key: string) => {
  const value = metadata[key];
  return typeof value === "string" ? value : undefined;
};

const getNumberMeta = (metadata: Record<string, unknown>, key: string) => {
  const value = metadata[key];
  return typeof value === "number" ? value : undefined;
};

const getCanvasMeta = (metadata: Record<string, unknown>) =>
  (isRecord(metadata["canvas"]) ? (metadata["canvas"] as Record<string, unknown>) : undefined) ?? undefined;

const createSeatObjectFromPayload = (seat: RemoteSeatPayload): CustomFabricObject => {
  const metadata = seat.metadata ?? {};
  const canvasMeta = getCanvasMeta(metadata);
  const rawPosition = (canvasMeta?.position as { x?: number; y?: number; angle?: number }) ?? undefined;
  const rawSize = (canvasMeta?.size as { width?: number; height?: number }) ?? undefined;
  const left = typeof rawPosition?.x === "number" ? rawPosition.x : 0;
  const top = typeof rawPosition?.y === "number" ? rawPosition.y : 0;
  const angle = typeof rawPosition?.angle === "number" ? rawPosition.angle : 0;
  const width = typeof rawSize?.width === "number" ? rawSize.width : DEFAULT_SEAT_SIZE;
  const height = typeof rawSize?.height === "number" ? rawSize.height : DEFAULT_SEAT_SIZE;
  const shape = (getStringMeta(metadata, "shape") ?? "circle").toLowerCase();
  const fill = getStringMeta(metadata, "fill") ?? getSeatColorByType(seat.seatType ?? "regular", DEFAULT_SEAT_COLOR);
  const stroke = getStringMeta(metadata, "stroke") ?? DEFAULT_SEAT_STROKE;
  const strokeWidth = getNumberMeta(metadata, "strokeWidth") ?? 1;

  if (shape === "square" || shape === "rect") {
    const rect = new Rect({
      left,
      top,
      width,
      height,
      angle,
      fill,
      stroke,
      strokeWidth,
      rx: getNumberMeta(metadata, "cornerRadius") ?? 4,
      ry: getNumberMeta(metadata, "cornerRadius") ?? 4,
      originX: "left",
      originY: "top",
    });
    const seatObject = rect as CustomFabricObject;
    seatObject.id = seat.id;
    seatObject.name = seat.name ?? seat.label;
    seatObject.zoneId = seat.zoneId ?? undefined;
    seatObject._customType = "seat";
    seatObject.status = seat.status ?? "available";
    seatObject.seatType = seat.seatType ?? "regular";
    seatObject.price = seat.price;
    seatObject.tableId = seat.tableId;
    return seatObject;
  }

  const radius = getNumberMeta(metadata, "radius") ?? Math.min(width, height) / 2;
  const circle = new Circle({
    left,
    top,
    radius,
    angle,
    fill,
    stroke,
    strokeWidth,
    originX: "left",
    originY: "top",
  });
  const seatObject = circle as CustomFabricObject;
  seatObject.id = seat.id;
  seatObject.name = seat.name ?? seat.label;
  seatObject.zoneId = seat.zoneId ?? undefined;
  seatObject._customType = "seat";
  seatObject.status = seat.status ?? "available";
  seatObject.seatType = seat.seatType ?? "regular";
  seatObject.price = seat.price;
  seatObject.tableId = seat.tableId;
  return seatObject;
};

const createSeatLabel = (seat: CustomFabricObject, label?: string) => {
  if (!label) return null;
  const bounds = seat.getBoundingRect(true, true);
  const labelObj = new IText(label, {
    left: bounds.left + bounds.width / 2,
    top: bounds.top + bounds.height / 2,
    fontSize: 10,
    fontFamily: "Arial",
    fill: "#ffffff",
    selectable: false,
    evented: false,
    originX: "center",
    originY: "center",
  });
  // Vincular el label al asiento
  (labelObj as any).linkedSeatId = seat.id;
  (labelObj as any)._customType = "seat-label";
  // Guardar referencia del label en el asiento
  (seat as any).linkedLabelId = labelObj;
  return labelObj;
};

const parseSeatLabel = (rawLabel: string) => {
  const label = rawLabel.trim();
  const match = label.match(/^([A-Za-zÁÉÍÓÚÑ]+)(\d+)$/i);
  if (!match) {
    return { rowLabel: undefined, columnNumber: undefined };
  }
  return {
    rowLabel: match[1].toUpperCase(),
    columnNumber: Number(match[2]),
  };
};

const getSeatColorByType = (type: SeatType, fallback: string) => {
  switch (type) {
    case "vip":
      return "#F59E0B";
    case "accessible":
      return "#10B981";
    case "blocked":
      return "#6B7280";
    default:
      return fallback;
  }
};

function isPointInPolygon(point: { x: number; y: number }, vs: { x: number; y: number }[]) {
    let x = point.x, y = point.y;
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        let xi = vs[i].x, yi = vs[i].y;
        let xj = vs[j].x, yj = vs[j].y;
        
        let intersect = ((yi > y) !== (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
};

export const Canvas = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeToolRef = useRef<ToolType>('select'); // Ref para activeTool
  const isDraggingRef = useRef<boolean>(false); // Ref para isDragging
  const lastPosXRef = useRef<number>(0); // Ref para lastPosX (pan)
  const lastPosYRef = useRef<number>(0); // Ref para lastPosY (pan)
  
  // ===========================================
  // ZUSTAND STORES
  // ===========================================
  
  // Canvas Store
  const { 
    setFabricCanvas: setStoreFabricCanvas,
    setContainerRef: setStoreContainerRef,
    setZoom: setStoreZoom,
    setPan: setStorePan,
    setDirty: setStoreDirty,
    setSaving: setStoreSaving,
    setLastSavedAt: setStoreLastSavedAt,
    gridEnabled: storeGridEnabled,
    setGridEnabled: setStoreGridEnabled,
    previewMode: storePreviewMode,
    setPreviewMode: setStorePreviewMode,
    activeColor: storeActiveColor,
    setActiveColor: setStoreActiveColor,
    activeTool: storeActiveTool,
    setActiveTool: setStoreActiveTool,
  } = useCanvasStore();

  // Selection Store
  const { 
    selectedObjects: storeSelectedObjects,
    setSelection: setStoreSelection, 
    clearSelection: clearStoreSelection,
  } = useSelectionStore();
  
  // Zones Store
  const {
    zones: storeZones,
    setZones: setStoreZones,
    addZone: addStoreZone,
    updateZone: updateStoreZone,
    deleteZone: deleteStoreZone,
    toggleZoneVisibility: toggleStoreZoneVisibility,
  } = useZonesStore();
  
  // History Store (para referencia, se integrará más adelante)
  const { 
    push: pushHistory, 
    undo: undoHistory, 
    redo: redoHistory, 
    canUndo, 
    canRedo,
    setPresent: setHistoryPresent,
  } = useHistoryStore();
  
  // Zoom Controller - Centralizado
  const { 
    handleWheel: handleZoomWheel, 
    handleFitToScreen: zoomFitToScreen,
    handleZoomIn,
    handleZoomOut,
    handleZoom100,
    limitViewport,
    zoomLevel: controllerZoomLevel,
    zoomPercentage,
    zoomToCenter,
  } = useZoomController();
  
  // ===========================================
  // LOCAL STATE (migrar gradualmente a stores)
  // ===========================================
  
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  // Mantener estado local sincronizado con store por ahora
  const [activeColor, setActiveColor] = useState("#0EA5E9");
  const [activeTool, setActiveTool] = useState<ToolType>("select");
  
  const [selectedObjects, setSelectedObjects] = useState<CustomFabricObject[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [sections, setSections] = useState<SectionData[]>([]);
  const [isHierarchicalMode, setIsHierarchicalMode] = useState(false);
  
  const [polygonPoints, setPolygonPoints] = useState<{ x: number; y: number }[]>([]);
  const [guideLine, setGuideLine] = useState<Line | null>(null); 
  
  // States for circle/arc section drawing
  const [circleDrawStart, setCircleDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [circlePreview, setCirclePreview] = useState<Circle | null>(null);
  const [arcDrawState, setArcDrawState] = useState<{
    center: { x: number; y: number } | null;
    innerRadius: number;
    outerRadius: number;
    startAngle: number;
    endAngle: number;
    step: 'center' | 'inner' | 'outer' | 'start-angle' | 'end-angle';
  }>({
    center: null,
    innerRadius: 0,
    outerRadius: 0,
    startAngle: 0,
    endAngle: Math.PI,
    step: 'center'
  });
  const [arcPreview, setArcPreview] = useState<Path | null>(null);
  
  const [isDragging, setIsDragging] = useState(false);
  const [lastPosX, setLastPosX] = useState(0);
  const [lastPosY, setLastPosY] = useState(0);

  const [bgOpacity, setBgOpacity] = useState(0.5);
  const [showGrid, setShowGrid] = useState(true);
  const [showSeats, setShowSeats] = useState(true); // Toggle para ocultar asientos y mejorar rendimiento
  // zoomLevel ahora viene del controllerZoomLevel (useZoomController)
  const [previewMode, setPreviewMode] = useState(false);

  const [history, setHistory] = useState<CanvasState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isHistoryLocked = useRef(false); 
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const venueId = searchParams.get("venueId");
  const layoutId = searchParams.get("layoutId");
  const eventId = searchParams.get("eventId");
  const [isCreatingLayout, setIsCreatingLayout] = useState(false);
  const hasAttemptedLayoutCreation = useRef(false);
  
  // Determine if we're in event mode or venue mode
  const isEventMode = Boolean(eventId);
  
  // Auto-find or create layout if venueId exists but layoutId doesn't
  useEffect(() => {
    const findOrCreateLayoutForVenue = async () => {
      if (!venueId || layoutId || isCreatingLayout || hasAttemptedLayoutCreation.current) return;
      
      hasAttemptedLayoutCreation.current = true;
      setIsCreatingLayout(true);
      
      try {
        // First, try to find existing layouts for this venue
        toast.info("Buscando layout del venue...");
        const layouts = await api.listVenueLayouts(venueId);
        
        if (layouts && layouts.length > 0) {
          // Use the default layout, or the first one if no default
          const defaultLayout = layouts.find((l: any) => l.isDefault) || layouts[0];
          toast.success("Layout encontrado, cargando...");
          navigate(`/canvas?venueId=${venueId}&layoutId=${defaultLayout.id}`, { replace: true });
        } else {
          // No layouts exist, create a new one
          toast.info("No hay layouts, creando uno nuevo...");
          const result = await api.createLayout(venueId);
          toast.success("Layout creado, redirigiendo...");
          navigate(`/canvas?venueId=${venueId}&layoutId=${result.layoutId}`, { replace: true });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo cargar/crear el layout";
        toast.error(`Error: ${message}`);
        hasAttemptedLayoutCreation.current = false; // Allow retry
      } finally {
        setIsCreatingLayout(false);
      }
    };
    
    // Only auto-find/create layout for venue mode, not event mode
    if (!isEventMode) {
      findOrCreateLayoutForVenue();
    }
  }, [venueId, layoutId, navigate, isCreatingLayout, isEventMode]);
  
  // Reset creation flag when venue changes
  useEffect(() => {
    hasAttemptedLayoutCreation.current = false;
  }, [venueId]);
  
  // Fetch venue layout (for venue mode)
  const {
    data: venueLayoutData,
    refetch: refetchVenueLayout,
    isFetching: venueLayoutLoading,
  } = useVenueLayout(
    !isEventMode ? venueId ?? undefined : undefined, 
    !isEventMode ? layoutId ?? undefined : undefined
  );
  
  // Fetch event layout (for event mode)
  const {
    data: eventLayoutData,
    refetch: refetchEventLayout,
    isFetching: eventLayoutLoading,
  } = useEventLayout(isEventMode ? eventId ?? undefined : undefined);
  
  // Normalize the layout data depending on the mode
  const venueLayout = isEventMode 
    ? (eventLayoutData ? {
        ...eventLayoutData.layout,
        zones: eventLayoutData.zones,
        seats: eventLayoutData.seats,
      } : undefined)
    : venueLayoutData;
  
  const layoutLoading = isEventMode ? eventLayoutLoading : venueLayoutLoading;
  const refetchLayout = isEventMode ? refetchEventLayout : refetchVenueLayout;
  
  // In event mode, we need to derive venueId and layoutId from the event data
  const effectiveVenueId = isEventMode ? eventLayoutData?.venueId : venueId;
  const effectiveLayoutId = isEventMode ? eventLayoutData?.layout?.id : layoutId;
  
  const hasSyncedRemoteLayout = useRef(false);
  const [savingLayout, setSavingLayout] = useState(false);
  const isRemoteSession = Boolean((venueId && layoutId) || eventId);
  const saveButtonLabel = isRemoteSession ? "Guardar (servidor)" : "Guardar local";
  const loadButtonLabel = isRemoteSession ? "Recargar servidor" : "Cargar local";
  const [loadingLayout, setLoadingLayout] = useState(false);
  const [currentLayoutVersion, setCurrentLayoutVersion] = useState<number>(1);
  const [isDirty, setIsDirty] = useState(false);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [showTableGenerator, setShowTableGenerator] = useState(false);
  const [showSeatInspector, setShowSeatInspector] = useState(false);
  const [inspectedSeat, setInspectedSeat] = useState<{ id: string; label: string; addOns?: any[] } | null>(null);
  
  // Estado para forzar actualización de estadísticas cuando el canvas cambia
  const [canvasVersion, setCanvasVersion] = useState(0);
  const canvasVersionRef = useRef(0);
  const updateCanvasVersion = useCallback(() => {
    canvasVersionRef.current += 1;
    setCanvasVersion(canvasVersionRef.current);
  }, []);
  
  // Estado para modal de renombrar zona
  const [showZoneRenameModal, setShowZoneRenameModal] = useState(false);
  const [zoneToRename, setZoneToRename] = useState<{ id: string; name: string; color: string } | null>(null);
  const [zoneNewName, setZoneNewName] = useState("");
  const [remoteTables, setRemoteTables] = useState<VenueTableDetail[]>([]);
  const liveCanvasRef = useRef<FabricCanvas | null>(null);
  const zonesRef = useRef<Zone[]>([]); // Ref para acceder a zones en closures
  
  // Estado para diálogo de conflicto de versión
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [conflictData, setConflictData] = useState<{
    currentVersion: number;
    requestedVersion: number;
    lastEditedBy?: string;
  } | null>(null);

  // ==========================================
  // SINCRONIZACIÓN LOCAL <-> STORE
  // ===========================================
  
  // Mantener zonesRef sincronizada
  useEffect(() => {
    zonesRef.current = zones;
  }, [zones]);
  
  // Sincronizar zonas locales con store
  useEffect(() => {
    setStoreZones(zones);
  }, [zones, setStoreZones]);

  // Sincronizar selección local con store
  useEffect(() => {
    const ids = selectedObjects.map(obj => obj.id).filter(Boolean) as string[];
    setStoreSelection(ids, selectedObjects);
  }, [selectedObjects, setStoreSelection]);

  // Sincronizar color activo con store
  useEffect(() => {
    setStoreActiveColor(activeColor);
  }, [activeColor, setStoreActiveColor]);

  // Sincronizar herramienta activa con store
  useEffect(() => {
    setStoreActiveTool(activeTool);
    // Actualizar ref para que los event listeners usen el valor actual
    activeToolRef.current = activeTool;
  }, [activeTool, setStoreActiveTool]);

  // Sincronizar dirty state con store
  useEffect(() => {
    setStoreDirty(isDirty);
  }, [isDirty, setStoreDirty]);

  // Sincronizar grid con store
  useEffect(() => {
    setStoreGridEnabled(showGrid);
  }, [showGrid, setStoreGridEnabled]);

  // Efecto para ocultar/mostrar asientos - mejora rendimiento al editar polígonos
  useEffect(() => {
    if (!fabricCanvas) return;
    
    fabricCanvas.forEachObject((obj: any) => {
      if (obj._customType === 'seat' || obj.type === 'Circle' || obj.type === 'circle') {
        obj.visible = showSeats;
      }
    });
    fabricCanvas.requestRenderAll();
  }, [showSeats, fabricCanvas]);

  // Sincronizar preview mode con store
  useEffect(() => {
    setStorePreviewMode(previewMode);
  }, [previewMode, setStorePreviewMode]);

  useEffect(() => {
    hasSyncedRemoteLayout.current = false;
  }, [venueId, layoutId]);

  useEffect(() => {
    liveCanvasRef.current = fabricCanvas;
  }, [fabricCanvas]);

  useEffect(() => {
    if (!isRemoteSession) {
      setRemoteTables([]);
    }
  }, [isRemoteSession]);

  // MEJORA: Usar historyStore de Zustand en lugar de estado local
  // El estado local se mantiene como fallback pero el store es la fuente de verdad
  const saveHistory = useCallback((action?: string) => {
      if (!fabricCanvas || isHistoryLocked.current) return;
      
      const json = fabricCanvas.toJSON(['id', 'name', 'price', 'capacity', 'zoneId', '_customType', 'status', 'seatType', 'tableId', 'attachedSeats', 'reservedBy', 'lockMovementX', 'lockMovementY', 'lockScalingX', 'lockScalingY', 'lockRotation', 'hasControls', 'selectable']);
      
      // Guardar en historyStore de Zustand (nueva implementación)
      pushHistory({
        canvasJSON: JSON.stringify(json),
        zones: [...zones],
        action,
      });
      
      // Mantener historial local como backup (deprecado, remover en futuro)
      const currentState: CanvasState = {
          canvasJSON: json,
          zones: [...zones],
      };

      setHistory(prev => {
          const newHistory = prev.slice(0, historyIndex + 1);
          newHistory.push(currentState);
          if (newHistory.length > 50) newHistory.shift(); 
          return newHistory;
      });
      setHistoryIndex(prev => Math.min(prev + 1, 49));
      
      // Mark as dirty when history changes (excluding initial load)
      if (historyIndex >= 0) {
        setIsDirty(true);
      }
  }, [fabricCanvas, zones, historyIndex, pushHistory]);

  const fetchTablesForVenue = useCallback(async (): Promise<VenueTableDetail[]> => {
    if (!venueId || !isRemoteSession) {
      setRemoteTables([]);
      return [];
    }

    try {
      const tables = await api.getVenueTables(venueId);
      setRemoteTables(tables);
      return tables;
    } catch (error) {
      console.error("Error fetching venue tables:", error);
      return [];
    }
  }, [venueId, isRemoteSession]);
  // Grid Logic
  const drawGridLines = useCallback(
    (canvas: FabricCanvas) => {
      canvas.getObjects().forEach((obj: any) => {
        if (obj._customType === "grid") canvas.remove(obj);
      });

      if (!showGrid) {
        canvas.requestRenderAll();
        return;
      }

      // Use logical canvas dimensions, not HTML canvas size
      const width = CANVAS_WIDTH;
      const height = CANVAS_HEIGHT;
      const gridColor = "#94a3b8"; // More visible grid color

      // Draw vertical lines
      for (let i = 0; i <= width / GRID_SIZE; i++) {
        const x = i * GRID_SIZE;
        const line = new Line([x, 0, x, height], {
          stroke: gridColor,
          selectable: false,
          evented: false,
          strokeWidth: i % 5 === 0 ? 1.5 : 0.5, // Thicker lines every 5 units
          opacity: i % 5 === 0 ? 0.4 : 0.2,
          excludeFromExport: true,
        });
        (line as CustomFabricObject)._customType = "grid";
        canvas.add(line);
      }

      // Draw horizontal lines
      for (let i = 0; i <= height / GRID_SIZE; i++) {
        const y = i * GRID_SIZE;
        const line = new Line([0, y, width, y], {
          stroke: gridColor,
          selectable: false,
          evented: false,
          strokeWidth: i % 5 === 0 ? 1.5 : 0.5, // Thicker lines every 5 units
          opacity: i % 5 === 0 ? 0.4 : 0.2,
          excludeFromExport: true,
        });
        (line as CustomFabricObject)._customType = "grid";
        canvas.add(line);
      }

      // Send all grid lines to back
      canvas.getObjects().forEach((obj: any) => {
        if (obj._customType === "grid") {
          canvas.sendObjectToBack(obj);
        }
      });
    },
    [showGrid],
  );

  const ensureCanvasBorder = useCallback((canvas: FabricCanvas) => {
    // Check if border already exists
    const hasBorder = canvas.getObjects().some((obj: any) => obj._customType === "border");
    if (hasBorder) return;

    // Add border if missing - use CANVAS constants, not canvas dimensions
    const canvasBorder = new Rect({
      left: 0,
      top: 0,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      fill: 'transparent',
      stroke: 'rgba(59, 130, 246, 0.5)',
      strokeWidth: 2,
      selectable: false,
      evented: false,
      excludeFromExport: true,
      hasControls: false,
      hasBorders: false,
      lockMovementX: true,
      lockMovementY: true,
      hoverCursor: 'default',
    });
    (canvasBorder as any)._customType = "border";
    canvas.add(canvasBorder);
    canvas.sendObjectToBack(canvasBorder);
  }, []);

  // Fit canvas to viewport - defined early as it's used by many callbacks
  const fitCanvasToViewport = useCallback(
    (targetCanvas?: FabricCanvas) => {
      const canvasInstance = targetCanvas ?? liveCanvasRef.current;
      if (!canvasInstance || !containerRef.current) return;
      
      // Verificar que el canvas esté completamente inicializado
      // @ts-ignore - verificar propiedad interna de fabric
      if (!canvasInstance.lowerCanvasEl) return;

      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;
      if (containerWidth === 0 || containerHeight === 0) return;

      // Resize the canvas HTML element to match container
      canvasInstance.setWidth(containerWidth);
      canvasInstance.setHeight(containerHeight);

      const scaleX = containerWidth / CANVAS_WIDTH;
      const scaleY = containerHeight / CANVAS_HEIGHT;
      const fitZoom = Math.min(scaleX, scaleY) * ZOOM_CONFIG.FIT_PADDING;

      // Calcular offset para centrar el canvas lógico dentro del contenedor
      const offsetX = (containerWidth - CANVAS_WIDTH * fitZoom) / 2;
      const offsetY = (containerHeight - CANVAS_HEIGHT * fitZoom) / 2;

      // Crear nuevo viewport transform desde cero
      const newVpt: [number, number, number, number, number, number] = [
        fitZoom, 0, 0, fitZoom, offsetX, offsetY
      ];

      canvasInstance.setViewportTransform(newVpt);
      // Solo actualizar store (el estado local ya no existe)
      setStoreZoom(fitZoom);
      setStorePan(offsetX, offsetY);
      canvasInstance.requestRenderAll();
    },
    [setStoreZoom, setStorePan],
  );

  const rebuildCanvasFromSeats = useCallback(
    (seatPayload: RemoteSeatPayload[], options?: { silent?: boolean }) => {
      if (!fabricCanvas) return;

      const removableObjects = fabricCanvas
        .getObjects()
        .filter((obj) => {
          const customType = (obj as CustomFabricObject)._customType;
          return customType !== "grid" && customType !== "border";
        });
      removableObjects.forEach((obj) => fabricCanvas.remove(obj));

      seatPayload.forEach((seat) => {
        const seatObject = createSeatObjectFromPayload(seat);
        fabricCanvas.add(seatObject);
        const label = createSeatLabel(seatObject, seat.name ?? seat.label);
        if (label) {
          fabricCanvas.add(label);
          fabricCanvas.bringObjectToFront(seatObject);
          fabricCanvas.bringObjectToFront(label);
        }
      });

      ensureCanvasBorder(fabricCanvas);
      
      if (showGrid) {
        drawGridLines(fabricCanvas);
      }

      fabricCanvas.requestRenderAll();
      fitCanvasToViewport();
      if (!options?.silent) {
        toast.success("Layout reconstruido desde la base de datos");
      }
      saveHistory();
    },
    [drawGridLines, fabricCanvas, saveHistory, showGrid, ensureCanvasBorder, fitCanvasToViewport],
  );

  const hydrateTablesFromDatabase = useCallback(
    (tables: VenueTableDetail[], seatRows: VenueSeat[]) => {
      if (!fabricCanvas || !tables.length || !seatRows.length) {
        return;
      }

      const existingObjects = fabricCanvas.getObjects() as CustomFabricObject[];
      const existingTableIds = new Set(
        existingObjects
          .filter((obj) => obj._customType === "table" && obj.id)
          .map((obj) => obj.id as string),
      );
      const seatLookup = new Map<string, CustomFabricObject>();
      existingObjects.forEach((obj) => {
        if (obj._customType === "seat" && obj.id) {
          seatLookup.set(obj.id, obj);
        }
      });

      let tablesAdded = 0;

      tables.forEach((table) => {
        if (existingTableIds.has(table.id)) {
          return;
        }

        const relatedSeats = seatRows.filter((seat) => {
          const metadata = seat.metadata as SeatMetadataExtended | null;
          return metadata?.tableId === table.id;
        });

        if (!relatedSeats.length) {
          return;
        }

        const tableMeta = (table.metadata ?? {}) as Record<string, unknown>;
        const shape = typeof table.shape === "string" ? table.shape.toLowerCase() : "circle";
        const fill = typeof tableMeta["fill"] === "string" ? (tableMeta["fill"] as string) : "#f8fafc";
        const stroke = typeof tableMeta["stroke"] === "string" ? (tableMeta["stroke"] as string) : "#0ea5e9";
        const label = typeof tableMeta["label"] === "string"
          ? (tableMeta["label"] as string)
          : typeof tableMeta["name"] === "string"
            ? (tableMeta["name"] as string)
            : table.id;

        let tableFabric: FabricObject;
        if (shape === "rectangle") {
          const width = typeof tableMeta["width"] === "number" ? (tableMeta["width"] as number) : 140;
          const height = typeof tableMeta["height"] === "number" ? (tableMeta["height"] as number) : 80;
          const radius = typeof tableMeta["cornerRadius"] === "number" ? (tableMeta["cornerRadius"] as number) : 8;
          tableFabric = new Rect({
            left: table.centerX - width / 2,
            top: table.centerY - height / 2,
            width,
            height,
            rx: radius,
            ry: radius,
            fill,
            stroke,
            strokeWidth: 2,
          });
        } else {
          const radius = typeof tableMeta["radius"] === "number" ? (tableMeta["radius"] as number) : 50;
          tableFabric = new Circle({
            left: table.centerX - radius,
            top: table.centerY - radius,
            radius,
            fill,
            stroke,
            strokeWidth: 2,
          });
        }

        tableFabric.angle = table.rotation;

        const tableObject = tableFabric as CustomFabricObject;
        tableObject.id = table.id;
        tableObject.name = label;
        tableObject._customType = "table";
        tableObject.tableId = table.id;
        tableObject.zoneId = typeof tableMeta["zoneId"] === "string" ? (tableMeta["zoneId"] as string) : undefined;
        tableObject.attachedSeats = [];
        tableObject.lockRotation = true;
        tableObject.lockScalingX = true;
        tableObject.lockScalingY = true;

        fabricCanvas.add(tableFabric);
        fabricCanvas.sendToBack(tableFabric);
        tablesAdded += 1;

        relatedSeats.forEach((seat) => {
          const seatObj = seatLookup.get(seat.id);
          if (!seatObj) return;
          tableObject.attachedSeats?.push({
            id: seatObj.id!,
            offsetX: (seatObj.left ?? 0) - table.centerX,
            offsetY: (seatObj.top ?? 0) - table.centerY,
          });
          seatObj.tableId = table.id;
        });
      });

      if (tablesAdded > 0) {
        fabricCanvas.requestRenderAll();
        saveHistory();
      }
    },
    [fabricCanvas, saveHistory],
  );

  // REF para evitar múltiples llamadas a applyRemoteLayout
  const isApplyingLayout = useRef(false);

  const applyRemoteLayout = useCallback(
    async (payload?: RemoteLayoutPayload | null, options?: { silent?: boolean }) => {
      if (!fabricCanvas || !payload) return;
      
      // PROTECCIÓN: Evitar múltiples ejecuciones simultáneas
      if (isApplyingLayout.current) {
        console.log('[applyRemoteLayout] Already applying layout, skipping...');
        return;
      }
      isApplyingLayout.current = true;

      const zonesPayload = Array.isArray(payload.zones) ? payload.zones : [];
      const sectionsPayload = Array.isArray(payload.sections) ? payload.sections : [];
      const seatsToCreate = Array.isArray(payload.seats) ? payload.seats : [];

      if (payload.canvas) {
        try {
          // IMPORTANTE: Usar await en lugar de callback para evitar múltiples invocaciones
          // El callback de loadFromJSON en Fabric.js v6 puede dispararse múltiples veces
          await fabricCanvas.loadFromJSON(payload.canvas as any);
          
          // Actualizar estado UNA SOLA VEZ después de que el canvas esté completamente cargado
          setZones(zonesPayload);
          setSections(sectionsPayload);
          
          // Después de cargar el canvas, identificar los grupos (secciones)
          const canvasObjects = fabricCanvas.getObjects() as CustomFabricObject[];
          
          // Los Groups que vienen del JSON son las secciones visuales
          const sectionGroups = canvasObjects.filter(obj => obj.type === 'group' || obj.type === 'Group');
          console.log(`[applyRemoteLayout] Found ${sectionGroups.length} section groups from JSON`);
          
          // Marcar los grupos como secciones y enviarlos al fondo
          sectionGroups.forEach((group) => {
            group._customType = 'section';
            group.selectable = true;
            group.evented = true;
            fabricCanvas.sendObjectToBack(group);
          });
          
          // Helper para encontrar la sección que contiene un punto
          const findSectionForPoint = (x: number, y: number): string | null => {
            for (const section of sectionsPayload) {
              const polygonPoints = section.polygonPoints || section.points;
              if (polygonPoints && polygonPoints.length >= 3) {
                if (isPointInPolygon({ x, y }, polygonPoints)) {
                  return section.id;
                }
              }
            }
            return null;
          };
          
          // IMPORTANTE: Marcar Circle/Rect pequeños como asientos si no tienen _customType
          let markedSeats = 0;
          const usedLabels = new Set<string>();
          const baseTimestamp = Date.now();
          
          // Primero recopilar labels existentes
          canvasObjects.forEach((obj) => {
            if (obj.name) usedLabels.add(obj.name.toString());
          });
          
          canvasObjects.forEach((obj) => {
            if (obj._customType) return; // Ya tiene tipo, no modificar
            
            let isSeat = false;
            
            // Detectar Circle pequeño como asiento
            if (obj.type === "Circle" || obj.type === "circle") {
              const circle = obj as unknown as Circle;
              const radius = circle.radius ?? 0;
              if (radius >= 8 && radius <= 35) {
                isSeat = true;
              }
            }
            
            // Detectar Rect pequeño como asiento
            if (obj.type === "Rect" || obj.type === "rect") {
              const rect = obj as unknown as Rect;
              const width = rect.width ?? 0;
              const height = rect.height ?? 0;
              if (width >= 16 && width <= 70 && height >= 16 && height <= 70) {
                isSeat = true;
              }
            }
            
            if (isSeat) {
              obj.set({
                _customType: 'seat',
                status: obj.status ?? 'available',
                seatType: obj.seatType ?? 'STANDARD',
              });
              
              obj.dirty = true;
              
              if (!obj.id) {
                const newId = `seat-${baseTimestamp}-${markedSeats}`;
                obj.set('id', newId);
              }
              
              if (!obj.name) {
                const x = obj.left ?? 0;
                const y = obj.top ?? 0;
                const row = String.fromCharCode(65 + Math.floor(y / 35) % 26);
                let col = Math.floor(x / 35) + 1;
                let label = `${row}${col}`;
                
                while (usedLabels.has(label)) {
                  col++;
                  label = `${row}${col}`;
                }
                obj.set('name', label);
                usedLabels.add(label);
              }
              
              if (!obj.sectionId && sectionsPayload.length > 0) {
                const sectionId = findSectionForPoint(obj.left ?? 0, obj.top ?? 0);
                if (sectionId) {
                  obj.set('sectionId', sectionId);
                }
              }
              
              markedSeats++;
            }
          });
          
          if (markedSeats > 0) {
            console.log(`[applyRemoteLayout] Marked ${markedSeats} objects as seats with IDs, labels, and sectionIds`);
            fabricCanvas.requestRenderAll();
          }
          
          // Contar asientos existentes en el canvas
          const existingCanvasSeats = canvasObjects.filter(
            obj => obj.get('_customType') === "seat"
          );
          
          console.log(`[applyRemoteLayout] Canvas loaded. Canvas has ${existingCanvasSeats.length} seats, DB has ${seatsToCreate.length} seats`);
          
          // Si el canvas ya tiene asientos visuales, NO crear más desde la DB
          // Los asientos del canvas ya son la representación visual de los datos
          // Solo necesitamos sincronizar los IDs si es posible
          if (existingCanvasSeats.length > 0 && seatsToCreate.length > 0) {
            // Intentar emparejar asientos del canvas con los de la DB por posición
            const tolerance = 5; // píxeles de tolerancia
            let matchedCount = 0;
            
            seatsToCreate.forEach((dbSeat) => {
              const matchingSeat = existingCanvasSeats.find(canvasSeat => {
                const cx = canvasSeat.left ?? 0;
                const cy = canvasSeat.top ?? 0;
                const dx = Math.abs(cx - (dbSeat.x ?? 0));
                const dy = Math.abs(cy - (dbSeat.y ?? 0));
                return dx < tolerance && dy < tolerance;
              });
              
              if (matchingSeat) {
                // Actualizar el asiento del canvas con datos de la DB
                matchingSeat.set({
                  id: dbSeat.id,
                  name: dbSeat.name ?? dbSeat.label,
                  status: dbSeat.status ?? 'available',
                  sectionId: dbSeat.sectionId,
                  zoneId: dbSeat.zoneId,
                });
                matchingSeat.dirty = true;
                matchedCount++;
              }
            });
            
            console.log(`[applyRemoteLayout] Matched ${matchedCount} canvas seats with DB records by position`);
          } else if (seatsToCreate.length > 0 && existingCanvasSeats.length === 0) {
            // Solo crear asientos desde DB si el canvas no tiene ninguno
            console.log(`[applyRemoteLayout] Creating ${seatsToCreate.length} seats from DB (canvas was empty)`);
            seatsToCreate.forEach((seat) => {
              const seatObject = createSeatObjectFromPayload(seat);
              fabricCanvas.add(seatObject);
              const label = createSeatLabel(seatObject, seat.name ?? seat.label);
              if (label) {
                fabricCanvas.add(label);
                fabricCanvas.bringObjectToFront(seatObject);
                fabricCanvas.bringObjectToFront(label);
              }
            });
          }
          
          ensureCanvasBorder(fabricCanvas);
          fabricCanvas.requestRenderAll();
          if (showGrid) {
            drawGridLines(fabricCanvas);
          }
          fitCanvasToViewport();
          
          // Liberar el lock
          isApplyingLayout.current = false;
          
          // Diferir el toast para evitar flushSync
          if (!options?.silent) {
            setTimeout(() => toast.success("Layout cargado"), 0);
          }
          saveHistory();
        } catch (error) {
          console.error('[applyRemoteLayout] Error loading canvas:', error);
          isApplyingLayout.current = false;
        }
        return;
      }

      // Si no hay canvas payload, actualizar estado y liberar el lock
      setZones(zonesPayload);
      setSections(sectionsPayload);
      isApplyingLayout.current = false;

      if (seatsToCreate.length > 0) {
        rebuildCanvasFromSeats(seatsToCreate, options);
        return;
      }

      if (!options?.silent) {
        setTimeout(() => toast.info("No hay datos de layout disponibles"), 0);
      }
    },
    [
      drawGridLines,
      ensureCanvasBorder,
      fabricCanvas,
      rebuildCanvasFromSeats,
      saveHistory,
      showGrid,
      fitCanvasToViewport,
    ],
  );

  const buildZonesForSave = useCallback(() => {
    return zones
      .filter((zone) => zone && zone.id && zone.name) // Filter out invalid zones
      .map((zone) => ({
        id: zone.id,
        name: zone.name,
        color: zone.color,
        price: zone.price,
        capacity: zone.capacity,
        type: zone.type,
        visible: zone.visible,
      }));
  }, [zones]);

  const buildTablesForSave = useCallback(() => {
    if (!fabricCanvas) return [];
    const tableObjects = fabricCanvas.getObjects().filter((obj): obj is CustomFabricObject => {
      return (obj as CustomFabricObject)._customType === "table";
    });

    return tableObjects.map((table) => {
      // Determine shape from fabric object type
      let shape: "circle" | "rectangle" | "square" = "circle";
      if (table.type === "rect") {
        const width = table.getScaledWidth();
        const height = table.getScaledHeight();
        shape = Math.abs(width - height) < 5 ? "square" : "rectangle";
      }

      const baseMetadata = isRecord((table as any).metadata)
        ? ((table as any).metadata as Record<string, unknown>)
        : {};

      return {
        id: table.id,
        shape,
        centerX: table.left ?? 0,
        centerY: table.top ?? 0,
        rotation: table.angle ?? 0,
        seatCount: Array.isArray(table.attachedSeats) ? table.attachedSeats.length : 0,
        zoneId: table.zoneId,
        metadata: {
          ...baseMetadata,
          attachedSeats: table.attachedSeats,
        },
      };
    });
  }, [fabricCanvas]);

  const buildSeatsForSave = useCallback(() => {
    if (!fabricCanvas) return [];
    
    // Helper function to find which section contains a point
    const findSectionForPoint = (x: number, y: number): string | null => {
      for (const section of sections) {
        const polygonPoints = section.polygonPoints || section.points;
        if (polygonPoints && polygonPoints.length >= 3) {
          if (isPointInPolygon({ x, y }, polygonPoints)) {
            return section.id;
          }
        }
      }
      return null;
    };
    
    // Counter for generating unique IDs and labels for seats without them
    let seatCounter = 0;
    const finalLabels = new Map<string, string>(); // seatId -> label
    
    const seatObjects = fabricCanvas.getObjects().filter((obj): obj is CustomFabricObject => {
      const custom = obj as CustomFabricObject;
      // Reconocer como asiento si:
      // 1. Tiene _customType === "seat" (forma explícita) - verificar tanto directo como via get()
      // 2. Es un Circle pequeño (típico asiento: radio 10-30px) sin ser zona/mesa
      // 3. Es un Rect pequeño sin ser zona/mesa
      const customType = custom._customType || custom.get?.('_customType');
      if (customType === "seat") return true;
      if (customType === "zone" || customType === "table" || customType === "section") return false;
      
      // Detectar Circle pequeño como asiento
      if (obj.type === "Circle" || obj.type === "circle") {
        const circle = obj as Circle;
        const radius = circle.radius ?? 0;
        // Asientos típicos tienen radio entre 8 y 35px
        if (radius >= 8 && radius <= 35) {
          // Marcar como seat para futuras operaciones
          obj.set({ _customType: 'seat' });
          obj.dirty = true;
          return true;
        }
      }
      
      // Detectar Rect pequeño como asiento (asientos cuadrados)
      if (obj.type === "Rect" || obj.type === "rect") {
        const rect = obj as Rect;
        const width = rect.width ?? 0;
        const height = rect.height ?? 0;
        // Asientos cuadrados típicos: 16-70px
        if (width >= 16 && width <= 70 && height >= 16 && height <= 70) {
          // Marcar como seat para futuras operaciones
          obj.set({ _customType: 'seat' });
          obj.dirty = true;
          return true;
        }
      }
      
      return false;
    });
    
    // PASO 1: Recopilar todos los labels existentes y detectar duplicados
    const labelCounts = new Map<string, number>();
    const seatLabels = new Map<string, string>(); // objectIndex -> originalLabel
    
    seatObjects.forEach((seat, idx) => {
      let label = (seat.name || seat.get?.('name'))?.toString().trim() || '';
      if (label) {
        labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
        seatLabels.set(String(idx), label);
      }
    });
    
    // PASO 2: Asignar labels únicos
    const usedLabels = new Set<string>();
    let uniqueCounter = 1;
    
    seatObjects.forEach((seat, idx) => {
      let seatId = seat.id || seat.get?.('id');
      if (!seatId) {
        seatId = `seat-${Date.now()}-${seatCounter++}`;
        seat.set('id', seatId);
        seat.dirty = true;
      }
      
      let label = seatLabels.get(String(idx)) || '';
      
      // Si no hay label o es duplicado, generar uno nuevo
      if (!label || labelCounts.get(label)! > 1 || usedLabels.has(label)) {
        // Generar label único basado en posición
        const row = String.fromCharCode(65 + Math.floor((seat.top ?? 0) / 40) % 26);
        let col = Math.floor((seat.left ?? 0) / 40) + 1;
        label = `${row}${col}`;
        
        while (usedLabels.has(label)) {
          col++;
          label = `${row}${col}`;
          if (col > 1000) {
            // Fallback: usar ID como label
            label = `S${uniqueCounter++}`;
            break;
          }
        }
        seat.set('name', label);
        seat.dirty = true;
      }
      
      usedLabels.add(label);
      finalLabels.set(seatId, label);
    });
    
    console.log(`[buildSeatsForSave] Total seats: ${seatObjects.length}, Unique labels: ${usedLabels.size}`);

    return seatObjects.map((seat) => {
      // El ID y label ya fueron asignados en el forEach anterior
      const seatId = seat.id || seat.get?.('id');
      const label = finalLabels.get(seatId) || (seat.name || seat.get?.('name'))?.toString().trim() || seatId;
      
      const { rowLabel, columnNumber } = parseSeatLabel(label);
      const position = {
        x: seat.left ?? 0,
        y: seat.top ?? 0,
        angle: seat.angle ?? 0,
      };
      const size = {
        width: seat.getScaledWidth(),
        height: seat.getScaledHeight(),
      };

      const baseMetadata = isRecord((seat as any).metadata)
        ? ((seat as any).metadata as Record<string, unknown>)
        : {};
      const canvasMeta = isRecord(baseMetadata.canvas)
        ? ({ ...(baseMetadata.canvas as Record<string, unknown>) })
        : {};

      canvasMeta.shape = seat.type;
      canvasMeta.position = position;
      canvasMeta.size = size;
      canvasMeta.label = label;
      if (seat.fill) canvasMeta.fill = seat.fill;
      if (seat.stroke) canvasMeta.stroke = seat.stroke;
      if ("radius" in seat && typeof (seat as Circle).radius === "number") {
        canvasMeta.radius = (seat as Circle).radius;
      }
      if ("rx" in seat && typeof (seat as Rect).rx === "number") {
        canvasMeta.cornerRadius = (seat as Rect).rx;
      }

      const metadata: Record<string, unknown> = {
        ...baseMetadata,
        canvas: canvasMeta,
      };

      if (seat.tableId) {
        metadata.tableId = seat.tableId;
      }

      // IMPORTANTE: Determinar sectionId automáticamente basado en la posición
      // Si el asiento ya tiene sectionId, usarlo. Si no, calcularlo del polígono de sección.
      let sectionId = seat.sectionId || seat.get?.('sectionId') || (baseMetadata.sectionId as string | undefined);
      if (!sectionId && sections.length > 0) {
        sectionId = findSectionForPoint(position.x, position.y) ?? undefined;
      }
      
      if (sectionId) {
        metadata.sectionId = sectionId;
        seat.set('sectionId', sectionId);
        seat.dirty = true;
      }

      // Obtener propiedades usando get() para compatibilidad con Fabric.js
      const seatType = seat.seatType || seat.get?.('seatType') || "STANDARD";
      const status = seat.status ?? seat.get?.('status') ?? "available";
      const zoneId = seat.zoneId || seat.get?.('zoneId');
      const price = seat.price || seat.get?.('price');
      const tableId = seat.tableId || seat.get?.('tableId');

      return {
        id: seatId,
        label,
        name: label,
        rowLabel,
        columnNumber,
        zoneId,
        sectionId, // IMPORTANTE: Incluir sectionId a nivel raíz para el backend
        seatType,
        status,
        price,
        tableId,
        position,
        size,
        metadata,
      };
    });
  }, [fabricCanvas, sections]);

  const findObjectById = useCallback(
    (objectId: string) => {
      if (!fabricCanvas) return undefined;
      return fabricCanvas
        .getObjects()
        .find((obj) => (obj as CustomFabricObject).id === objectId) as CustomFabricObject | undefined;
    },
    [fabricCanvas],
  );

  const syncTableSeats = useCallback(
    (tableObj: CustomFabricObject) => {
      if (!fabricCanvas || !Array.isArray(tableObj.attachedSeats)) return;
      const center = tableObj.getCenterPoint();
      tableObj.attachedSeats.forEach((seatMeta) => {
        const seat = findObjectById(seatMeta.id);
        if (!seat) return;
        seat.set({
          left: center.x + seatMeta.offsetX,
          top: center.y + seatMeta.offsetY,
        });
        seat.setCoords();
      });
      fabricCanvas.requestRenderAll();
    },
    [fabricCanvas, findObjectById],
  );

  const updateTableSeatOffsets = useCallback(
    (tableObj: CustomFabricObject) => {
      if (!fabricCanvas || !Array.isArray(tableObj.attachedSeats)) return;
      const center = tableObj.getCenterPoint();
      tableObj.attachedSeats = tableObj.attachedSeats.map((seatMeta) => {
        const seat = findObjectById(seatMeta.id);
        if (!seat) return seatMeta;
        return {
          id: seatMeta.id,
          offsetX: (seat.left ?? 0) - center.x,
          offsetY: (seat.top ?? 0) - center.y,
        };
      });
    },
    [fabricCanvas, findObjectById],
  );

  const getViewportCenter = useCallback(() => {
    if (!fabricCanvas) return { x: 0, y: 0 };
    const vpt = fabricCanvas.viewportTransform || [1, 0, 0, 1, 0, 0];
    const zoom = fabricCanvas.getZoom();
    const centerX = (fabricCanvas.width / 2 - vpt[4]) / zoom;
    const centerY = (fabricCanvas.height / 2 - vpt[5]) / zoom;
    return { x: centerX, y: centerY };
  }, [fabricCanvas]);

  const findObjectByIdRef = useRef(findObjectById);
  useEffect(() => {
    findObjectByIdRef.current = findObjectById;
  }, [findObjectById]);

  const syncTableSeatsRef = useRef(syncTableSeats);
  useEffect(() => {
    syncTableSeatsRef.current = syncTableSeats;
  }, [syncTableSeats]);

  const updateTableSeatOffsetsRef = useRef(updateTableSeatOffsets);
  useEffect(() => {
    updateTableSeatOffsetsRef.current = updateTableSeatOffsets;
  }, [updateTableSeatOffsets]);

  // Inicialización del Canvas
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: "#ffffff",
      selection: true,
      preserveObjectStacking: true,
      // Configuración para selección múltiple
      selectionColor: 'rgba(100, 100, 255, 0.3)',
      selectionBorderColor: 'rgba(100, 100, 255, 0.8)',
      selectionLineWidth: 1,
      selectionFullyContained: false, // Permite seleccionar objetos que tocan el área de selección
    });
    
    // Add border to canvas for better visibility
    const canvasBorder = new Rect({
      left: 0,
      top: 0,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      fill: 'transparent',
      stroke: 'rgba(59, 130, 246, 0.5)',
      strokeWidth: 2,
      selectable: false,
      evented: false,
      excludeFromExport: true,
      hasControls: false,
      hasBorders: false,
      lockMovementX: true,
      lockMovementY: true,
      hoverCursor: 'default',
    });
    (canvasBorder as any)._customType = "border";
    canvas.add(canvasBorder);
    canvas.sendObjectToBack(canvasBorder);

    const handleSelection = () => {
        const allSelected = canvas.getActiveObjects() as CustomFabricObject[];
        // Filter out non-selectable objects (border, grid) but keep background-image
        const filteredSelection = allSelected.filter(obj => 
          obj._customType !== "border" && 
          obj._customType !== "canvas-border" && 
          obj._customType !== "grid"
        );
        
        // If we filtered out some objects, update the active selection
        if (filteredSelection.length !== allSelected.length) {
          canvas.discardActiveObject();
          if (filteredSelection.length > 0) {
            if (filteredSelection.length === 1) {
              canvas.setActiveObject(filteredSelection[0]);
            } else {
              const sel = new ActiveSelection(filteredSelection, { canvas });
              canvas.setActiveObject(sel);
            }
          }
          canvas.requestRenderAll();
        }
        
        setSelectedObjects(filteredSelection || []);
    };

    canvas.on("selection:created", handleSelection);
    canvas.on("selection:updated", handleSelection);
    canvas.on("selection:cleared", () => setSelectedObjects([]));

    // Double-click to inspect seat or rename zone
    canvas.on("mouse:dblclick", (e) => {
      const target = e.target as CustomFabricObject;
      if (!target) return;
      
      // Si es un asiento, abrir inspector
      if (target._customType === "seat" && target.id && target.name) {
        const metadata = (target as any).metadata || {};
        const addOns = metadata.addOns || [];
        setInspectedSeat({ id: target.id, label: target.name, addOns });
        setShowSeatInspector(true);
        return;
      }
      
      // Solo abrir modal para ZONAS (no mesas ni asientos)
      // Las zonas tienen _customType === "zone" y zoneId
      if (target._customType === "zone" && target.zoneId) {
        const zone = zonesRef.current.find(z => z.id === target.zoneId);
        if (zone) {
          setZoneToRename({ id: zone.id, name: zone.name, color: zone.color });
          setZoneNewName(zone.name);
          setShowZoneRenameModal(true);
        }
      }
    });

    // Mouse wheel zoom - usando listeners directos (no Fabric.js)
    // Fabric.js no captura correctamente los wheel events
    // Se manejan en el useEffect de inicialización con listeners directos

    // IMPORTANTE: Usar mouse:down:before para interceptar ANTES de que Fabric procese el evento
    // Esto evita que se seleccionen objetos cuando estamos en modo hand
    canvas.on("mouse:down:before", (opt) => {
      const evt = opt.e;
      // Si estamos en modo hand o se presiona Alt, prevenir la selección de objetos
      if (activeToolRef.current === "hand" || evt.altKey) {
        // Prevenir que Fabric.js procese este evento para selección
        opt.e.preventDefault();
        // Indicar a Fabric que no debe buscar target (objeto a seleccionar)
        (opt as any).subTargets = [];
        (opt as any).target = null;
      }
    });

    canvas.on("mouse:down", (opt) => {
      const evt = opt.e;
      // Solo iniciar pan si la herramienta es 'hand' o se presiona Alt
      if (activeToolRef.current === "hand" || evt.altKey) {
        isDraggingRef.current = true;
        lastPosXRef.current = evt.clientX;
        lastPosYRef.current = evt.clientY;
        canvas.defaultCursor = 'grabbing';
        canvas.hoverCursor = 'grabbing';
        // Deseleccionar cualquier objeto que pudiera estar seleccionado
        canvas.discardActiveObject();
        canvas.requestRenderAll();
      }
    });

    canvas.on("object:modified", (opt) => {
      const target = opt.target as CustomFabricObject | undefined;
      if (target?._customType === "seat" && target.tableId) {
        const table = findObjectByIdRef.current?.(target.tableId);
        if (table) {
          updateTableSeatOffsetsRef.current?.(table);
        }
      }
      if (target?._customType === "table") {
        syncTableSeatsRef.current?.(target);
        updateTableSeatOffsetsRef.current?.(target);
      }
      saveHistory();
      updateCanvasVersion();
    });
    
    // Listeners para actualizar estadísticas cuando se agregan/eliminan objetos
    canvas.on("object:added", () => {
      updateCanvasVersion();
    });
    
    canvas.on("object:removed", () => {
      updateCanvasVersion();
    });
    
    // Snapping Logic
    canvas.on('object:moving', (options) => {
        const target = options.target;
        if (!target) return;
      
      const allObjects = canvas.getObjects();
      
      // Función para mover el label de un asiento
      const moveSeatLabel = (seat: CustomFabricObject, absoluteCoords?: { left: number; top: number }) => {
        if (seat._customType !== "seat" || !seat.id) return;
        
        // Buscar el label de varias formas:
        // 1. Por linkedSeatId (nuevo sistema)
        let label = allObjects.find((obj: any) => 
          obj._customType === "seat-label" && obj.linkedSeatId === seat.id
        );
        
        // 2. Por linkedLabelId en el asiento
        if (!label) {
          label = (seat as any).linkedLabelId;
        }
        
        // 3. Por texto que coincida con el nombre del asiento
        if (!label && seat.name) {
          label = allObjects.find((obj: any) => {
            if (!obj.text) return false;
            return obj.text === seat.name;
          });
        }
        
        // 4. Buscar por proximidad (label cerca del asiento en posición original)
        if (!label && seat.name) {
          const seatCenter = seat.getCenterPoint();
          label = allObjects.find((obj: any) => {
            if (!obj.text || obj._customType === "seat-label") return false;
            // Buscar label dentro de 20px del centro del asiento
            const labelCenter = obj.getCenterPoint();
            const distance = Math.sqrt(
              Math.pow(labelCenter.x - seatCenter.x, 2) + 
              Math.pow(labelCenter.y - seatCenter.y, 2)
            );
            return distance < 20;
          });
        }
        
        // Si encontramos un label, vincularlo permanentemente
        if (label && !(label as any).linkedSeatId) {
          (label as any).linkedSeatId = seat.id;
          (label as any)._customType = "seat-label";
          (seat as any).linkedLabelId = label;
        }
        
        if (label) {
          // Usar coordenadas absolutas si se proporcionan, sino calcular del asiento
          let centerX: number, centerY: number;
          
          if (absoluteCoords) {
            // Para objetos en una selección, usar las coordenadas absolutas calculadas
            const radius = (seat.radius || seat.width / 2 || 14);
            centerX = absoluteCoords.left + radius;
            centerY = absoluteCoords.top + radius;
          } else {
            // Para objetos individuales
            const bounds = seat.getBoundingRect(true, true);
            centerX = bounds.left + bounds.width / 2;
            centerY = bounds.top + bounds.height / 2;
          }
          
          label.set({ left: centerX, top: centerY });
          label.setCoords();
        }
      };
      
      const customTarget = target as CustomFabricObject;
      
      // Si es una selección múltiple (ActiveSelection), mover labels de todos los asientos
      if (target.type === 'activeselection' || target.type === 'activeSelection') {
        const selection = target as any;
        if (selection._objects) {
          // Calcular la matriz de transformación del grupo
          const groupMatrix = selection.calcTransformMatrix();
          
          selection._objects.forEach((obj: CustomFabricObject) => {
            if (obj._customType === "seat") {
              // Calcular posición absoluta del objeto dentro del grupo
              const objLeft = obj.left || 0;
              const objTop = obj.top || 0;
              
              // Transformar coordenadas locales a absolutas
              const point = util.transformPoint(
                new Point(objLeft, objTop), 
                groupMatrix
              );
              
              moveSeatLabel(obj, { left: point.x, top: point.y });
            }
          });
        }
      } else {
        // Objeto individual
        moveSeatLabel(customTarget);
      }
      
      if (customTarget._customType === "table") {
        syncTableSeatsRef.current?.(customTarget);
      }
        
        // Limpiar guías previas de manera más eficiente
        const guides = canvas.getObjects().filter((obj: any) => obj._customType === 'guide');
        guides.forEach(guide => canvas.remove(guide));

        const w = target.width * target.scaleX;
        const h = target.height * target.scaleY;
        const center = target.getCenterPoint();

        const targetPoints = {
            left: target.left,
            right: target.left + w,
            top: target.top,
            bottom: target.top + h,
            centerX: center.x,
            centerY: center.y
        };

        canvas.getObjects().forEach((obj: any) => {
            if (obj === target || obj._customType === 'guide' || obj._customType === 'grid' || !obj.visible) return;

            const objW = obj.width * obj.scaleX;
            const objH = obj.height * obj.scaleY;
            const objCenter = obj.getCenterPoint();
            const objPoints = {
                left: obj.left,
                right: obj.left + objW,
                top: obj.top,
                bottom: obj.top + objH,
                centerX: objCenter.x,
                centerY: objCenter.y
            };

            if (Math.abs(targetPoints.left - objPoints.left) < SNAP_THRESHOLD) {
                target.set('left', objPoints.left);
                drawGuide(targetPoints.left, null, 'vertical');
            }
            if (Math.abs(targetPoints.left - objPoints.right) < SNAP_THRESHOLD) {
                target.set('left', objPoints.right);
                drawGuide(targetPoints.left, null, 'vertical');
            }
            if (Math.abs(targetPoints.top - objPoints.top) < SNAP_THRESHOLD) {
                target.set('top', objPoints.top);
                drawGuide(null, targetPoints.top, 'horizontal');
            }
            if (Math.abs(targetPoints.top - objPoints.bottom) < SNAP_THRESHOLD) {
                target.set('top', objPoints.bottom);
                drawGuide(null, targetPoints.top, 'horizontal');
            }
        });
        
        function drawGuide(x: number | null, y: number | null, type: 'vertical' | 'horizontal') {
            if (type === 'vertical' && x !== null) {
                const line = new Line([x, 0, x, canvas.height], { stroke: 'red', strokeDashArray: [5, 5], selectable: false, evented: false });
                (line as CustomFabricObject)._customType = 'guide';
                canvas.add(line);
            } else if (type === 'horizontal' && y !== null) {
                const line = new Line([0, y, canvas.width, y], { stroke: 'red', strokeDashArray: [5, 5], selectable: false, evented: false });
                (line as CustomFabricObject)._customType = 'guide';
                canvas.add(line);
            }
        }
    });

    canvas.on('mouse:up', () => {
        // Limpiar todas las guías de snapping
        const guides = canvas.getObjects().filter((obj: any) => obj._customType === 'guide');
        guides.forEach(guide => canvas.remove(guide));
        
        if (isDraggingRef.current) {
            isDraggingRef.current = false;
            // Restaurar cursor según la herramienta activa
            if (activeToolRef.current === 'hand') {
                canvas.defaultCursor = 'grab';
                canvas.hoverCursor = 'grab';
            } else {
                canvas.defaultCursor = 'default';
                canvas.hoverCursor = 'move';
            }
            canvas.requestRenderAll();
        } else {
            saveHistory();
        }
    });

    canvas.on("object:removed", (opt) => {
      const target = opt.target as CustomFabricObject | undefined;
      if (!target) return;

      if (target._customType === "seat" && target.tableId) {
        const table = findObjectByIdRef.current?.(target.tableId);
        if (table?.attachedSeats) {
          table.attachedSeats = table.attachedSeats.filter((seatMeta) => seatMeta.id !== target.id);
        }
      }

      if (target._customType === "table" && Array.isArray(target.attachedSeats)) {
        target.attachedSeats.forEach(({ id }) => {
          const seat = findObjectByIdRef.current?.(id);
          if (seat) {
            canvas.remove(seat);
          }
        });
      }
    });

    canvas.on("mouse:move", (opt) => {
      const e = opt.e;
      // Pan solo si está en modo hand o se presiona Alt Y isDragging es true
      if (isDraggingRef.current && (activeToolRef.current === "hand" || e.altKey)) {
        const vpt = canvas.viewportTransform;
        if (vpt) {
          // Calcular delta del movimiento
          const deltaX = e.clientX - (lastPosXRef.current || e.clientX);
          const deltaY = e.clientY - (lastPosYRef.current || e.clientY);
          
          // Aplicar delta al viewport
          vpt[4] += deltaX;
          vpt[5] += deltaY;
          
          // Limitar viewport para que el canvas no se pierda
          const container = containerRef.current;
          if (container) {
            const zoom = canvas.getZoom();
            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;
            const contentWidth = CANVAS_WIDTH * zoom;
            const contentHeight = CANVAS_HEIGHT * zoom;
            const overscroll = 0.2; // 20% de overscroll permitido para pan
            
            let minX: number, maxX: number, minY: number, maxY: number;
            
            if (contentWidth <= containerWidth) {
              // Si el contenido es más pequeño, limitar al centro ± margen
              const center = (containerWidth - contentWidth) / 2;
              minX = center - containerWidth * overscroll;
              maxX = center + containerWidth * overscroll;
            } else {
              minX = containerWidth - contentWidth * (1 + overscroll);
              maxX = contentWidth * overscroll;
            }
            
            if (contentHeight <= containerHeight) {
              const center = (containerHeight - contentHeight) / 2;
              minY = center - containerHeight * overscroll;
              maxY = center + containerHeight * overscroll;
            } else {
              minY = containerHeight - contentHeight * (1 + overscroll);
              maxY = contentHeight * overscroll;
            }
            
            // Aplicar límites
            vpt[4] = Math.min(maxX, Math.max(minX, vpt[4]));
            vpt[5] = Math.min(maxY, Math.max(minY, vpt[5]));
          }
          
          // Actualizar viewport
          canvas.setViewportTransform(vpt);
          
          // Guardar posición actual para el siguiente frame
          lastPosXRef.current = e.clientX;
          lastPosYRef.current = e.clientY;
        }
      }
    });

    liveCanvasRef.current = canvas;
    setFabricCanvas(canvas);
    
    // Sincronizar con stores de Zustand
    setStoreFabricCanvas(canvas);
    if (containerRef.current) {
      setStoreContainerRef(containerRef.current);
    }
    
    setTimeout(() => saveHistory(), 100); 

    const handleResize = () => {
      fitCanvasToViewport(canvas);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);
    window.addEventListener("resize", handleResize);
    
    // ========================================
    // ZOOM & PAN - Implementación DIRECTA y simple
    // ========================================
    const container = containerRef.current;
    
    // WHEEL ZOOM - Directamente en el canvas con limitación de viewport
    const handleWheelZoom = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Usar canvas directamente (NO el state)
      const currentZoom = canvas.getZoom();
      const direction = e.deltaY < 0 ? 1 : -1;
      const zoomFactor = ZOOM_CONFIG.WHEEL_FACTOR; // Usar constante centralizada
      const newZoom = direction > 0 
        ? Math.min(currentZoom * zoomFactor, ZOOM_CONFIG.MAX) 
        : Math.max(currentZoom / zoomFactor, ZOOM_CONFIG.MIN);
      
      // Zoom al punto del cursor
      const point = new Point(e.offsetX, e.offsetY);
      canvas.zoomToPoint(point, newZoom);
      
      // Limitar viewport para que el canvas no se "pierda"
      limitViewportAfterZoom(canvas, containerRef.current);
      
      // Actualizar store (el estado local ya no existe)
      setStoreZoom(newZoom);
      
      canvas.requestRenderAll();
    };
    
    // Función helper para limitar viewport
    function limitViewportAfterZoom(canvasInstance: FabricCanvas, container: HTMLDivElement | null) {
      if (!canvasInstance || !container) return;
      
      const vpt = canvasInstance.viewportTransform;
      if (!vpt) return;
      
      const zoom = canvasInstance.getZoom();
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const contentWidth = CANVAS_WIDTH * zoom;
      const contentHeight = CANVAS_HEIGHT * zoom;
      
      const overscroll = 0.1; // 10% overscroll permitido
      
      let minX: number, maxX: number, minY: number, maxY: number;
      
      // Si el contenido es más pequeño que el container, centrar
      if (contentWidth <= containerWidth) {
        minX = maxX = (containerWidth - contentWidth) / 2;
      } else {
        minX = containerWidth - contentWidth * (1 + overscroll);
        maxX = contentWidth * overscroll;
      }
      
      if (contentHeight <= containerHeight) {
        minY = maxY = (containerHeight - contentHeight) / 2;
      } else {
        minY = containerHeight - contentHeight * (1 + overscroll);
        maxY = contentHeight * overscroll;
      }
      
      // Aplicar límites
      const newX = Math.min(maxX, Math.max(minX, vpt[4]));
      const newY = Math.min(maxY, Math.max(minY, vpt[5]));
      
      if (vpt[4] !== newX || vpt[5] !== newY) {
        vpt[4] = newX;
        vpt[5] = newY;
        canvasInstance.setViewportTransform(vpt);
      }
    };
    
    // Agregar listener al canvas HTML element
    const canvasEl = canvas.getElement();
    if (canvasEl) {
      canvasEl.addEventListener('wheel', handleWheelZoom, { passive: false });
    }
    
    // También al container por si acaso
    if (container) {
      container.addEventListener('wheel', handleWheelZoom, { passive: false });
    }
    
    // Delay inicial para asegurar que el contenedor tenga dimensiones
    requestAnimationFrame(() => {
      handleResize();
    });

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
      
      // Limpiar event listeners
      if (canvasEl) {
        canvasEl.removeEventListener('wheel', handleWheelZoom);
      }
      if (container) {
        container.removeEventListener('wheel', handleWheelZoom);
      }
      
      canvas.dispose();
      liveCanvasRef.current = null;
      setFabricCanvas(null);
      setStoreFabricCanvas(null);
    };
  }, []); 

  useEffect(() => {
    if (fabricCanvas) {
      drawGridLines(fabricCanvas);
      fabricCanvas.requestRenderAll();
      // Actualizar estadísticas cuando el canvas está listo
      setTimeout(() => updateCanvasVersion(), 200);
    }
  }, [fabricCanvas, drawGridLines, updateCanvasVersion]); 

  useEffect(() => {
    // IMPORTANTE: Verificar hasSyncedRemoteLayout ANTES de hacer cualquier cosa
    // para evitar loops infinitos
    if (!fabricCanvas || !venueLayout || hasSyncedRemoteLayout.current) return;

    // Marcar como sincronizado INMEDIATAMENTE para evitar re-ejecuciones
    hasSyncedRemoteLayout.current = true;

    const syncLayout = async () => {
      // Store version from layout
      setCurrentLayoutVersion(venueLayout.version ?? 1);

      console.log("[Canvas] venueLayout received:", {
        id: venueLayout.id,
        version: venueLayout.version,
        hasLayoutJson: !!venueLayout.layoutJson,
        layoutJsonKeys: venueLayout.layoutJson ? Object.keys(venueLayout.layoutJson) : [],
        zonesCount: venueLayout.zones?.length,
        seatsCount: venueLayout.seats?.length,
      });

      const payload = buildRemotePayloadFromLayout(venueLayout);
      console.log("[Canvas] Built payload:", {
        hasCanvas: !!payload?.canvas,
        canvasObjectsCount: (payload?.canvas as any)?.objects?.length,
        zonesCount: payload?.zones?.length,
        seatsCount: payload?.seats?.length,
      });

      if (!payload) {
        // Fallback: reconstruct from zones/seats if layoutJson is empty
        const zones = venueLayout.zones.map(mapZoneFromDb);
        const seats = venueLayout.seats.map(mapSeatFromDb);
        setZones(zones);

        if (seats.length > 0) {
          rebuildCanvasFromSeats(seats, { silent: true });
          if (isRemoteSession) {
            const tables = await fetchTablesForVenue();
            if (tables.length) {
              hydrateTablesFromDatabase(tables, venueLayout.seats);
            }
          }
        } else {
          toast.info("No hay datos de layout disponibles");
        }
      } else {
        applyRemoteLayout(payload);
      }
      
      // Actualizar estadísticas después de cargar el layout
      setTimeout(() => updateCanvasVersion(), 100);
    };

    syncLayout();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fabricCanvas, venueLayout]);

  // Tool Mode Effect - Controla el comportamiento según la herramienta activa
  useEffect(() => {
    if (!fabricCanvas) return;
    
    // Deshabilitar modo dibujo
    fabricCanvas.isDrawingMode = false;
    
    // Si la herramienta es 'hand', deshabilitar selección completamente
    if (activeTool === 'hand') {
      fabricCanvas.selection = false; // Deshabilitar selección de múltiples objetos
      fabricCanvas.defaultCursor = 'grab';
      fabricCanvas.hoverCursor = 'grab';
      
      // Hacer todos los objetos no seleccionables temporalmente
      fabricCanvas.forEachObject((obj: any) => {
        obj.selectable = false;
        obj.evented = false;
      });
    } else {
      fabricCanvas.selection = true;
      fabricCanvas.defaultCursor = 'default';
      fabricCanvas.hoverCursor = 'move';
      
      // Restaurar la seleccionabilidad de los objetos (excepto grid, guide, border)
      fabricCanvas.forEachObject((obj: any) => {
        const nonSelectableTypes = ['grid', 'guide', 'border', 'canvas-border'];
        if (!nonSelectableTypes.includes(obj._customType)) {
          obj.selectable = true;
          obj.evented = true;
        }
      });
    }
    
    fabricCanvas.requestRenderAll();
  }, [activeTool, fabricCanvas]);

  // MEJORA: Forzar previewMode cuando estamos en modo evento
  // En modo evento solo se gestionan estados de asientos, no se edita el layout
  useEffect(() => {
    if (isEventMode && !previewMode) {
      setPreviewMode(true);
    }
  }, [isEventMode, previewMode]);

  // Preview Mode Effect - Bloquea la edición
  useEffect(() => {
    if (!fabricCanvas) return;
    
    // Determinar si estamos en modo solo lectura (previewMode O isEventMode)
    const isReadOnly = previewMode || isEventMode;
    
    const objects = fabricCanvas.getObjects() as CustomFabricObject[];
    objects.forEach(obj => {
      // No modificar grid, guides, o border
      if (obj._customType !== 'grid' && obj._customType !== 'guide' && obj._customType !== 'border' && obj._customType !== 'canvas-border') {
        obj.set({
          selectable: !isReadOnly,
          evented: !isReadOnly,
          hasControls: !isReadOnly,
          hasBorders: !isReadOnly,
          lockMovementX: isReadOnly,
          lockMovementY: isReadOnly,
          lockRotation: isReadOnly,
          lockScalingX: isReadOnly,
          lockScalingY: isReadOnly,
          hoverCursor: isReadOnly ? 'default' : 'move'
        });
      }
    });
    
    fabricCanvas.requestRenderAll();
    
    if (isReadOnly) {
      fabricCanvas.discardActiveObject();
      setActiveTool("hand");
      // Mensaje diferente según el modo
      if (isEventMode) {
        toast.info("Modo evento: Solo gestión de estados de asientos", { id: 'event-mode' });
      } else {
        toast.info("Modo previsualización activado - Solo lectura");
      }
    } else {
      setActiveTool("select");
      toast.info("Modo edición activado");
    }
  }, [previewMode, fabricCanvas, isEventMode]);

  // Polygon Line Guide Effect (also works for section tool)
  useEffect(() => {
    if (!fabricCanvas) return;
    const handleMouseMove = (opt: any) => {
        if ((activeTool === "polygon" || activeTool === "section") && polygonPoints.length > 0) {
            const pointer = fabricCanvas.getScenePoint(opt.e);
            const lastPoint = polygonPoints[polygonPoints.length - 1];
            if (guideLine) {
                guideLine.set({ x2: pointer.x, y2: pointer.y });
                fabricCanvas.requestRenderAll();
            } else {
                const newLine = new Line([lastPoint.x, lastPoint.y, pointer.x, pointer.y], {
                    stroke: activeColor, strokeWidth: 1, strokeDashArray: [5, 5], selectable: false, evented: false, opacity: 0.7
                });
                fabricCanvas.add(newLine);
                setGuideLine(newLine);
                fabricCanvas.requestRenderAll();
            }
        }
    };
    fabricCanvas.on("mouse:move", handleMouseMove);
    return () => { fabricCanvas.off("mouse:move", handleMouseMove); };
  }, [fabricCanvas, activeTool, polygonPoints, guideLine, activeColor]);

  // Polygon & Section & Keyboard Logic (Incluye Atajos de teclado)
  useEffect(() => {
    if (!fabricCanvas) return;

    const isDrawingTool = activeTool === "polygon" || activeTool === "section";

    const handleCanvasClick = (opt: any) => {
      if (!isDrawingTool) return;
      if (isDragging || opt.e.altKey) return;
      
      const pointer = fabricCanvas.getScenePoint(opt.e);
      if (polygonPoints.length > 2) {
        const start = polygonPoints[0];
        const dist = Math.sqrt(Math.pow(pointer.x - start.x, 2) + Math.pow(pointer.y - start.y, 2));
        if (dist < 20) { 
          if (activeTool === "section") {
            finishSection(polygonPoints);
          } else {
            finishPolygon(polygonPoints);
          }
          return; 
        }
      }

      if (polygonPoints.length > 0) {
          const lastPoint = polygonPoints[polygonPoints.length - 1];
          const line = new Line([lastPoint.x, lastPoint.y, pointer.x, pointer.y], {
              stroke: activeColor, strokeWidth: 2, selectable: false, evented: false
          });
          (line as any).id = 'temp-poly-line'; 
          fabricCanvas.add(line);
      }

      const points = [...polygonPoints, { x: pointer.x, y: pointer.y }];
      setPolygonPoints(points);
      
      const circle = new Circle({ left: pointer.x - 4, top: pointer.y - 4, radius: 4, fill: "transparent", stroke: activeColor, strokeWidth: 2, selectable: false, evented: false });
      fabricCanvas.add(circle);
      
      if (guideLine) { fabricCanvas.remove(guideLine); setGuideLine(null); }
    };

    const finishPolygon = (points: {x: number, y: number}[]) => {
        const zoneId = `zone-${Date.now()}`;
        const polygon = new Polygon(points, { fill: activeColor + "80", stroke: activeColor, strokeWidth: 2, objectCaching: false });
        const labels = points.map((point, index) => {
            const nextPoint = points[(index + 1) % points.length];
            const midX = (point.x + nextPoint.x) / 2;
            const midY = (point.y + nextPoint.y) / 2;
            return new IText(`${index + 1}`, { left: midX, top: midY, fontSize: 14, fontWeight: 'bold', fill: "#ffffff", backgroundColor: "#00000080", fontFamily: "Arial", originX: 'center', originY: 'center', selectable: false, evented: false });
        });
        const group = new Group([polygon, ...labels], { objectCaching: false, subTargetCheck: true });
        (group as CustomFabricObject).id = `poly-group-${Date.now()}`;
        (group as CustomFabricObject).zoneId = zoneId;
        (group as CustomFabricObject).name = `Zona ${zones.length + 1}`;
        (group as CustomFabricObject)._customType = "zone";
        
        cleanupTempObjects();
        
        fabricCanvas.add(group);
        fabricCanvas.setActiveObject(group);
        fabricCanvas.renderAll();
        setZones(prev => [...prev, { id: zoneId, name: `Zona Personalizada ${zones.length + 1}`, color: activeColor, type: "custom", visible: true }]);
        setPolygonPoints([]);
        setActiveTool("select");
        toast.success("Zona creada");
        saveHistory();
    };

    const finishSection = (points: {x: number, y: number}[]) => {
        const sectionId = `section-${Date.now()}`;
        const sectionNumber = sections.length + 1;
        const sectionName = `Sección ${sectionNumber}`;
        
        // Calculate center for label
        const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
        
        // Create polygon with distinctive section styling
        const polygon = new Polygon(points, { 
          fill: activeColor + "60", 
          stroke: activeColor, 
          strokeWidth: 3, 
          objectCaching: false,
          strokeDashArray: undefined // solid line for sections
        });
        
        // Create section name label
        const nameLabel = new IText(sectionName, { 
          left: centerX, 
          top: centerY, 
          fontSize: 18, 
          fontWeight: 'bold', 
          fill: "#ffffff", 
          stroke: "#00000080",
          strokeWidth: 2,
          fontFamily: "Arial", 
          originX: 'center', 
          originY: 'center', 
          selectable: false, 
          evented: false,
          shadow: "2px 2px 4px rgba(0,0,0,0.5)"
        });
        
        const group = new Group([polygon, nameLabel], { objectCaching: false, subTargetCheck: true });
        (group as CustomFabricObject).id = sectionId;
        (group as CustomFabricObject).name = sectionName;
        (group as CustomFabricObject)._customType = "section";
        
        cleanupTempObjects();
        
        fabricCanvas.add(group);
        fabricCanvas.setActiveObject(group);
        fabricCanvas.renderAll();
        
        // Create section data
        const newSection: SectionData = {
          id: sectionId,
          name: sectionName,
          description: "",
          color: activeColor,
          polygonPoints: points,
          points: points, // Also store as points for seat generation
          labelPosition: { x: centerX, y: centerY },
          capacity: 0,
          displayOrder: sections.length,
          isActive: true,
          hoverColor: activeColor + "90",
          selectedColor: activeColor + "B0",
          visible: true,
        };
        
        setSections(prev => [...prev, newSection]);
        setIsHierarchicalMode(true); // Auto-enable hierarchical mode when sections are created
        setPolygonPoints([]);
        setActiveTool("select");
        toast.success(`${sectionName} creada - Puedes asignarle un layout de asientos`);
        saveHistory();
    };

    const cleanupTempObjects = () => {
        const objects = fabricCanvas.getObjects();
        objects.forEach((obj: any) => {
           if ((obj instanceof Circle && obj.radius === 4) || obj.id === 'temp-poly-line') fabricCanvas.remove(obj);
        });
        if (guideLine) { fabricCanvas.remove(guideLine); setGuideLine(null); }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Polígono/Sección
      if (isDrawingTool) {
          if (e.key === "Enter" && polygonPoints.length >= 3) {
            if (activeTool === "section") {
              finishSection(polygonPoints);
            } else {
              finishPolygon(polygonPoints);
            }
          } else if (e.key === "Escape") {
            setPolygonPoints([]);
            cleanupTempObjects();
            fabricCanvas.requestRenderAll();
            toast.info(activeTool === "section" ? "Sección cancelada" : "Polígono cancelado");
          }
      }

      // 2. Borrar (solo Delete/Suprimir, NO Backspace)
      if (e.key === "Delete") {
          const activeObjects = fabricCanvas.getActiveObjects();
          if (activeObjects.length > 0 && !(activeObjects[0] as any).isEditing) {
              // Track deleted sections and zones
              const deletedSectionIds: string[] = [];
              const deletedZoneIds: string[] = [];
              
              activeObjects.forEach(obj => {
                const customObj = obj as CustomFabricObject;
                if (customObj._customType === "seat" && (customObj as any).linkedLabelId) {
                  const label = (customObj as any).linkedLabelId;
                  if (label) fabricCanvas.remove(label);
                }
                if (customObj._customType === "section") {
                  deletedSectionIds.push(customObj.id);
                }
                if (customObj._customType === "zone") {
                  deletedZoneIds.push(customObj.zoneId!);
                }
                fabricCanvas.remove(obj);
              });
              fabricCanvas.discardActiveObject();
              fabricCanvas.requestRenderAll();
              
              if (deletedZoneIds.length > 0) {
                  setZones(prev => prev.filter(z => !deletedZoneIds.includes(z.id)));
              }
              if (deletedSectionIds.length > 0) {
                  setSections(prev => prev.filter(s => !deletedSectionIds.includes(s.id)));
              }
              toast.success("Elementos eliminados");
              saveHistory();
          }
      }

      // 3. Atajos de Teclado (Ctrl+Z, Ctrl+Y, Ctrl+C, Ctrl+V, Ctrl+D)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
          e.preventDefault();
          if (e.shiftKey) handleRedo();
          else handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
          e.preventDefault();
          handleRedo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
          e.preventDefault();
          handleCopy();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
          e.preventDefault();
          handlePaste();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
          e.preventDefault();
          handleDuplicate();
      }
    };
    
    if (isDrawingTool) {
        fabricCanvas.on("mouse:down", handleCanvasClick);
    }
    
    window.addEventListener("keydown", handleKeyDown);
    return () => { 
        fabricCanvas.off("mouse:down", handleCanvasClick); 
        window.removeEventListener("keydown", handleKeyDown); 
    };
  }, [fabricCanvas, activeTool, polygonPoints, activeColor, zones, sections, isDragging, guideLine, saveHistory, historyIndex, history]); // Dependencias importantes para Undo/Redo en callback

  // Clipboard para copiar/pegar
  const clipboardRef = useRef<any[]>([]);

  const handleCopy = useCallback(() => {
    if (!fabricCanvas) return;
    const activeObjects = fabricCanvas.getActiveObjects();
    
    if (!activeObjects.length) {
      toast.warning("Selecciona algo para copiar");
      return;
    }

    // Clonar objetos al clipboard
    clipboardRef.current = [];
    Promise.all(activeObjects.map(obj => obj.clone())).then((clones) => {
      clipboardRef.current = clones.map((clone, i) => {
        const original = activeObjects[i] as CustomFabricObject;
        // Guardar propiedades custom
        (clone as any)._customType = original._customType;
        (clone as any).zoneId = original.zoneId;
        (clone as any).name = original.name;
        (clone as any).price = original.price;
        (clone as any).status = original.status;
        (clone as any).seatType = original.seatType;
        return clone;
      });
      toast.success(`${activeObjects.length} elemento(s) copiado(s)`);
    });
  }, [fabricCanvas]);

  const handlePaste = useCallback(() => {
    if (!fabricCanvas || clipboardRef.current.length === 0) {
      toast.warning("No hay nada para pegar");
      return;
    }

    fabricCanvas.discardActiveObject();
    
    Promise.all(clipboardRef.current.map(obj => obj.clone())).then((clones) => {
      const pastedObjects: FabricObject[] = [];
      
      clones.forEach((cloned: any, i) => {
        const original = clipboardRef.current[i];
        cloned.set({
          left: (cloned.left || 0) + 20,
          top: (cloned.top || 0) + 20,
          evented: true,
          id: `paste-${Date.now()}-${i}`,
          name: original.name ? `${original.name}` : undefined,
          _customType: original._customType,
          zoneId: original.zoneId,
          price: original.price,
          status: original.status,
          seatType: original.seatType,
        });
        fabricCanvas.add(cloned);
        pastedObjects.push(cloned);
      });
      
      // Seleccionar los elementos pegados
      if (pastedObjects.length === 1) {
        fabricCanvas.setActiveObject(pastedObjects[0]);
      } else {
        const selection = new ActiveSelection(pastedObjects, { canvas: fabricCanvas });
        fabricCanvas.setActiveObject(selection);
      }
      
      fabricCanvas.requestRenderAll();
      saveHistory();
      toast.success(`${pastedObjects.length} elemento(s) pegado(s)`);
    });
  }, [fabricCanvas, saveHistory]);

  const handleDuplicate = useCallback(() => {
    if (!fabricCanvas) return;
    const activeObjects = fabricCanvas.getActiveObjects();
    
    if (!activeObjects.length) {
        toast.warning("Selecciona algo para duplicar");
        return;
    }

    if (activeObjects.length === 1) {
        const obj = activeObjects[0] as CustomFabricObject;
        obj.clone().then((cloned: CustomFabricObject) => {
            cloned.set({
                left: (obj.left || 0) + 20,
                top: (obj.top || 0) + 20,
                evented: true,
                id: `clone-${Date.now()}`,
                name: `${obj.name} (Copia)`,
                zoneId: obj.zoneId, 
                price: obj.price,
                capacity: obj.capacity,
                _customType: obj._customType
            });
            fabricCanvas.discardActiveObject();
            fabricCanvas.add(cloned);
            fabricCanvas.setActiveObject(cloned);
            fabricCanvas.requestRenderAll();
            saveHistory();
            toast.success("Elemento duplicado");
        });
    } else {
        const activeSelection = fabricCanvas.getActiveObject();
        if(!activeSelection) return;

        activeSelection.clone().then((clonedSelection: any) => {
            fabricCanvas.discardActiveObject();
            
            clonedSelection.set({
                left: clonedSelection.left + 20,
                top: clonedSelection.top + 20,
                evented: true,
                canvas: fabricCanvas 
            });

            clonedSelection.forEachObject((obj: CustomFabricObject) => {
                obj.set({
                    id: `clone-${Date.now()}-${Math.random()}`,
                });
                fabricCanvas.add(obj);
            });
            
            const newSelection = new ActiveSelection(clonedSelection.getObjects(), { canvas: fabricCanvas });
            fabricCanvas.setActiveObject(newSelection);
            fabricCanvas.requestRenderAll();
            saveHistory();
            toast.success("Elementos duplicados");
        });
    }
  }, [fabricCanvas, saveHistory]);

  // MEJORA: handleUndo usa historyStore como fuente principal, con fallback a local
  const handleUndo = () => {
      if (!fabricCanvas) return;
      
      // Intentar usar historyStore primero
      if (canUndo) {
        const prevState = undoHistory();
        if (prevState) {
          isHistoryLocked.current = true;
          
          const currentZoom = fabricCanvas.getZoom();
          const currentViewport = fabricCanvas.viewportTransform 
            ? [...fabricCanvas.viewportTransform] 
            : [1, 0, 0, 1, 0, 0];
          
          const jsonData = typeof prevState.canvasJSON === 'string' 
            ? JSON.parse(prevState.canvasJSON) 
            : prevState.canvasJSON;
          
          fabricCanvas.loadFromJSON(jsonData, () => {
            ensureCanvasBorder(fabricCanvas);
            fabricCanvas.setZoom(currentZoom);
            fabricCanvas.setViewportTransform(currentViewport as [number, number, number, number, number, number]);
            fabricCanvas.requestRenderAll();
            if(showGrid) drawGridLines(fabricCanvas);
            setZones(prevState.zones);
            isHistoryLocked.current = false;
            toast.info("Deshacer");
          });
          return;
        }
      }
      
      // Fallback al historial local
      if (historyIndex <= 0) return;
      isHistoryLocked.current = true;
      const prevIndex = historyIndex - 1;
      const prevState = history[prevIndex];
      
      // Guardar zoom/viewport actual antes de cargar
      const currentZoom = fabricCanvas.getZoom();
      const currentViewport = fabricCanvas.viewportTransform 
        ? [...fabricCanvas.viewportTransform] 
        : [1, 0, 0, 1, 0, 0];
      
      fabricCanvas.loadFromJSON(prevState.canvasJSON, () => {
          ensureCanvasBorder(fabricCanvas);
          
          // Restaurar zoom/viewport ACTUAL (no del historial)
          // El zoom no debe cambiar al hacer undo
          fabricCanvas.setZoom(currentZoom);
          fabricCanvas.setViewportTransform(currentViewport as [number, number, number, number, number, number]);
          
          fabricCanvas.requestRenderAll();
          if(showGrid) drawGridLines(fabricCanvas);
          
          setZones(prevState.zones);
          setHistoryIndex(prevIndex);
          isHistoryLocked.current = false;
          toast.info("Deshacer");
      });
  };

  // MEJORA: handleRedo usa historyStore como fuente principal, con fallback a local
  const handleRedo = () => {
      if (!fabricCanvas) return;
      
      // Intentar usar historyStore primero
      if (canRedo) {
        const nextState = redoHistory();
        if (nextState) {
          isHistoryLocked.current = true;
          
          const currentZoom = fabricCanvas.getZoom();
          const currentViewport = fabricCanvas.viewportTransform 
            ? [...fabricCanvas.viewportTransform] 
            : [1, 0, 0, 1, 0, 0];
          
          const jsonData = typeof nextState.canvasJSON === 'string' 
            ? JSON.parse(nextState.canvasJSON) 
            : nextState.canvasJSON;
          
          fabricCanvas.loadFromJSON(jsonData, () => {
            ensureCanvasBorder(fabricCanvas);
            fabricCanvas.setZoom(currentZoom);
            fabricCanvas.setViewportTransform(currentViewport as [number, number, number, number, number, number]);
            fabricCanvas.requestRenderAll();
            if(showGrid) drawGridLines(fabricCanvas);
            setZones(nextState.zones);
            isHistoryLocked.current = false;
            toast.info("Rehacer");
          });
          return;
        }
      }
      
      // Fallback al historial local
      if (historyIndex >= history.length - 1) return;
      isHistoryLocked.current = true;
      const nextIndex = historyIndex + 1;
      const nextState = history[nextIndex];
      
      // Guardar zoom/viewport actual antes de cargar
      const currentZoom = fabricCanvas.getZoom();
      const currentViewport = fabricCanvas.viewportTransform 
        ? [...fabricCanvas.viewportTransform] 
        : [1, 0, 0, 1, 0, 0];
      
      fabricCanvas.loadFromJSON(nextState.canvasJSON, () => {
          ensureCanvasBorder(fabricCanvas);
          
          // Restaurar zoom/viewport ACTUAL (no del historial)
          // El zoom no debe cambiar al hacer redo
          fabricCanvas.setZoom(currentZoom);
          fabricCanvas.setViewportTransform(currentViewport as [number, number, number, number, number, number]);
          
          fabricCanvas.requestRenderAll();
          if(showGrid) drawGridLines(fabricCanvas);

          setZones(nextState.zones);
          setHistoryIndex(nextIndex);
          isHistoryLocked.current = false;
          toast.info("Rehacer");
      });
  };

  const handleMoveLayer = (zoneId: string, direction: 'up' | 'down' | 'top' | 'bottom') => {
    if (!fabricCanvas) return;
    const objects = fabricCanvas.getObjects() as CustomFabricObject[];
    const zoneObjects = objects.filter(obj => obj.zoneId === zoneId);
    zoneObjects.forEach(obj => {
        if (direction === 'top') fabricCanvas.bringObjectToFront(obj);
        if (direction === 'bottom') fabricCanvas.sendObjectToBack(obj);
        if (direction === 'up') fabricCanvas.bringObjectForward(obj);
        if (direction === 'down') fabricCanvas.sendObjectBackwards(obj);
    });
    
    if (direction === 'bottom') {
        const gridLines = objects.filter(o => o._customType === 'grid');
        gridLines.forEach(l => fabricCanvas.sendObjectToBack(l));
    }
    
    fabricCanvas.requestRenderAll();
    saveHistory();
  };
  
  const handleUpdateProperties = (properties: Record<string, any>) => {
    if (!fabricCanvas || selectedObjects.length === 0) return;

    selectedObjects.forEach(obj => {
        Object.entries(properties).forEach(([key, value]) => {
            if (value !== undefined && value !== "") {
                (obj as any)[key] = value;
            }
        });
    });

    if (properties.name) {
        setZones(prevZones => prevZones.map(z => {
            const isSelected = selectedObjects.some(o => o.zoneId === z.id && o._customType === 'zone');
            return isSelected ? { ...z, name: properties.name } : z;
        }));
    }

    fabricCanvas.requestRenderAll();
    toast.success("Propiedades actualizadas");
    saveHistory();
  };

  // --- Nueva Función: Alineación ---
  const handleAlign = (direction: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
      if (!fabricCanvas) return;
      const activeObj = fabricCanvas.getActiveObject();
      if (!activeObj || activeObj.type !== 'activeSelection') return;

      const selection = activeObj as ActiveSelection;
      const objects = selection.getObjects();
      
      // Para alinear correctamente en Fabric, una técnica fiable es deshacer la selección,
      // alinear los objetos individualmente usando sus coordenadas absolutas, y volver a seleccionar.
      
      const selectionRect = selection.getBoundingRect();
      
      fabricCanvas.discardActiveObject(); // Soltamos para trabajar con coords absolutas

      objects.forEach(obj => {
          const objRect = obj.getBoundingRect();
          const objWidth = objRect.width;
          const objHeight = objRect.height;

          switch (direction) {
              case 'left':
                  obj.set('left', selectionRect.left);
                  break;
              case 'center':
                  obj.set('left', selectionRect.left + (selectionRect.width / 2) - (objWidth / 2));
                  break;
              case 'right':
                  obj.set('left', selectionRect.left + selectionRect.width - objWidth);
                  break;
              case 'top':
                  obj.set('top', selectionRect.top);
                  break;
              case 'middle':
                  obj.set('top', selectionRect.top + (selectionRect.height / 2) - (objHeight / 2));
                  break;
              case 'bottom':
                  obj.set('top', selectionRect.top + selectionRect.height - objHeight);
                  break;
          }
          obj.setCoords(); // Importante actualizar coords
      });

      // Volver a seleccionar
      const newSelection = new ActiveSelection(objects, { canvas: fabricCanvas });
      fabricCanvas.setActiveObject(newSelection);
      fabricCanvas.requestRenderAll();
      saveHistory();
      toast.success("Objetos alineados");
  };

  // --- Función de distribución ---
  const handleDistribute = (direction: 'horizontal' | 'vertical') => {
      if (!fabricCanvas) return;
      const activeObj = fabricCanvas.getActiveObject();
      if (!activeObj || activeObj.type !== 'activeSelection') return;

      const selection = activeObj as ActiveSelection;
      const objects = selection.getObjects();
      
      if (objects.length < 3) {
          toast.warning("Selecciona al menos 3 objetos para distribuir");
          return;
      }

      fabricCanvas.discardActiveObject();

      if (direction === 'horizontal') {
          // Ordenar por posición X
          objects.sort((a, b) => a.left! - b.left!);
          
          const first = objects[0].left!;
          const last = objects[objects.length - 1].left! + objects[objects.length - 1].width! * objects[objects.length - 1].scaleX!;
          const totalSpace = last - first;
          const objectsWidth = objects.reduce((sum, obj) => sum + obj.width! * obj.scaleX!, 0);
          const spacing = (totalSpace - objectsWidth) / (objects.length - 1);
          
          let currentX = first;
          objects.forEach((obj, i) => {
              if (i > 0 && i < objects.length - 1) {
                  obj.set('left', currentX);
                  obj.setCoords();
              }
              currentX += obj.width! * obj.scaleX! + spacing;
          });
      } else {
          // Ordenar por posición Y
          objects.sort((a, b) => a.top! - b.top!);
          
          const first = objects[0].top!;
          const last = objects[objects.length - 1].top! + objects[objects.length - 1].height! * objects[objects.length - 1].scaleY!;
          const totalSpace = last - first;
          const objectsHeight = objects.reduce((sum, obj) => sum + obj.height! * obj.scaleY!, 0);
          const spacing = (totalSpace - objectsHeight) / (objects.length - 1);
          
          let currentY = first;
          objects.forEach((obj, i) => {
              if (i > 0 && i < objects.length - 1) {
                  obj.set('top', currentY);
                  obj.setCoords();
              }
              currentY += obj.height! * obj.scaleY! + spacing;
          });
      }

      const newSelection = new ActiveSelection(objects, { canvas: fabricCanvas });
      fabricCanvas.setActiveObject(newSelection);
      fabricCanvas.requestRenderAll();
      saveHistory();
      toast.success(`Objetos distribuidos ${direction === 'horizontal' ? 'horizontalmente' : 'verticalmente'}`);
  };

  // --- Función de agrupación ---
  const handleGroup = () => {
      if (!fabricCanvas) return;
      const activeObj = fabricCanvas.getActiveObject();
      
      if (!activeObj || activeObj.type !== 'activeSelection') {
          toast.warning("Selecciona varios objetos para agrupar");
          return;
      }

      const selection = activeObj as ActiveSelection;
      const objects = selection.getObjects();
      
      const group = new Group(objects, {
          objectCaching: false,
          subTargetCheck: true
      });
      
      (group as CustomFabricObject).id = `group-${Date.now()}`;
      (group as CustomFabricObject)._customType = "zone";
      (group as CustomFabricObject).name = `Grupo ${zones.length + 1}`;
      
      fabricCanvas.remove(...objects);
      fabricCanvas.add(group);
      fabricCanvas.setActiveObject(group);
      fabricCanvas.requestRenderAll();
      
      const zoneId = `zone-group-${Date.now()}`;
      (group as CustomFabricObject).zoneId = zoneId;
      setZones([...zones, { 
          id: zoneId, 
          name: `Grupo ${zones.length + 1}`, 
          color: activeColor, 
          type: "custom", 
          visible: true,
          capacity: objects.filter((o: any) => o._customType === 'seat').length
      }]);
      
      toast.success("Objetos agrupados");
      saveHistory();
  };

  // --- Función de desagrupar ---
  const handleUngroup = () => {
      if (!fabricCanvas) return;
      const activeObj = fabricCanvas.getActiveObject();
      
      if (!activeObj || activeObj.type !== 'group') {
          toast.warning("Selecciona un grupo para desagrupar");
          return;
      }

      const group = activeObj as Group;
      const objects = group.getObjects();
      const groupZoneId = (group as CustomFabricObject).zoneId;
      
      // Obtener la transformación del grupo
      group.toActiveSelection();
      
      fabricCanvas.requestRenderAll();
      
      if (groupZoneId) {
          setZones(zones.filter(z => z.id !== groupZoneId));
      }
      
      toast.success("Grupo desagrupado");
      saveHistory();
  };

  const handleToolClick = (tool: ToolType) => {
    setActiveTool(tool);
    if (!fabricCanvas) return;

    // Calcular el centro de la vista actual del usuario
    const { x: centerX, y: centerY } = getViewportCenter();

    if (tool === "rectangle") {
      const zoneId = `zone-${Date.now()}`;
      const rect = new Rect({ 
          left: centerX - 50, 
          top: centerY - 50, 
          fill: activeColor + "80", 
          width: 100, 
          height: 100, 
          stroke: activeColor, 
          strokeWidth: 2 
      });
      (rect as CustomFabricObject).id = `rect-${Date.now()}`;
      (rect as CustomFabricObject).zoneId = zoneId;
      (rect as CustomFabricObject).name = `Rectángulo ${zones.length + 1}`;
      (rect as CustomFabricObject)._customType = "zone";
      
      fabricCanvas.add(rect);
      fabricCanvas.setActiveObject(rect); 
      
      setZones([...zones, { id: zoneId, name: `Zona ${zones.length + 1}`, color: activeColor, type: "section", visible: true }]);
      setActiveTool("select");
      
      fabricCanvas.requestRenderAll(); 
      toast.success("Zona rectangular agregada");
      saveHistory();
    } 
    else if (tool === "circle") {
      const circle = new Circle({
        left: centerX - 15,
        top: centerY - 15,
        fill: activeColor,
        radius: 15,
        stroke: "#1e293b",
        strokeWidth: 2,
      });
      (circle as CustomFabricObject)._customType = "seat";
      (circle as CustomFabricObject).status = "available";
      (circle as CustomFabricObject).id = `seat-${Date.now()}`;
      (circle as CustomFabricObject).name = (circle as CustomFabricObject).id;
      (circle as CustomFabricObject).seatType = "regular";
      
      fabricCanvas.add(circle);
      fabricCanvas.setActiveObject(circle);
      setActiveTool("select");
      
      fabricCanvas.requestRenderAll();
      toast.success("Asiento individual agregado");
      saveHistory();
    } 
    else if (tool === "text") {
      const text = new IText("Etiqueta", {
        left: centerX,
        top: centerY,
        fontSize: 20,
        fill: "#1e293b",
        fontFamily: "Arial",
      });
      (text as CustomFabricObject)._customType = "text";
      
      fabricCanvas.add(text);
      fabricCanvas.setActiveObject(text);
      setActiveTool("select");
      
      fabricCanvas.requestRenderAll();
      toast.success("Texto agregado");
      saveHistory();
    }
    else if (tool === "section-circle") {
      // Start circle section drawing mode
      setCircleDrawStart(null);
      setCirclePreview(null);
      toast.info("Haz clic y arrastra para crear una sección circular", { duration: 3000 });
    }
    else if (tool === "section-arc") {
      // Start arc section drawing mode
      setArcDrawState({
        center: null,
        innerRadius: 0,
        outerRadius: 0,
        startAngle: 0,
        endAngle: Math.PI,
        step: 'center'
      });
      setArcPreview(null);
      toast.info("Paso 1: Haz clic para definir el centro del arco", { duration: 4000 });
    }
  };

  // Helper function to generate circle points for polygon representation
  const generateCirclePoints = (cx: number, cy: number, radius: number, segments: number = 32): { x: number; y: number }[] => {
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push({
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius
      });
    }
    return points;
  };

  // Helper function to generate ellipse points for polygon representation
  const generateEllipsePoints = (cx: number, cy: number, rx: number, ry: number, segments: number = 32): { x: number; y: number }[] => {
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push({
        x: cx + Math.cos(angle) * rx,
        y: cy + Math.sin(angle) * ry
      });
    }
    return points;
  };

  // Helper function to generate arc/wedge points for polygon representation
  const generateArcPoints = (
    cx: number, cy: number, 
    innerRadius: number, outerRadius: number,
    startAngle: number, endAngle: number,
    segments: number = 24
  ): { x: number; y: number }[] => {
    const points: { x: number; y: number }[] = [];
    const angleSpan = endAngle - startAngle;
    
    // Outer arc (from start to end)
    for (let i = 0; i <= segments; i++) {
      const angle = startAngle + (i / segments) * angleSpan;
      points.push({
        x: cx + Math.cos(angle) * outerRadius,
        y: cy + Math.sin(angle) * outerRadius
      });
    }
    
    // Inner arc (from end to start, reversed)
    for (let i = segments; i >= 0; i--) {
      const angle = startAngle + (i / segments) * angleSpan;
      points.push({
        x: cx + Math.cos(angle) * innerRadius,
        y: cy + Math.sin(angle) * innerRadius
      });
    }
    
    return points;
  };

  // Create a section from ellipse points
  const createCircleSection = (cx: number, cy: number, rx: number, ry: number) => {
    if (!fabricCanvas) return;
    
    const isCircle = Math.abs(rx - ry) < 5;
    const points = isCircle 
      ? generateCirclePoints(cx, cy, (rx + ry) / 2, 48) 
      : generateEllipsePoints(cx, cy, rx, ry, 48);
    
    const sectionId = `section-${Date.now()}`;
    const sectionNumber = sections.length + 1;
    const sectionName = `Sección ${sectionNumber}`;
    
    // Create polygon from points
    const polygon = new Polygon(points, { 
      fill: activeColor + "60", 
      stroke: activeColor, 
      strokeWidth: 3, 
      objectCaching: false,
    });
    
    // Create section name label
    const nameLabel = new IText(sectionName, { 
      left: cx, 
      top: cy, 
      fontSize: 18, 
      fontWeight: 'bold', 
      fill: "#ffffff", 
      stroke: "#00000080",
      strokeWidth: 2,
      fontFamily: "Arial", 
      originX: 'center', 
      originY: 'center', 
      selectable: false, 
      evented: false,
      shadow: "2px 2px 4px rgba(0,0,0,0.5)"
    });
    
    const group = new Group([polygon, nameLabel], { objectCaching: false, subTargetCheck: true });
    (group as CustomFabricObject).id = sectionId;
    (group as CustomFabricObject).name = sectionName;
    (group as CustomFabricObject)._customType = "section";
    
    fabricCanvas.add(group);
    fabricCanvas.setActiveObject(group);
    fabricCanvas.renderAll();
    
    // Create section data
    const newSection: SectionData = {
      id: sectionId,
      name: sectionName,
      description: isCircle ? "Sección circular" : "Sección elíptica",
      color: activeColor,
      polygonPoints: points,
      points: points,
      labelPosition: { x: cx, y: cy },
      capacity: 0,
      displayOrder: sections.length,
      isActive: true,
      hoverColor: activeColor + "90",
      selectedColor: activeColor + "B0",
      visible: true,
    };
    
    setSections(prev => [...prev, newSection]);
    setIsHierarchicalMode(true);
    toast.success(`${sectionName} circular creada`);
    saveHistory();
  };

  // Create a section from arc points
  const createArcSection = (
    cx: number, cy: number,
    innerRadius: number, outerRadius: number,
    startAngle: number, endAngle: number
  ) => {
    if (!fabricCanvas) return;
    
    const points = generateArcPoints(cx, cy, innerRadius, outerRadius, startAngle, endAngle, 32);
    
    const sectionId = `section-${Date.now()}`;
    const sectionNumber = sections.length + 1;
    const sectionName = `Sección ${sectionNumber}`;
    
    // Calculate center of the arc for the label
    const midAngle = (startAngle + endAngle) / 2;
    const labelRadius = (innerRadius + outerRadius) / 2;
    const labelX = cx + Math.cos(midAngle) * labelRadius;
    const labelY = cy + Math.sin(midAngle) * labelRadius;
    
    // Create polygon from points
    const polygon = new Polygon(points, { 
      fill: activeColor + "60", 
      stroke: activeColor, 
      strokeWidth: 3, 
      objectCaching: false,
    });
    
    // Create section name label
    const nameLabel = new IText(sectionName, { 
      left: labelX, 
      top: labelY, 
      fontSize: 16, 
      fontWeight: 'bold', 
      fill: "#ffffff", 
      stroke: "#00000080",
      strokeWidth: 2,
      fontFamily: "Arial", 
      originX: 'center', 
      originY: 'center', 
      selectable: false, 
      evented: false,
      shadow: "2px 2px 4px rgba(0,0,0,0.5)"
    });
    
    const group = new Group([polygon, nameLabel], { objectCaching: false, subTargetCheck: true });
    (group as CustomFabricObject).id = sectionId;
    (group as CustomFabricObject).name = sectionName;
    (group as CustomFabricObject)._customType = "section";
    
    fabricCanvas.add(group);
    fabricCanvas.setActiveObject(group);
    fabricCanvas.renderAll();
    
    // Create section data
    const newSection: SectionData = {
      id: sectionId,
      name: sectionName,
      description: "Sección curva (arco)",
      color: activeColor,
      polygonPoints: points,
      points: points,
      labelPosition: { x: labelX, y: labelY },
      capacity: 0,
      displayOrder: sections.length,
      isActive: true,
      hoverColor: activeColor + "90",
      selectedColor: activeColor + "B0",
      visible: true,
    };
    
    setSections(prev => [...prev, newSection]);
    setIsHierarchicalMode(true);
    toast.success(`${sectionName} curva creada`);
    saveHistory();
  };

  // Effect for circle section drawing
  useEffect(() => {
    if (!fabricCanvas || activeTool !== "section-circle") return;

    const handleMouseDown = (opt: any) => {
      if (isDragging || opt.e.altKey) return;
      const pointer = fabricCanvas.getScenePoint(opt.e);
      setCircleDrawStart({ x: pointer.x, y: pointer.y });
      
      // Create preview circle
      const preview = new Circle({
        left: pointer.x,
        top: pointer.y,
        radius: 1,
        fill: activeColor + "40",
        stroke: activeColor,
        strokeWidth: 2,
        strokeDashArray: [5, 5],
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false
      });
      (preview as any).id = 'circle-preview';
      fabricCanvas.add(preview);
      setCirclePreview(preview);
    };

    const handleMouseMove = (opt: any) => {
      if (!circleDrawStart || !circlePreview) return;
      const pointer = fabricCanvas.getScenePoint(opt.e);
      
      // Calculate radii for ellipse
      const rx = Math.abs(pointer.x - circleDrawStart.x);
      const ry = Math.abs(pointer.y - circleDrawStart.y);
      const avgRadius = Math.max(rx, ry);
      
      // Update preview - use shift for perfect circle
      if (opt.e.shiftKey) {
        circlePreview.set({
          radius: avgRadius,
          left: circleDrawStart.x,
          top: circleDrawStart.y
        });
      } else {
        // For ellipse, we'll still show a circle but create ellipse on release
        circlePreview.set({
          radius: avgRadius,
          left: circleDrawStart.x,
          top: circleDrawStart.y
        });
      }
      fabricCanvas.renderAll();
    };

    const handleMouseUp = (opt: any) => {
      if (!circleDrawStart) return;
      const pointer = fabricCanvas.getScenePoint(opt.e);
      
      const rx = Math.abs(pointer.x - circleDrawStart.x);
      const ry = Math.abs(pointer.y - circleDrawStart.y);
      
      // Remove preview
      if (circlePreview) {
        fabricCanvas.remove(circlePreview);
        setCirclePreview(null);
      }
      
      // Only create if dragged enough
      if (rx > 20 || ry > 20) {
        const finalRx = opt.e.shiftKey ? Math.max(rx, ry) : rx;
        const finalRy = opt.e.shiftKey ? Math.max(rx, ry) : ry;
        createCircleSection(circleDrawStart.x, circleDrawStart.y, finalRx, finalRy);
      }
      
      setCircleDrawStart(null);
      setActiveTool("select");
    };

    fabricCanvas.on("mouse:down", handleMouseDown);
    fabricCanvas.on("mouse:move", handleMouseMove);
    fabricCanvas.on("mouse:up", handleMouseUp);

    return () => {
      fabricCanvas.off("mouse:down", handleMouseDown);
      fabricCanvas.off("mouse:move", handleMouseMove);
      fabricCanvas.off("mouse:up", handleMouseUp);
    };
  }, [fabricCanvas, activeTool, circleDrawStart, circlePreview, activeColor, isDragging, sections.length]);

  // Effect for arc section drawing
  useEffect(() => {
    if (!fabricCanvas || activeTool !== "section-arc") return;

    const updateArcPreview = (state: typeof arcDrawState) => {
      // Remove old preview
      if (arcPreview) {
        fabricCanvas.remove(arcPreview);
      }
      
      if (!state.center || state.outerRadius < 10) return;
      
      // Generate arc path
      const points = generateArcPoints(
        state.center.x, state.center.y,
        state.innerRadius, state.outerRadius,
        state.startAngle, state.endAngle,
        32
      );
      
      // Create path string
      let pathStr = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        pathStr += ` L ${points[i].x} ${points[i].y}`;
      }
      pathStr += ' Z';
      
      const preview = new Path(pathStr, {
        fill: activeColor + "40",
        stroke: activeColor,
        strokeWidth: 2,
        strokeDashArray: [5, 5],
        selectable: false,
        evented: false
      });
      (preview as any).id = 'arc-preview';
      fabricCanvas.add(preview);
      setArcPreview(preview);
      fabricCanvas.renderAll();
    };

    const handleCanvasClick = (opt: any) => {
      if (isDragging || opt.e.altKey) return;
      const pointer = fabricCanvas.getScenePoint(opt.e);

      if (arcDrawState.step === 'center') {
        // Set center
        const newState = { ...arcDrawState, center: { x: pointer.x, y: pointer.y }, step: 'outer' as const };
        setArcDrawState(newState);
        toast.info("Paso 2: Haz clic para definir el radio exterior", { duration: 3000 });
      }
      else if (arcDrawState.step === 'outer' && arcDrawState.center) {
        // Set outer radius
        const dx = pointer.x - arcDrawState.center.x;
        const dy = pointer.y - arcDrawState.center.y;
        const outerRadius = Math.sqrt(dx * dx + dy * dy);
        const newState = { ...arcDrawState, outerRadius, step: 'inner' as const };
        setArcDrawState(newState);
        updateArcPreview(newState);
        toast.info("Paso 3: Haz clic para definir el radio interior", { duration: 3000 });
      }
      else if (arcDrawState.step === 'inner' && arcDrawState.center) {
        // Set inner radius
        const dx = pointer.x - arcDrawState.center.x;
        const dy = pointer.y - arcDrawState.center.y;
        const innerRadius = Math.min(Math.sqrt(dx * dx + dy * dy), arcDrawState.outerRadius * 0.9);
        const newState = { ...arcDrawState, innerRadius, step: 'start-angle' as const };
        setArcDrawState(newState);
        updateArcPreview(newState);
        toast.info("Paso 4: Haz clic para definir el ángulo de inicio", { duration: 3000 });
      }
      else if (arcDrawState.step === 'start-angle' && arcDrawState.center) {
        // Set start angle
        const dx = pointer.x - arcDrawState.center.x;
        const dy = pointer.y - arcDrawState.center.y;
        const startAngle = Math.atan2(dy, dx);
        const newState = { ...arcDrawState, startAngle, step: 'end-angle' as const };
        setArcDrawState(newState);
        updateArcPreview(newState);
        toast.info("Paso 5: Haz clic para definir el ángulo final", { duration: 3000 });
      }
      else if (arcDrawState.step === 'end-angle' && arcDrawState.center) {
        // Set end angle and create section
        const dx = pointer.x - arcDrawState.center.x;
        const dy = pointer.y - arcDrawState.center.y;
        let endAngle = Math.atan2(dy, dx);
        
        // Ensure arc goes in expected direction
        if (endAngle < arcDrawState.startAngle) {
          endAngle += Math.PI * 2;
        }
        
        // Remove preview
        if (arcPreview) {
          fabricCanvas.remove(arcPreview);
          setArcPreview(null);
        }
        
        // Create the section
        createArcSection(
          arcDrawState.center.x, arcDrawState.center.y,
          arcDrawState.innerRadius, arcDrawState.outerRadius,
          arcDrawState.startAngle, endAngle
        );
        
        // Reset state
        setArcDrawState({
          center: null,
          innerRadius: 0,
          outerRadius: 0,
          startAngle: 0,
          endAngle: Math.PI,
          step: 'center'
        });
        setActiveTool("select");
      }
    };

    const handleMouseMove = (opt: any) => {
      if (!arcDrawState.center) return;
      const pointer = fabricCanvas.getScenePoint(opt.e);
      
      // Preview based on current step
      if (arcDrawState.step === 'outer') {
        const dx = pointer.x - arcDrawState.center.x;
        const dy = pointer.y - arcDrawState.center.y;
        const outerRadius = Math.sqrt(dx * dx + dy * dy);
        updateArcPreview({ ...arcDrawState, outerRadius });
      }
      else if (arcDrawState.step === 'inner') {
        const dx = pointer.x - arcDrawState.center.x;
        const dy = pointer.y - arcDrawState.center.y;
        const innerRadius = Math.min(Math.sqrt(dx * dx + dy * dy), arcDrawState.outerRadius * 0.9);
        updateArcPreview({ ...arcDrawState, innerRadius });
      }
      else if (arcDrawState.step === 'start-angle') {
        const dx = pointer.x - arcDrawState.center.x;
        const dy = pointer.y - arcDrawState.center.y;
        const startAngle = Math.atan2(dy, dx);
        updateArcPreview({ ...arcDrawState, startAngle, endAngle: startAngle + Math.PI / 2 });
      }
      else if (arcDrawState.step === 'end-angle') {
        const dx = pointer.x - arcDrawState.center.x;
        const dy = pointer.y - arcDrawState.center.y;
        let endAngle = Math.atan2(dy, dx);
        if (endAngle < arcDrawState.startAngle) endAngle += Math.PI * 2;
        updateArcPreview({ ...arcDrawState, endAngle });
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Cancel arc drawing
        if (arcPreview) {
          fabricCanvas.remove(arcPreview);
          setArcPreview(null);
        }
        setArcDrawState({
          center: null,
          innerRadius: 0,
          outerRadius: 0,
          startAngle: 0,
          endAngle: Math.PI,
          step: 'center'
        });
        setActiveTool("select");
        toast.info("Dibujo de arco cancelado");
      }
    };

    fabricCanvas.on("mouse:down", handleCanvasClick);
    fabricCanvas.on("mouse:move", handleMouseMove);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      fabricCanvas.off("mouse:down", handleCanvasClick);
      fabricCanvas.off("mouse:move", handleMouseMove);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [fabricCanvas, activeTool, arcDrawState, arcPreview, activeColor, isDragging, sections.length]);

  const handleGenerateSeating = (grid: SeatingGrid) => {
    if (!fabricCanvas) return;
    const seatRadius = 12;
    // Usar el color de la zona si está seleccionada, si no el color activo
    const seatColor = grid.zoneColor || getSeatColorByType(grid.seatType, activeColor);

    let targetZoneId = grid.zoneId;
    const existingZone = zones.find(z => z.id === grid.zoneId);
    let startX = 0, startY = 0, endX = 0, endY = 0;
    
    let selectionTransform: FabricObject | null = null; 
    let pathObject: Path | null = null;

    let isZoneSelected = false;
    
    const targetObj = selectedObjects.length > 0 ? selectedObjects[0] : null;

    if (targetObj && (targetObj._customType === "zone" || targetObj.type === "rect" || targetObj.type === "group" || targetObj.type === "path" || targetObj.type === "polygon")) {
        isZoneSelected = true;
        if (targetObj.zoneId) targetZoneId = targetObj.zoneId;
        const br = targetObj.getBoundingRect();
        
        // Calcular el tamaño necesario para la grilla
        const gridWidth = grid.columns * grid.seatSpacing;
        const gridHeight = grid.rows * grid.rowSpacing;
        
        // Centrar horizontalmente, pero posicionar cerca del TOP (con padding de 20px)
        // Esto funciona mejor para formas que son más anchas arriba (triángulos invertidos, trapecios)
        startX = br.left + (br.width - gridWidth) / 2;
        startY = br.top + 20; // Empezar cerca del top, no del centro
        endX = startX + gridWidth;
        endY = startY + gridHeight;
        
        console.log("[SeatingGen] Bounding rect:", { left: br.left, top: br.top, width: br.width, height: br.height });
        console.log("[SeatingGen] Grid size needed:", { gridWidth, gridHeight });
        console.log("[SeatingGen] Calculated start:", { startX, startY });

        if (targetObj.type === 'group') {
            const group = targetObj as Group;
            const polygon = group.getObjects().find(o => o.type === 'polygon') as Polygon;
            if (polygon) {
                // Usar el polígono directamente para containsPoint
                selectionTransform = polygon;
            } else {
                selectionTransform = targetObj;
            }
        } else if (targetObj.type === 'polygon') {
            // Usar el polígono directamente para containsPoint
            selectionTransform = targetObj;
        } else if (targetObj.type === 'path') {
            pathObject = targetObj as Path;
        } else { 
            selectionTransform = targetObj; 
        }
    } else {
        const vpt = fabricCanvas.viewportTransform || [1,0,0,1,0,0];
        const width = fabricCanvas.width / vpt[0];
        const height = fabricCanvas.height / vpt[3];
        const centerX = (-vpt[4] / vpt[0]) + (width / 2) - ((grid.columns * grid.seatSpacing) / 2);
        const centerY = (-vpt[5] / vpt[3]) + (height / 2) - ((grid.rows * grid.rowSpacing) / 2);
        
        startX = centerX;
        startY = centerY;
        endX = centerX + (grid.columns * grid.seatSpacing);
        endY = centerY + (grid.rows * grid.rowSpacing);
    }

    let addedSeats = 0;
    let skippedSeats = 0;
    
    // Debug log para ver qué valores estamos usando
    console.log("[SeatingGen] Grid config:", { rows: grid.rows, columns: grid.columns, rowSpacing: grid.rowSpacing, seatSpacing: grid.seatSpacing });
    console.log("[SeatingGen] Area:", { startX, startY, endX, endY, isZoneSelected });
    console.log("[SeatingGen] Zone detection:", { pathObject: !!pathObject, selectionTransform: !!selectionTransform });

    // Calcular los límites correctos basados en el número exacto de filas/columnas
    const actualEndX = startX + (grid.columns * grid.seatSpacing);
    const actualEndY = startY + (grid.rows * grid.rowSpacing);
    
    // Usar <= para incluir la última fila/columna cuando sea exacto
    for (let rowNum = 0; rowNum < grid.rows; rowNum++) {
      const y = startY + (rowNum * grid.rowSpacing);
      const rowLetter = String.fromCharCode(grid.startRow.charCodeAt(0) + rowNum);
      
      for (let colNum = 0; colNum < grid.columns; colNum++) {
        const x = startX + (colNum * grid.seatSpacing);
        const testPoint = new Point(x + seatRadius, y + seatRadius); 
        let shouldAdd = true;

        if (isZoneSelected) {
            if (pathObject) {
                if (!pathObject.containsPoint(testPoint)) {
                    shouldAdd = false;
                    skippedSeats++;
                }
            } else if (selectionTransform) {
                if (!selectionTransform.containsPoint(testPoint)) {
                    shouldAdd = false;
                    skippedSeats++;
                }
            }
        }

        if (shouldAdd) {
            const colIndex = colNum + 1;
            let seatObject;
            
            // Generar label con prefijo si existe
            const seatLabel = grid.labelPrefix 
              ? `${grid.labelPrefix}-${rowLetter}${colIndex}` 
              : `${rowLetter}${colIndex}`;
            
            if (grid.seatShape === 'square') {
                seatObject = new Rect({
                    left: x, top: y, width: seatRadius * 2, height: seatRadius * 2,
                fill: seatColor, stroke: "#1e293b", strokeWidth: 1
                });
            } else {
                seatObject = new Circle({
                    left: x, top: y, radius: seatRadius,
                fill: seatColor, stroke: "#1e293b", strokeWidth: 1
                });
            }

            (seatObject as CustomFabricObject).id = `seat-${targetZoneId}-${rowNum}-${colIndex}`;
            (seatObject as CustomFabricObject).zoneId = targetZoneId;
            (seatObject as CustomFabricObject).name = seatLabel;
            (seatObject as CustomFabricObject)._customType = "seat";
            (seatObject as CustomFabricObject).status = "available"; // Estado inicial
            (seatObject as CustomFabricObject).seatType = grid.seatType;

            // Mostrar solo fila+numero en el texto visual (más corto)
            const displayLabel = `${rowLetter}${colIndex}`;
            const seatNumber = new IText(displayLabel, {
              left: x + seatRadius - 6,
              top: y + seatRadius - 5,
              fontSize: 10, fill: "#ffffff", fontFamily: "Arial",
              selectable: false, evented: false, originX: 'center', originY: 'center'
            });
            
            fabricCanvas.add(seatObject);
            fabricCanvas.add(seatNumber);
            fabricCanvas.bringObjectToFront(seatObject); 
            fabricCanvas.bringObjectToFront(seatNumber);
            addedSeats++;
        }
      }
    }

    console.log("[SeatingGen] Result:", { addedSeats, skippedSeats, total: grid.rows * grid.columns });
    
    fabricCanvas.renderAll();
    
    if (isZoneSelected) {
        setZones(prev => prev.map(z => z.id === targetZoneId ? { ...z, capacity: (z.capacity || 0) + addedSeats } : z));
        if (skippedSeats > 0) {
            toast.success(`${addedSeats} asientos agregados (${skippedSeats} fuera de la zona)`);
        } else {
            toast.success(`${addedSeats} asientos agregados a la zona seleccionada`);
        }
    } else if (existingZone) {
        // Se seleccionó una zona existente desde el dropdown
        setZones(prev => prev.map(z => z.id === targetZoneId ? { ...z, capacity: (z.capacity || 0) + addedSeats } : z));
        toast.success(`${addedSeats} asientos agregados a "${existingZone.name}"`);
    } else {
        // Crear nueva zona
        const newZone: Zone = {
          id: targetZoneId,
          name: grid.zoneName || `Sección ${zones.length + 1}`,
          color: seatColor,
          type: "section",
          capacity: addedSeats,
          visible: true
        };
        setZones([...zones, newZone]);
        toast.success(`${addedSeats} asientos generados en nueva zona`);
    }
    saveHistory();
    setActiveTool("select");
  };

  const handleAddTable = (config: TableConfig) => {
    if (!fabricCanvas) return;

    const tableId = crypto.randomUUID?.() ?? `table-${Date.now()}`;
    // Si se seleccionó una zona existente, usarla; si no, crear una nueva
    const zoneId = config.zoneId || `${tableId}-zone`;
    const tableColor = config.zoneColor || activeColor;
    const seatRadius = 10;
    const { x: centerX, y: centerY } = getViewportCenter();
    const tableCircle = new Circle({
      left: centerX - config.tableRadius,
      top: centerY - config.tableRadius,
      radius: config.tableRadius,
      fill: "#f1f5f9",
      stroke: tableColor,
      strokeWidth: 2,
      opacity: 0.95,
    });

    const tableObject = tableCircle as CustomFabricObject;
    tableObject.id = tableId;
    tableObject.name = config.label;
    tableObject.zoneId = zoneId;
    tableObject._customType = "table";
    tableObject.attachedSeats = [];
    tableObject.lockRotation = true;
    tableObject.lockScalingX = true;
    tableObject.lockScalingY = true;

    fabricCanvas.add(tableCircle);

    // Usar el color de la zona para los asientos
    const seatColor = tableColor;
    for (let i = 0; i < config.seatCount; i++) {
      const angle = (2 * Math.PI * i) / config.seatCount;
      const seatX = centerX + Math.cos(angle) * config.seatDistance;
      const seatY = centerY + Math.sin(angle) * config.seatDistance;

      const seat = new Circle({
        left: seatX - seatRadius,
        top: seatY - seatRadius,
        radius: seatRadius,
        fill: seatColor,
        stroke: "#1e293b",
        strokeWidth: 1,
      });

      const seatObject = seat as CustomFabricObject;
      seatObject.id = `${tableId}-seat-${i + 1}`;
      seatObject.name = `${config.label}-${i + 1}`;
      seatObject._customType = "seat";
      seatObject.status = "available";
      seatObject.zoneId = zoneId;
      seatObject.seatType = "regular"; // Default type
      seatObject.tableId = tableId;

      fabricCanvas.add(seat);
      tableObject.attachedSeats?.push({
        id: seatObject.id,
        offsetX: (seat.left ?? 0) - centerX,
        offsetY: (seat.top ?? 0) - centerY,
      });
    }

    // Solo crear nueva zona si no se seleccionó una existente
    if (!config.zoneId) {
      setZones((prev) => [
        ...prev,
        {
          id: zoneId,
          name: config.label,
          color: tableColor,
          type: "custom",
          capacity: config.seatCount,
          visible: true,
        },
      ]);
    }

    fabricCanvas.requestRenderAll();
    saveHistory();
    toast.success(`Mesa ${config.label} agregada${config.zoneId ? ` a zona existente` : ''}`);
  };

  // Estado para la imagen de fondo como objeto
  const [bgImageObject, setBgImageObject] = useState<FabricImage | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fabricCanvas) return;
    const reader = new FileReader();
    reader.onload = (f) => {
      const data = f.target?.result as string;
      FabricImage.fromURL(data).then((img) => {
        // Remover imagen anterior si existe
        if (bgImageObject) {
          fabricCanvas.remove(bgImageObject);
        }
        
        const scale = Math.min(
          (fabricCanvas.width * 0.8) / (img.width || 1), 
          (fabricCanvas.height * 0.8) / (img.height || 1)
        );
        
        // Configurar imagen como objeto interactivo
        img.set({ 
          scaleX: scale, 
          scaleY: scale, 
          originX: 'center', 
          originY: 'center',
          left: fabricCanvas.width / 2,
          top: fabricCanvas.height / 2,
          opacity: bgOpacity,
          // Asegurar que sea completamente interactiva
          selectable: true,
          evented: true,
          hasControls: true,
          hasBorders: true,
          lockMovementX: false,
          lockMovementY: false,
          lockRotation: false,
          lockScalingX: false,
          lockScalingY: false,
          hoverCursor: 'move',
        });
        
        // Propiedades personalizadas (después del set para evitar problemas de tipado)
        (img as any)._customType = 'background-image';
        (img as any).name = 'Imagen de Referencia';
        
        // Agregar al canvas
        fabricCanvas.add(img);
        
        // Enviar al fondo pero encima del borde
        fabricCanvas.sendObjectToBack(img);
        const border = fabricCanvas.getObjects().find((o: any) => o._customType === 'canvas-border' || o._customType === 'border');
        if (border) {
          fabricCanvas.sendObjectToBack(border);
        }
        
        // Seleccionar la imagen para que el usuario vea que puede interactuar
        fabricCanvas.setActiveObject(img);
        setBgImageObject(img);
        
        fabricCanvas.requestRenderAll();
        toast.success("✅ Imagen cargada - arrástrala para moverla");
        saveHistory();
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveBackgroundImage = () => {
    if (!fabricCanvas || !bgImageObject) return;
    fabricCanvas.remove(bgImageObject);
    setBgImageObject(null);
    fabricCanvas.requestRenderAll();
    toast.success("Imagen de fondo eliminada");
    saveHistory();
  };

  const handleSendImageToBack = () => {
    if (!fabricCanvas || !bgImageObject) return;
    fabricCanvas.sendObjectToBack(bgImageObject);
    // Asegurar que el borde siempre esté al fondo
    const border = fabricCanvas.getObjects().find((o: any) => o._customType === 'canvas-border');
    if (border) fabricCanvas.sendObjectToBack(border);
    fabricCanvas.requestRenderAll();
    toast.success("Imagen enviada al fondo");
  };

  const handleOpacityChange = (val: number[]) => {
      setBgOpacity(val[0]);
      if (bgImageObject) {
          bgImageObject.set('opacity', val[0]);
          fabricCanvas?.requestRenderAll();
      }
  };

  const handleToggleZoneVisibility = (zoneId: string) => {
    if (!fabricCanvas) return;
    const zoneIndex = zones.findIndex(z => z.id === zoneId);
    if (zoneIndex === -1) return;
    const newVisibility = !zones[zoneIndex].visible;
    const objects = fabricCanvas.getObjects() as CustomFabricObject[];
    objects.forEach(obj => { if (obj.zoneId === zoneId) obj.set('visible', newVisibility); });
    const newZones = [...zones];
    newZones[zoneIndex].visible = newVisibility;
    setZones(newZones);
    fabricCanvas.requestRenderAll();
    fabricCanvas.discardActiveObject(); 
    saveHistory();
  };

  const handleDeleteZone = (zoneId: string) => {
    if (!fabricCanvas) return;
    const objects = fabricCanvas.getObjects() as CustomFabricObject[];
    const objectsToRemove = objects.filter(obj => obj.zoneId === zoneId);
    objectsToRemove.forEach(obj => fabricCanvas.remove(obj));
    setZones(zones.filter(z => z.id !== zoneId));
    fabricCanvas.requestRenderAll();
    toast.success("Zona eliminada");
    saveHistory();
  };

  const handleRenameZone = (zoneId: string, newName: string) => {
    const zoneIndex = zones.findIndex(z => z.id === zoneId);
    if (zoneIndex === -1) return;
    const newZones = [...zones];
    newZones[zoneIndex] = { ...newZones[zoneIndex], name: newName };
    setZones(newZones);
    
    // También actualizar objetos del canvas que pertenezcan a esta zona
    if (fabricCanvas) {
      const objects = fabricCanvas.getObjects() as CustomFabricObject[];
      objects.forEach(obj => {
        if (obj.zoneId === zoneId && obj._customType === 'zone') {
          obj.set('name', newName);
        }
      });
      fabricCanvas.requestRenderAll();
    }
    
    toast.success(`Zona renombrada a "${newName}"`);
    saveHistory();
  };

  const handleSelectZone = (zoneId: string) => {
    if (!fabricCanvas) return;
    const objects = fabricCanvas.getObjects() as CustomFabricObject[];
    const zoneObjects = objects.filter(obj => obj.zoneId === zoneId);
    if (zoneObjects.length > 0) {
        const mainObj = zoneObjects.find(o => o._customType === "zone") || zoneObjects[0];
        fabricCanvas.setActiveObject(mainObj);
        fabricCanvas.requestRenderAll();
    }
  };

  const handleSeatInspectorSave = (seatId: string, addOns: any[]) => {
    if (!fabricCanvas) return;
    
    const seat = fabricCanvas.getObjects().find((obj: any) => obj._customType === 'seat' && obj.id === seatId);
    if (!seat) return;
    
    // Store add-ons in seat metadata
    (seat as any).metadata = {
      ...(seat as any).metadata,
      addOns,
    };
    
    fabricCanvas.requestRenderAll();
    setIsDirty(true);
    toast.success(`Add-ons actualizados para ${(seat as any).name}`);
  };

  // MEJORA: Validar sincronización entre canvas y datos estructurados
  const validateCanvasSync = useCallback((): { valid: boolean; warnings: string[] } => {
    if (!fabricCanvas) return { valid: true, warnings: [] };
    
    const warnings: string[] = [];
    const canvasObjects = fabricCanvas.getObjects() as CustomFabricObject[];
    
    // Obtener asientos del canvas
    const canvasSeats = canvasObjects.filter(obj => obj._customType === 'seat');
    const canvasSeatIds = new Set(canvasSeats.map(s => s.id).filter(Boolean));
    
    // Obtener zonas del canvas
    const canvasZones = canvasObjects.filter(obj => obj._customType === 'zone');
    const canvasZoneIds = new Set(canvasZones.map(z => z.zoneId).filter(Boolean));
    
    // Validar zonas: todas las zonas en el array deben tener representación visual (opcional)
    const zoneIdsInState = new Set(zones.map(z => z.id));
    
    // Advertir sobre asientos sin zona asignada
    const seatsWithoutZone = canvasSeats.filter(s => !s.zoneId);
    if (seatsWithoutZone.length > 0) {
      warnings.push(`${seatsWithoutZone.length} asiento(s) sin zona asignada`);
    }
    
    // Advertir sobre asientos sin ID (nuevos sin guardar)
    const seatsWithoutId = canvasSeats.filter(s => !s.id || s.id.startsWith('seat-'));
    if (seatsWithoutId.length > 5) {
      warnings.push(`${seatsWithoutId.length} asiento(s) con ID temporal`);
    }
    
    // Advertir sobre posibles duplicados
    const idCounts = new Map<string, number>();
    canvasSeats.forEach(s => {
      if (s.id) {
        idCounts.set(s.id, (idCounts.get(s.id) ?? 0) + 1);
      }
    });
    const duplicates = Array.from(idCounts.entries()).filter(([, count]) => count > 1);
    if (duplicates.length > 0) {
      warnings.push(`${duplicates.length} ID(s) duplicado(s) en asientos`);
    }
    
    return { valid: true, warnings };
  }, [fabricCanvas, zones]);

  const handleSaveCanvas = async () => {
    // DEBUG: Log all relevant state at start of save
    console.log('[Canvas Save] === SAVE INITIATED ===');
    console.log('[Canvas Save] fabricCanvas exists:', !!fabricCanvas);
    console.log('[Canvas Save] savingLayout:', savingLayout);
    console.log('[Canvas Save] effectiveVenueId:', effectiveVenueId);
    console.log('[Canvas Save] effectiveLayoutId:', effectiveLayoutId);
    console.log('[Canvas Save] isEventMode:', isEventMode);
    console.log('[Canvas Save] venueId from URL:', venueId);
    console.log('[Canvas Save] layoutId from URL:', layoutId);
    
    if (!fabricCanvas || savingLayout) {
      console.log('[Canvas Save] Early return - fabricCanvas missing or already saving');
      return;
    }
    
    // Validar sincronización antes de guardar
    const { warnings } = validateCanvasSync();
    if (warnings.length > 0) {
      console.warn('[Canvas Save] Advertencias de sincronización:', warnings);
      // Mostrar advertencias pero permitir guardar
      warnings.forEach(w => toast.warning(w, { duration: 3000 }));
    }
    
    const json = fabricCanvas.toJSON(['id', 'name', 'price', 'capacity', 'zoneId', '_customType', 'status', 'seatType', 'tableId', 'attachedSeats', 'lockMovementX', 'lockMovementY', 'lockScalingX', 'lockScalingY', 'lockRotation', 'hasControls', 'selectable', 'metadata', 'sectionId']);
    const dataToSave = {
        canvas: json,
        zones: zones,
        sections: sections, // Include sections in save
    };

    if (effectiveVenueId && effectiveLayoutId) {
      try {
        setSavingLayout(true);
        const zonePayload = buildZonesForSave();
        const seatPayload = buildSeatsForSave();
        const tablePayload = buildTablesForSave();
        
        // DEBUG: Log seat count being saved
        console.log(`[Canvas Save] Saving ${seatPayload.length} seats to DB`);
        console.log(`[Canvas Save] Total canvas objects: ${fabricCanvas.getObjects().length}`);
        const allObjects = fabricCanvas.getObjects();
        const circles = allObjects.filter(o => o.type === 'circle' || o.type === 'Circle');
        const rects = allObjects.filter(o => o.type === 'rect' || o.type === 'Rect');
        console.log(`[Canvas Save] Circles: ${circles.length}, Rects: ${rects.length}`);
        if (circles.length > 0) {
          const firstCircle = circles[0] as any;
          console.log(`[Canvas Save] First circle radius: ${firstCircle.radius}, _customType: ${firstCircle._customType}`);
        }
        
        const result = await api.saveVenueLayout(effectiveVenueId, {
          layoutId: effectiveLayoutId,
          layoutJson: dataToSave,
          zones: zonePayload,
          seats: seatPayload,
          tables: tablePayload,
        }, currentLayoutVersion);
        
        setCurrentLayoutVersion(result.version);
        setIsDirty(false);
        toast.success(`Mapa guardado (versión ${result.version})`);
      } catch (error: any) {
        console.error('[Canvas Save Error]', error);
        if (error?.status === 409) {
          // Show conflict dialog with option to force save
          setConflictData({
            currentVersion: error.currentVersion,
            requestedVersion: error.requestedVersion,
            lastEditedBy: error.lastEditedBy,
          });
          setShowConflictDialog(true);
        } else if (error instanceof TypeError) {
          toast.error("No se pudo contactar al servidor (¿API en http://localhost:4000 encendida?)");
        } else {
          // Show detailed error from server
          const message = error?.sqlMessage 
            || error?.error 
            || (error instanceof Error ? error.message : "No se pudo guardar el mapa");
          console.error('[Canvas Save] Server error details:', {
            message,
            code: error?.code,
            sqlMessage: error?.sqlMessage,
            fullError: error,
          });
          toast.error(message, { duration: 5000 });
        }
      } finally {
        setSavingLayout(false);
      }
      return;
    }

    // Si no hay venueId/layoutId, guardar localmente
    console.log('[Canvas Save] No venueId/layoutId, saving locally');
    localStorage.setItem('boleteraMapData', JSON.stringify(dataToSave));
    setIsDirty(false);
    toast.success("Mapa guardado localmente");
  };

  // Force save function (bypasses version check)
  const handleForceSave = async () => {
    if (!fabricCanvas || !effectiveVenueId || !effectiveLayoutId) return;
    
    setShowConflictDialog(false);
    
    try {
      setSavingLayout(true);
      const json = fabricCanvas.toJSON(['id', 'name', 'price', 'capacity', 'zoneId', '_customType', 'status', 'seatType', 'tableId', 'attachedSeats', 'lockMovementX', 'lockMovementY', 'lockScalingX', 'lockScalingY', 'lockRotation', 'hasControls', 'selectable', 'metadata']);
      const dataToSave = { canvas: json, zones: zones, sections: sections };
      const zonePayload = buildZonesForSave();
      const seatPayload = buildSeatsForSave();
      const tablePayload = buildTablesForSave();
      
      const result = await api.saveVenueLayout(effectiveVenueId, {
        layoutId: effectiveLayoutId,
        layoutJson: dataToSave,
        zones: zonePayload,
        seats: seatPayload,
        tables: tablePayload,
      }, currentLayoutVersion, true); // Force overwrite = true
      
      setCurrentLayoutVersion(result.version);
      setIsDirty(false);
      toast.success(`Mapa guardado forzadamente (versión ${result.version})`);
    } catch (error: any) {
      const message = error instanceof Error ? error.message : "No se pudo guardar";
      toast.error(message);
    } finally {
      setSavingLayout(false);
    }
  };

  // Auto-save with debounce
  const autoSave = useCallback(async () => {
    if (!fabricCanvas || !effectiveVenueId || !effectiveLayoutId || savingLayout || !isDirty) return;
    
    try {
      const json = fabricCanvas.toJSON(['id', 'name', 'price', 'capacity', 'zoneId', '_customType', 'status', 'seatType', 'tableId', 'attachedSeats', 'metadata']);
      const zonePayload = buildZonesForSave();
      const seatPayload = buildSeatsForSave();
      const tablePayload = buildTablesForSave();
      
      const result = await api.saveVenueLayout(effectiveVenueId, {
        layoutId: effectiveLayoutId,
        layoutJson: { canvas: json, zones },
        zones: zonePayload,
        seats: seatPayload,
        tables: tablePayload,
      }, currentLayoutVersion);
      
      setCurrentLayoutVersion(result.version);
      setIsDirty(false);
      
      // Silent success (no toast for auto-save)
      console.log(`Auto-guardado v${result.version}`);
    } catch (error: any) {
      if (error?.status === 409) {
        toast.warning("Auto-guardado falló: layout modificado por otro usuario. Guarda manualmente.", { duration: 4000 });
      }
      // Silently fail other errors to avoid interrupting user
    }
  }, [fabricCanvas, venueId, layoutId, savingLayout, isDirty, zones, currentLayoutVersion, buildZonesForSave, buildSeatsForSave, buildTablesForSave]);

  // Effect: Auto-save when dirty after 30s
  useEffect(() => {
    if (!isDirty || !isRemoteSession) return;
    
    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    // Set new timer
    autoSaveTimerRef.current = setTimeout(() => {
      autoSave();
    }, 30000); // 30 seconds
    
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [isDirty, isRemoteSession, autoSave]);

  const handleLoadCanvas = async () => {
    if (!fabricCanvas) return;

    if (isRemoteSession) {
      try {
        setLoadingLayout(true);
        const updatedLayout = await refetchLayout();
        const layoutData = updatedLayout.data ?? venueLayout ?? null;
        const latestTables = await fetchTablesForVenue();
        
        if (!layoutData) {
          toast.error("No se encontró un layout disponible");
          return;
        }
        
        setCurrentLayoutVersion(layoutData.version ?? 1);
        const payload = buildRemotePayloadFromLayout(layoutData);
        
        if (!payload) {
          // Fallback: reconstruct from DB
          const zones = layoutData.zones.map(mapZoneFromDb);
          const seats = layoutData.seats.map(mapSeatFromDb);
          setZones(zones);
          
          if (seats.length > 0) {
            rebuildCanvasFromSeats(seats, { silent: true });
            if (latestTables.length) {
              hydrateTablesFromDatabase(latestTables, layoutData.seats);
            }
            toast.success("Layout reconstruido desde base de datos");
          } else {
            toast.info("No hay datos de layout disponibles");
          }
        } else {
          applyRemoteLayout(payload, { silent: true });
          toast.success("Layout recargado desde el servidor");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo recargar";
        toast.error(message);
      } finally {
        setLoadingLayout(false);
      }
      return;
    }

    const savedData = localStorage.getItem('boleteraMapData');
    if (!savedData) { toast.error("No hay datos"); return; }
    const parsed = JSON.parse(savedData);
    fabricCanvas.loadFromJSON(parsed.canvas, () => {
        ensureCanvasBorder(fabricCanvas);
        fabricCanvas.requestRenderAll();
        if(showGrid) drawGridLines(fabricCanvas);
      fitCanvasToViewport();
        
        setZones(parsed.zones || []);
        toast.success("Mapa cargado");
        saveHistory();
    });
  };

  const handleClear = () => {
    if (!fabricCanvas) return;
    fabricCanvas.clear();
    fabricCanvas.backgroundColor = "#ffffff";
    
    // Restore border
    ensureCanvasBorder(fabricCanvas);
    
    // Restaurar grid
    if(showGrid) drawGridLines(fabricCanvas);
    fitCanvasToViewport();
    
    fabricCanvas.requestRenderAll();
    setZones([]);
    toast.success("Lienzo limpio");
    saveHistory();
  };

  // --- Función para cambiar estado de asientos ---
  const handleChangeSeatStatus = (status: SeatStatus) => {
    if (!fabricCanvas || selectedObjects.length === 0) return;
    
    // Include both _customType seats AND plain circles (legacy seats)
    const seats = selectedObjects.filter(obj => 
      obj._customType === "seat" || (obj.type === 'Circle' && !obj._customType)
    );
    
    if (seats.length === 0) {
      toast.warning("Selecciona al menos un asiento");
      return;
    }

    const statusColors: Record<SeatStatus, string> = {
      available: "#10B981",
      reserved: "#F59E0B", 
      sold: "#EF4444",
      blocked: "#6B7280",
      selected: "#3B82F6"
    };

    seats.forEach(seat => {
      // Upgrade legacy circles to proper seats
      if (!seat._customType) {
        seat._customType = 'seat';
        seat.status = 'available';
      }
      
      seat.status = status;
      seat.set('fill', statusColors[status]);
      
      if (status === "sold" || status === "reserved") {
        (seat as any).reservedAt = new Date();
      }
    });

    fabricCanvas.requestRenderAll();
    setIsDirty(true);
    toast.success(`${seats.length} asiento(s) marcado(s) como ${status}`);
    saveHistory();
  };

  // --- Validación de overlapping de asientos ---
  const checkSeatOverlap = (newSeat: FabricObject): boolean => {
    if (!fabricCanvas) return false;
    
    const objects = fabricCanvas.getObjects().filter((obj: any) => obj._customType === 'seat');
    const newBounds = newSeat.getBoundingRect();
    
    for (const obj of objects) {
      if (obj === newSeat) continue;
      const objBounds = obj.getBoundingRect();
      
      // Verificar intersección
      if (!(newBounds.left + newBounds.width < objBounds.left ||
            objBounds.left + objBounds.width < newBounds.left ||
            newBounds.top + newBounds.height < objBounds.top ||
            objBounds.top + objBounds.height < newBounds.top)) {
        return true; // Hay overlap
      }
    }
    return false;
  };

  // --- Función para contar asientos por estado ---
  const seatStatistics = useMemo(() => {
    // canvasVersion is used to force recalculation when canvas changes
    if (!fabricCanvas || canvasVersion < 0) return null;
    
    // Get ALL objects from canvas
    const allObjects = fabricCanvas.getObjects();
    
    // Debug: log object types
    console.log("[seatStatistics] Total objects:", allObjects.length);
    const typeCounts: Record<string, number> = {};
    allObjects.forEach((obj: any) => {
      const type = obj.type || 'unknown';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });
    console.log("[seatStatistics] Object types:", typeCounts);
    
    // Count circles as seats (they represent seats in legacy layouts)
    // Also count objects with _customType === 'seat'
    const seats = allObjects.filter((obj: any) => 
      obj._customType === 'seat' || 
      obj.type === 'Circle' || 
      obj.type === 'circle'
    );
    
    console.log("[seatStatistics] Seats found:", seats.length);
    
    const getStatus = (s: any) => s.status || 'available'; // Default to available if no status
    
    const stats = {
      total: seats.length,
      available: seats.filter(s => getStatus(s) === 'available').length,
      reserved: seats.filter(s => getStatus(s) === 'reserved').length,
      sold: seats.filter(s => getStatus(s) === 'sold').length,
      blocked: seats.filter(s => getStatus(s) === 'blocked').length,
      selected: seats.filter(s => getStatus(s) === 'selected').length,
    };
    
    return stats;
  }, [fabricCanvas, canvasVersion]);

  // --- Función para buscar asiento por nombre ---
  const handleSearchSeat = (seatName: string) => {
    if (!fabricCanvas) return;
    
    const allObjects = fabricCanvas.getObjects() as CustomFabricObject[];
    const seat = allObjects.find((obj: any) => {
      const isSeat = obj._customType === 'seat' || (obj.type === 'Circle' && !obj._customType);
      if (!isSeat) return false;
      
      // Search by name or by label pattern (e.g., "A1", "B15")
      const objName = obj.name?.toLowerCase() || '';
      const searchLower = seatName.toLowerCase();
      return objName === searchLower || objName.includes(searchLower);
    });
    
    if (seat) {
      fabricCanvas.setActiveObject(seat);
      
      // Centrar vista en el asiento
      const center = seat.getCenterPoint();
      const vpt = fabricCanvas.viewportTransform || [1, 0, 0, 1, 0, 0];
      vpt[4] = fabricCanvas.width! / 2 - center.x * vpt[0];
      vpt[5] = fabricCanvas.height! / 2 - center.y * vpt[3];
      fabricCanvas.setViewportTransform(vpt);
      
      fabricCanvas.requestRenderAll();
      toast.success(`Asiento ${seatName} encontrado`);
    } else {
      toast.error(`Asiento ${seatName} no encontrado`);
    }
  };

  // --- Funciones de Exportación ---
  const handleExportImage = () => {
    if (!fabricCanvas) return;
    fabricCanvas.discardActiveObject();
    fabricCanvas.requestRenderAll();

    const dataURL = fabricCanvas.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: 2 // Alta calidad
    });

    const link = document.createElement('a');
    link.download = `mapa-asientos-${Date.now()}.png`;
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Imagen exportada");
  };

  const handleExportJSON = () => {
    if (!fabricCanvas) return;
    const json = fabricCanvas.toJSON(['id', 'name', 'price', 'capacity', 'zoneId', '_customType', 'status', 'seatType', 'tableId', 'attachedSeats', 'lockMovementX', 'lockMovementY', 'lockScalingX', 'lockScalingY', 'lockRotation', 'hasControls', 'selectable']);
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ canvas: json, zones }));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `mapa-${Date.now()}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    toast.success("Archivo JSON exportado");
  };

  // Show loading state while creating layout
  if (isCreatingLayout) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-80px)] bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Creando layout para el venue...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] bg-background overflow-hidden">
      {/* Event Mode Header */}
      {isEventMode && eventLayoutData && (
        <div className="bg-cyan-500/10 border-b border-cyan-500/20 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-cyan-300">📍 Editando layout del evento:</span>
            <span className="font-semibold text-white">{eventLayoutData.eventName}</span>
            <span className="text-xs text-slate-400">en {eventLayoutData.venueName}</span>
          </div>
          <a 
            href={`/admin/events/${eventId}`} 
            className="text-xs text-cyan-400 hover:text-cyan-300 underline"
          >
            ← Volver al evento
          </a>
        </div>
      )}
      
      <div className="flex gap-3 p-3 flex-1 overflow-hidden">
      {/* Left Panel - Tabs */}
      <div className="w-[300px] flex flex-col h-full">
        <Tabs defaultValue="tools" className="flex flex-col h-full">
          <TabsList className="grid grid-cols-5 mb-2">
            <TabsTrigger value="tools" className="text-xs px-1">🛠️ Herram.</TabsTrigger>
            <TabsTrigger value="generate" className="text-xs px-1">➕ Crear</TabsTrigger>
            <TabsTrigger value="properties" className="text-xs px-1">⚙️ Props</TabsTrigger>
            <TabsTrigger value="zones" className="text-xs px-1">📍 Zonas</TabsTrigger>
            <TabsTrigger value="sections" className="text-xs px-1">🔲 Secc.</TabsTrigger>
          </TabsList>
          
          {/* Tab: Herramientas */}
          <TabsContent value="tools" className="flex-1 overflow-y-auto mt-0">
            <div className="bg-card rounded-xl shadow-lg p-3 border border-border space-y-3">
              {/* MEJORA: Banner informativo en modo evento */}
              {isEventMode && (
                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3 mb-2">
                  <p className="text-xs text-cyan-300 font-medium mb-1">📍 Modo Evento Activo</p>
                  <p className="text-[10px] text-slate-400">
                    El layout del evento es de solo lectura. Use el panel "Props" para gestionar estados de asientos.
                  </p>
                </div>
              )}

              {/* Toggle rápido para ocultar asientos - VISIBLE ARRIBA */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2">
                <label className="flex items-center gap-2 cursor-pointer" title="Oculta asientos para mejor rendimiento al editar polígonos">
                  <input 
                    type="checkbox" 
                    checked={showSeats}
                    onChange={(e) => setShowSeats(e.target.checked)}
                    className="h-4 w-4 rounded"
                  />
                  <span className="text-xs font-medium">🪑 Mostrar Asientos</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">{!showSeats && '(ocultos para edición rápida)'}</span>
                </label>
              </div>
              
              {/* Undo/Redo - Más compacto */}
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={handleUndo} disabled={historyIndex <= 0 || isEventMode} className="flex-1 h-8" title="Deshacer (Ctrl+Z)">
                  <Undo2 className="h-3.5 w-3.5 mr-1" /> <span className="text-xs">Deshacer</span>
                </Button>
                <Button variant="outline" size="sm" onClick={handleRedo} disabled={historyIndex >= history.length - 1 || isEventMode} className="flex-1 h-8" title="Rehacer (Ctrl+Y)">
                  <Redo2 className="h-3.5 w-3.5 mr-1" /> <span className="text-xs">Rehacer</span>
                </Button>
              </div>

              <Separator />

              {/* Drawing Tools - Grid 3 columnas */}
              <div>
                <h4 className="text-[10px] font-semibold mb-1.5 text-muted-foreground uppercase tracking-wider">Dibujo</h4>
                <div className="grid grid-cols-3 gap-1">
                  <Button
                    variant={activeTool === "select" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleToolClick("select")}
                    className="h-8 flex-col gap-0.5 p-1"
                    title="Seleccionar (V)"
                    disabled={isEventMode}
                  >
                    <MousePointer2 className="h-4 w-4" />
                    <span className="text-[10px]">Selec.</span>
                  </Button>
                  <Button
                    variant={activeTool === "hand" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleToolClick("hand")}
                    className="h-8 flex-col gap-0.5 p-1"
                    title="Mover vista (H)"
                  >
                    <Hand className="h-4 w-4" />
                    <span className="text-[10px]">Mover</span>
                  </Button>
                  <Button
                    variant={activeTool === "rectangle" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleToolClick("rectangle")}
                    className="h-8 flex-col gap-0.5 p-1"
                    title="Rectángulo (R)"
                    disabled={isEventMode}
                  >
                    <Square className="h-4 w-4" />
                    <span className="text-[10px]">Rect.</span>
                  </Button>
                  <Button
                    variant={activeTool === "circle" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleToolClick("circle")}
                    className="h-8 flex-col gap-0.5 p-1"
                    title="Asiento/Círculo (C)"
                    disabled={isEventMode}
                  >
                    <CircleIcon className="h-4 w-4" />
                    <span className="text-[10px]">Asiento</span>
                  </Button>
                  <Button
                    variant={activeTool === "polygon" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleToolClick("polygon")}
                    className="h-8 flex-col gap-0.5 p-1"
                    title="Polígono (P)"
                    disabled={isEventMode}
                  >
                    <Pentagon className="h-4 w-4" />
                    <span className="text-[10px]">Polígono</span>
                  </Button>
                  <Button
                    variant={activeTool === "text" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleToolClick("text")}
                    className="h-8 flex-col gap-0.5 p-1"
                    title="Texto (T)"
                    disabled={isEventMode}
                  >
                    <Type className="h-4 w-4" />
                    <span className="text-[10px]">Texto</span>
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Actions - Más compacto */}
              <div>
                <h4 className="text-[10px] font-semibold mb-1.5 text-muted-foreground uppercase tracking-wider">Acciones</h4>
                <div className="space-y-1.5">
                  <div className="grid grid-cols-4 gap-1">
                    <Button variant="outline" size="sm" onClick={handleDuplicate} disabled={isEventMode} className="h-8 flex-col gap-0 p-1" title="Duplicar selección (Ctrl+D)">
                      <Copy className="h-3.5 w-3.5" />
                      <span className="text-[9px]">Duplicar</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleSaveCanvas} disabled={savingLayout || isEventMode} className="h-8 flex-col gap-0 p-1" title={isEventMode ? "No disponible en modo evento" : "Guardar (Ctrl+S)"}>
                      <Save className="h-3.5 w-3.5" />
                      <span className="text-[9px]">{savingLayout ? "..." : "Guardar"}</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleLoadCanvas} disabled={loadingLayout || layoutLoading} className="h-8 flex-col gap-0 p-1" title="Recargar desde servidor">
                      <Upload className="h-3.5 w-3.5" />
                      <span className="text-[9px]">Cargar</span>
                    </Button>
                    <Button variant="destructive" size="sm" onClick={handleClear} disabled={isEventMode} className="h-8 flex-col gap-0 p-1" title={isEventMode ? "No disponible en modo evento" : "Limpiar todo"}>
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="text-[9px]">Limpiar</span>
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <Button variant="outline" size="sm" onClick={handleExportImage} className="h-7 text-xs gap-1">
                      <ImageIcon className="h-3 w-3" /> Exportar PNG
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportJSON} className="h-7 text-xs gap-1">
                      <FileJson className="h-3 w-3" /> Exportar JSON
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              {/* View Options - Horizontal */}
              <div>
                <h4 className="text-[10px] font-semibold mb-1.5 text-muted-foreground uppercase tracking-wider">Vista</h4>
                <div className="flex gap-3 flex-wrap">
                  <label className={`flex items-center gap-1.5 text-xs ${isEventMode ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                    <input 
                      type="checkbox" 
                      checked={previewMode}
                      onChange={(e) => setPreviewMode(e.target.checked)}
                      className="h-3.5 w-3.5 rounded"
                      disabled={isEventMode}
                    />
                    🔒 Preview {isEventMode && '(forzado)'}
                  </label>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={showGrid}
                      onChange={(e) => setShowGrid(e.target.checked)}
                      className="h-3.5 w-3.5 rounded"
                    />
                    📐 Grid
                  </label>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer" title="Oculta asientos para mejor rendimiento al editar polígonos">
                    <input 
                      type="checkbox" 
                      checked={showSeats}
                      onChange={(e) => setShowSeats(e.target.checked)}
                      className="h-3.5 w-3.5 rounded"
                    />
                    🪑 Asientos
                  </label>
                </div>
              </div>

              <Separator />

              {/* Background */}
              <div>
                <h4 className="text-xs font-semibold mb-2 text-muted-foreground uppercase">Imagen de Referencia</h4>
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" disabled={previewMode} />
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => fileInputRef.current?.click()} 
                  className="w-full mb-2"
                  disabled={previewMode}
                >
                  📷 Cargar Imagen
                </Button>
                
                {bgImageObject && (
                  <div className="grid grid-cols-2 gap-1 mb-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleSendImageToBack}
                      disabled={previewMode}
                      className="text-xs"
                    >
                      ⬇️ Enviar al Fondo
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleRemoveBackgroundImage}
                      disabled={previewMode}
                      className="text-xs text-destructive"
                    >
                      🗑️ Eliminar
                    </Button>
                  </div>
                )}
                
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Opacidad:</span>
                  <Slider 
                    value={[bgOpacity]} 
                    max={1} 
                    step={0.05} 
                    onValueChange={handleOpacityChange} 
                    disabled={previewMode || !bgImageObject} 
                    className="flex-1" 
                  />
                </div>
                {bgImageObject && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    💡 Selecciona la imagen en el canvas para moverla/redimensionarla
                  </p>
                )}
              </div>

              <Separator />

              {/* Color Picker */}
              <div>
                <h4 className="text-xs font-semibold mb-2 text-muted-foreground uppercase">Color Activo</h4>
                <ColorPicker color={activeColor} onChange={setActiveColor} />
              </div>
            </div>
          </TabsContent>

          {/* Tab: Crear/Generar */}
          <TabsContent value="generate" className="flex-1 overflow-y-auto mt-0 space-y-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <TableGenerator onAddTable={handleAddTable} zones={zones} />
              </div>
              {isRemoteSession && venueId && (
                <Button
                  onClick={() => setShowTableGenerator(true)}
                  variant="outline"
                  size="sm"
                  title="Generar mesa desde BD"
                  className="h-auto"
                >
                  🗄️ DB
                </Button>
              )}
            </div>
            <SeatingGenerator onGenerate={handleGenerateSeating} zones={zones} />
          </TabsContent>

          {/* Tab: Propiedades */}
          <TabsContent value="properties" className="flex-1 overflow-y-auto mt-0 space-y-3">
            {/* SeatStatusManager solo en modo evento - en venue solo se diseña */}
            {isEventMode ? (
              <SeatStatusManager 
                statistics={seatStatistics}
                onChangeStatus={handleChangeSeatStatus}
                onSearchSeat={handleSearchSeat}
              />
            ) : (
              <div className="rounded-[16px] border border-white/10 bg-white/5 p-4 text-white">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-slate-400">📋 Estadísticas del Layout</p>
                  <button 
                    onClick={() => updateCanvasVersion()}
                    className="text-xs text-cyan-400 hover:text-cyan-300"
                  >
                    ↻ Actualizar
                  </button>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total asientos:</span>
                    <span className="font-semibold text-emerald-300">{seatStatistics?.total ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Objetos en canvas:</span>
                    <span className="font-semibold text-slate-300">{fabricCanvas?.getObjects()?.length ?? 0}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-3 border-t border-white/10 pt-3">
                  💡 Los estados (reservado, vendido, bloqueado) se gestionan por evento, no en el diseño base del venue.
                </p>
              </div>
            )}
            <PropertiesPanel 
              selectedObjects={selectedObjects} 
              onUpdate={handleUpdateProperties} 
              onAlign={handleAlign}
              onDistribute={handleDistribute}
              onGroup={handleGroup}
              onUngroup={handleUngroup}
              zones={zones}
            />
          </TabsContent>

          {/* Tab: Zonas */}
          <TabsContent value="zones" className="flex-1 overflow-y-auto mt-0">
            <ZoneManager 
              zones={zones}
              onToggleVisibility={handleToggleZoneVisibility}
              onDeleteZone={handleDeleteZone}
              onSelectZone={handleSelectZone}
              onMoveLayer={handleMoveLayer}
              onRenameZone={handleRenameZone}
            />
          </TabsContent>

          {/* Tab: Secciones (Layouts Jerárquicos) */}
          <TabsContent value="sections" className="flex-1 overflow-y-auto mt-0">
            <SectionManager 
              sections={sections}
              layoutId={effectiveLayoutId ?? undefined}
              isHierarchical={isHierarchicalMode}
              isPanToolActive={activeTool === "hand"}
              onTogglePanTool={() => {
                if (activeTool === "hand") {
                  setActiveTool("select");
                } else {
                  setActiveTool("hand");
                }
              }}
              onSelectSection={(sectionId) => {
                // Find and select the section on canvas
                const sectionObj = fabricCanvas?.getObjects().find(
                  (obj: any) => obj.id === sectionId && obj._customType === "section"
                );
                if (sectionObj && fabricCanvas) {
                  fabricCanvas.setActiveObject(sectionObj);
                  fabricCanvas.requestRenderAll();
                }
              }}
              onDeleteSection={(sectionId) => {
                // Remove from canvas
                const sectionObj = fabricCanvas?.getObjects().find(
                  (obj: any) => obj.id === sectionId && obj._customType === "section"
                );
                if (sectionObj && fabricCanvas) {
                  fabricCanvas.remove(sectionObj);
                  fabricCanvas.requestRenderAll();
                }
                // Remove from state
                setSections(prev => prev.filter(s => s.id !== sectionId));
                toast.success("Sección eliminada");
                saveHistory();
              }}
              onToggleVisibility={(sectionId) => {
                const sectionObj = fabricCanvas?.getObjects().find(
                  (obj: any) => obj.id === sectionId && obj._customType === "section"
                );
                if (sectionObj && fabricCanvas) {
                  const currentVisible = sectionObj.visible !== false;
                  sectionObj.set({ visible: !currentVisible });
                  fabricCanvas.requestRenderAll();
                  setSections(prev => prev.map(s => 
                    s.id === sectionId ? { ...s, visible: !currentVisible } : s
                  ));
                }
              }}
              onEditSection={(section) => {
                // Open edit modal or update properties
                toast.info(`Editando sección: ${section.name}`);
              }}
              onUpdateSection={(sectionId, updates) => {
                // Update section in state
                setSections(prev => prev.map(s => 
                  s.id === sectionId ? { ...s, ...updates } : s
                ));
                // Update on canvas
                const sectionObj = fabricCanvas?.getObjects().find(
                  (obj: any) => obj.id === sectionId && obj._customType === "section"
                ) as CustomFabricObject | undefined;
                if (sectionObj && fabricCanvas) {
                  // Check if it's a Group (section with polygon + label)
                  const isGroup = (sectionObj as any).getObjects !== undefined;
                  
                  if (isGroup) {
                    const groupObjects = (sectionObj as any).getObjects() as FabricObject[];
                    const polygon = groupObjects.find((o: any) => o.type === 'polygon');
                    const textLabel = groupObjects.find((o: any) => o.type === 'i-text' || o.type === 'text');
                    
                    if (updates.name) {
                      sectionObj.name = updates.name;
                      // Update the text label inside the group
                      if (textLabel) {
                        (textLabel as any).set('text', updates.name);
                      }
                    }
                    if (updates.color) {
                      // Update the polygon fill and stroke
                      if (polygon) {
                        polygon.set('fill', updates.color + '60');
                        polygon.set('stroke', updates.color);
                      }
                      (sectionObj as any).color = updates.color;
                    }
                  } else {
                    // Simple polygon without group
                    if (updates.name) {
                      sectionObj.name = updates.name;
                    }
                    if (updates.color) {
                      sectionObj.set('fill', updates.color + '60');
                      sectionObj.set('stroke', updates.color);
                      (sectionObj as any).color = updates.color;
                    }
                  }
                  
                  if (updates.capacity !== undefined) {
                    (sectionObj as any).capacity = updates.capacity;
                  }
                  if (updates.price !== undefined) {
                    (sectionObj as any).price = updates.price;
                  }
                  fabricCanvas.requestRenderAll();
                }
                toast.success("Sección actualizada");
                saveHistory();
              }}
              onOpenChildLayout={(sectionId, childLayoutId) => {
                // Navigate to child layout editor
                if (effectiveVenueId) {
                  navigate(`/canvas?venueId=${effectiveVenueId}&layoutId=${childLayoutId}`);
                }
              }}
              onCreateSection={(shapeType) => {
                if (shapeType === "circle") {
                  setActiveTool("section-circle");
                  toast.info("Dibuja una sección circular: Haz clic para el centro y arrastra para definir el radio");
                } else if (shapeType === "arc") {
                  setActiveTool("section-arc");
                  toast.info("Dibuja un arco: Haz clic para el centro, luego para el radio, y finalmente para los ángulos");
                } else {
                  setActiveTool("section");
                  toast.info("Dibuja la sección: Haz clic para agregar puntos, cierra el polígono o presiona Enter");
                }
              }}
              onGenerateSeats={(sectionId, seats, options) => {
                if (!fabricCanvas) return;
                
                // Get the section's zone (if any) for the seats
                const section = sections.find(s => s.id === sectionId);
                const zoneId = section?.zoneId;
                
                // Create seat circles for each generated seat
                const createdSeats: CustomFabricObject[] = [];
                
                seats.forEach((seat) => {
                  const seatCircle = new Circle({
                    left: seat.x - (options.seatSize ?? 28) / 2,
                    top: seat.y - (options.seatSize ?? 28) / 2,
                    radius: (options.seatSize ?? 28) / 2,
                    fill: section?.color ?? "#0EA5E9",
                    stroke: "#1e293b",
                    strokeWidth: 1,
                    selectable: true,
                    hasControls: true,
                    originX: "left",
                    originY: "top",
                  }) as any as CustomFabricObject;
                  
                  // Add custom properties
                  seatCircle.id = seat.id;
                  seatCircle.name = seat.label;
                  seatCircle._customType = "seat";
                  seatCircle.seatType = "regular";
                  seatCircle.status = "available";
                  seatCircle.sectionId = sectionId;
                  if (zoneId) {
                    seatCircle.zoneId = zoneId;
                  }
                  
                  // Store row/number in metadata
                  (seatCircle as any).row = seat.row;
                  (seatCircle as any).seatNumber = seat.number;
                  
                  fabricCanvas.add(seatCircle as any);
                  createdSeats.push(seatCircle);
                });
                
                fabricCanvas.requestRenderAll();
                
                // Update section capacity
                setSections(prev => prev.map(s => 
                  s.id === sectionId 
                    ? { ...s, capacity: seats.length, seatCount: seats.length }
                    : s
                ));
                
                toast.success(`${seats.length} asientos generados en "${section?.name}"`);
                saveHistory();
              }}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Canvas Area - Takes most space */}
      <div
        className="flex-1 bg-[#0b1120] rounded-xl shadow-2xl overflow-hidden border-2 border-border relative"
        ref={containerRef}
      >
        <canvas ref={canvasRef} className="absolute top-0 left-0" />
        
        {/* Canvas Info Badge + Save Indicator */}
        <div className="absolute top-4 left-4 flex items-center gap-3 z-10">
          <div className="bg-black/60 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full border border-white/20 flex items-center gap-2 pointer-events-none">
            <span className="font-mono">📐 {CANVAS_WIDTH} × {CANVAS_HEIGHT}px</span>
          </div>
          {isRemoteSession && <SaveIndicator />}
        </div>
        
        {/* Zoom Controls - Componente centralizado */}
        <div className="absolute bottom-4 right-4 z-10">
          <ZoomControls 
            variant="floating" 
            showSlider={true}
            showPresets={true}
          />
        </div>
      </div>

      {isRemoteSession && venueId && (
        <TableGeneratorModal
          open={showTableGenerator}
          onClose={() => setShowTableGenerator(false)}
          venueId={venueId}
          zones={zones.map((z) => ({ id: z.id, name: z.name, color: z.color }))}
          canvasCenter={{ x: fabricCanvas?.getWidth() ? fabricCanvas.getWidth() / 2 : 540, y: fabricCanvas?.getHeight() ? fabricCanvas.getHeight() / 2 : 540 }}
          onTableCreated={() => {
            handleLoadCanvas();
            toast.info("Refresca el canvas para ver la nueva mesa");
          }}
        />
      )}

      {showSeatInspector && inspectedSeat && isRemoteSession && venueId && (
        <SeatInspector
          seatId={inspectedSeat.id}
          seatLabel={inspectedSeat.label}
          venueId={venueId}
          currentAddOns={inspectedSeat.addOns}
          onClose={() => {
            setShowSeatInspector(false);
            setInspectedSeat(null);
          }}
          onSave={handleSeatInspectorSave}
        />
      )}

      {/* Modal para renombrar zona desde el canvas */}
      <Dialog open={showZoneRenameModal} onOpenChange={(open) => {
        if (!open) {
          setShowZoneRenameModal(false);
          setZoneToRename(null);
          setZoneNewName("");
        }
      }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Renombrar Zona</DialogTitle>
            <DialogDescription>
              Ingresa el nuevo nombre para la zona
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-3">
              {zoneToRename && (
                <div
                  className="w-6 h-6 rounded-full border-2 border-border flex-shrink-0"
                  style={{ backgroundColor: zoneToRename.color }}
                />
              )}
              <Input
                value={zoneNewName}
                onChange={(e) => setZoneNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && zoneNewName.trim() && zoneToRename) {
                    handleRenameZone(zoneToRename.id, zoneNewName.trim());
                    setShowZoneRenameModal(false);
                    setZoneToRename(null);
                    setZoneNewName("");
                  } else if (e.key === 'Escape') {
                    setShowZoneRenameModal(false);
                    setZoneToRename(null);
                    setZoneNewName("");
                  }
                }}
                placeholder="Nombre de la zona"
                className="flex-1"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowZoneRenameModal(false);
              setZoneToRename(null);
              setZoneNewName("");
            }}>
              Cancelar
            </Button>
            <Button 
              onClick={() => {
                if (zoneToRename && zoneNewName.trim()) {
                  handleRenameZone(zoneToRename.id, zoneNewName.trim());
                  setShowZoneRenameModal(false);
                  setZoneToRename(null);
                  setZoneNewName("");
                }
              }} 
              disabled={!zoneNewName.trim()}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de conflicto de versión */}
      <Dialog open={showConflictDialog} onOpenChange={setShowConflictDialog}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              Conflicto de Versión
            </DialogTitle>
            <DialogDescription>
              El layout fue modificado mientras lo editabas.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            {conflictData && (
              <>
                <p className="text-sm text-muted-foreground">
                  Tu versión: <strong>{conflictData.requestedVersion}</strong>
                </p>
                <p className="text-sm text-muted-foreground">
                  Versión actual en servidor: <strong>{conflictData.currentVersion}</strong>
                </p>
                {conflictData.lastEditedBy && (
                  <p className="text-sm text-muted-foreground">
                    Última edición por: <strong>{conflictData.lastEditedBy}</strong>
                  </p>
                )}
              </>
            )}
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Opciones:</strong>
              </p>
              <ul className="text-sm text-amber-700 dark:text-amber-300 mt-2 space-y-1 list-disc list-inside">
                <li><strong>Recargar:</strong> Descarta tus cambios y carga la versión más reciente</li>
                <li><strong>Sobrescribir:</strong> Guarda tus cambios ignorando la otra versión (solo admin)</li>
              </ul>
            </div>
          </div>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowConflictDialog(false);
                setConflictData(null);
                // Recargar la página para obtener los datos frescos
                window.location.reload();
              }}
            >
              Recargar Página
            </Button>
            <Button 
              variant="destructive"
              onClick={async () => {
                setShowConflictDialog(false);
                setConflictData(null);
                await handleForceSave();
              }}
            >
              Sobrescribir (Admin)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
};
