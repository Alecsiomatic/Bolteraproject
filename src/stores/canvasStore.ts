/**
 * Canvas Store
 * 
 * Store principal de Zustand para el estado del canvas.
 * Maneja: zoom, pan, herramientas, grid, estado de guardado.
 * 
 * Usa middleware:
 * - devtools: Para debugging con Redux DevTools
 * - persist: Para guardar preferencias en localStorage
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { Canvas as FabricCanvas } from 'fabric';
import { ZOOM_CONFIG, CANVAS_CONFIG } from '@/lib/canvas-constants';

// =============================================================================
// TYPES
// =============================================================================

export type ToolType = 
  | 'select' 
  | 'hand' 
  | 'rectangle' 
  | 'circle' 
  | 'polygon' 
  | 'seating-grid' 
  | 'text';

interface CanvasState {
  // Referencias (NO persistidas - se setean en runtime)
  fabricCanvas: FabricCanvas | null;
  containerRef: HTMLDivElement | null;
  
  // Estado de vista
  zoomLevel: number;
  panX: number;
  panY: number;
  
  // Herramientas
  activeTool: ToolType;
  activeColor: string;
  
  // Configuración
  gridEnabled: boolean;
  snapEnabled: boolean;
  
  // Estado de guardado
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: Date | null;
  layoutVersion: number;
  saveError: string | null;
  
  // Preview mode
  previewMode: boolean;
  
  // Loading
  isLoading: boolean;
}

interface CanvasActions {
  // Referencias
  setFabricCanvas: (canvas: FabricCanvas | null) => void;
  setContainerRef: (ref: HTMLDivElement | null) => void;
  
  // Zoom - acciones básicas (la lógica compleja está en useZoomController)
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  
  // Pan
  setPan: (x: number, y: number) => void;
  
  // Herramientas
  setActiveTool: (tool: ToolType) => void;
  setActiveColor: (color: string) => void;
  
  // Configuración
  toggleGrid: () => void;
  toggleSnap: () => void;
  setGridEnabled: (enabled: boolean) => void;
  setSnapEnabled: (enabled: boolean) => void;
  
  // Estado de guardado
  setDirty: (dirty: boolean) => void;
  setSaving: (saving: boolean) => void;
  setLastSavedAt: (date: Date) => void;
  setLayoutVersion: (version: number) => void;
  setSaveError: (error: string | null) => void;
  
  // Preview mode
  setPreviewMode: (preview: boolean) => void;
  
  // Loading
  setLoading: (loading: boolean) => void;
  
  // Reset
  resetView: () => void;
  resetAll: () => void;
}

// =============================================================================
// INITIAL STATE
// =============================================================================

const initialState: CanvasState = {
  fabricCanvas: null,
  containerRef: null,
  zoomLevel: ZOOM_CONFIG.DEFAULT,
  panX: 0,
  panY: 0,
  activeTool: 'select',
  activeColor: '#3B82F6',
  gridEnabled: true,
  snapEnabled: true,
  isDirty: false,
  isSaving: false,
  lastSavedAt: null,
  layoutVersion: 0,
  saveError: null,
  previewMode: false,
  isLoading: false,
};

// =============================================================================
// STORE
// =============================================================================

export const useCanvasStore = create<CanvasState & CanvasActions>()(
  devtools(
    persist(
      (set, get) => ({
        // Estado inicial
        ...initialState,

        // =========================
        // Referencias
        // =========================
        setFabricCanvas: (canvas) => set({ fabricCanvas: canvas }, false, 'setFabricCanvas'),
        setContainerRef: (ref) => set({ containerRef: ref }, false, 'setContainerRef'),
        
        // =========================
        // Zoom
        // =========================
        setZoom: (zoom) => {
          const clampedZoom = Math.min(
            ZOOM_CONFIG.MAX, 
            Math.max(ZOOM_CONFIG.MIN, zoom)
          );
          set({ zoomLevel: clampedZoom }, false, 'setZoom');
        },
        
        zoomIn: () => {
          const { zoomLevel } = get();
          const newZoom = Math.min(zoomLevel * ZOOM_CONFIG.STEP, ZOOM_CONFIG.MAX);
          set({ zoomLevel: newZoom }, false, 'zoomIn');
        },
        
        zoomOut: () => {
          const { zoomLevel } = get();
          const newZoom = Math.max(zoomLevel / ZOOM_CONFIG.STEP, ZOOM_CONFIG.MIN);
          set({ zoomLevel: newZoom }, false, 'zoomOut');
        },
        
        // =========================
        // Pan
        // =========================
        setPan: (x, y) => set({ panX: x, panY: y }, false, 'setPan'),
        
        // =========================
        // Herramientas
        // =========================
        setActiveTool: (tool) => set({ activeTool: tool }, false, 'setActiveTool'),
        setActiveColor: (color) => set({ activeColor: color }, false, 'setActiveColor'),
        
        // =========================
        // Configuración
        // =========================
        toggleGrid: () => set(
          (state) => ({ gridEnabled: !state.gridEnabled }), 
          false, 
          'toggleGrid'
        ),
        toggleSnap: () => set(
          (state) => ({ snapEnabled: !state.snapEnabled }), 
          false, 
          'toggleSnap'
        ),
        setGridEnabled: (enabled) => set({ gridEnabled: enabled }, false, 'setGridEnabled'),
        setSnapEnabled: (enabled) => set({ snapEnabled: enabled }, false, 'setSnapEnabled'),
        
        // =========================
        // Estado de guardado
        // =========================
        setDirty: (dirty) => set({ isDirty: dirty }, false, 'setDirty'),
        setSaving: (saving) => set({ isSaving: saving, saveError: null }, false, 'setSaving'),
        setLastSavedAt: (date) => set({ 
          lastSavedAt: date, 
          isDirty: false,
          isSaving: false,
          saveError: null,
        }, false, 'setLastSavedAt'),
        setLayoutVersion: (version) => set({ layoutVersion: version }, false, 'setLayoutVersion'),
        setSaveError: (error) => set({ saveError: error, isSaving: false }, false, 'setSaveError'),
        
        // =========================
        // Preview mode
        // =========================
        setPreviewMode: (preview) => set({ previewMode: preview }, false, 'setPreviewMode'),
        
        // =========================
        // Loading
        // =========================
        setLoading: (loading) => set({ isLoading: loading }, false, 'setLoading'),
        
        // =========================
        // Reset
        // =========================
        resetView: () => set({
          zoomLevel: ZOOM_CONFIG.DEFAULT,
          panX: 0,
          panY: 0,
        }, false, 'resetView'),
        
        resetAll: () => set({
          ...initialState,
          // Mantener referencias
          fabricCanvas: get().fabricCanvas,
          containerRef: get().containerRef,
        }, false, 'resetAll'),
      }),
      {
        name: 'boletera-canvas-storage',
        version: 1,
        // Solo persistir preferencias del usuario, NO estado transitorio
        partialize: (state) => ({
          activeTool: state.activeTool,
          activeColor: state.activeColor,
          gridEnabled: state.gridEnabled,
          snapEnabled: state.snapEnabled,
        }),
      }
    ),
    { 
      name: 'CanvasStore',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

// =============================================================================
// SELECTORES OPTIMIZADOS
// Usar estos selectores evita re-renders innecesarios
// =============================================================================

/** Selector: nivel de zoom actual */
export const useZoom = () => useCanvasStore((s) => s.zoomLevel);

/** Selector: herramienta activa */
export const useActiveTool = () => useCanvasStore((s) => s.activeTool);

/** Selector: color activo */
export const useActiveColor = () => useCanvasStore((s) => s.activeColor);

/** Selector: hay cambios sin guardar */
export const useIsDirty = () => useCanvasStore((s) => s.isDirty);

/** Selector: está guardando */
export const useIsSaving = () => useCanvasStore((s) => s.isSaving);

/** Selector: modo preview activo */
export const useIsPreviewMode = () => useCanvasStore((s) => s.previewMode);

/** Selector: grid habilitado */
export const useGridEnabled = () => useCanvasStore((s) => s.gridEnabled);

/** Selector: snap habilitado */
export const useSnapEnabled = () => useCanvasStore((s) => s.snapEnabled);

/** Selector: estado de guardado - isDirty */
export const useIsDirtySelector = () => useCanvasStore((s) => s.isDirty);

/** Selector: estado de guardado - isSaving */
export const useIsSavingSelector = () => useCanvasStore((s) => s.isSaving);

/** Selector: estado de guardado - lastSavedAt */
export const useLastSavedAtSelector = () => useCanvasStore((s) => s.lastSavedAt);

/** Selector: estado de guardado - saveError */
export const useSaveErrorSelector = () => useCanvasStore((s) => s.saveError);

/** 
 * Hook compuesto para estado de guardado
 * Usa selectores individuales para evitar re-renders innecesarios
 */
export const useSaveStatus = () => {
  const isDirty = useIsDirtySelector();
  const isSaving = useIsSavingSelector();
  const lastSavedAt = useLastSavedAtSelector();
  const saveError = useSaveErrorSelector();
  
  return { isDirty, isSaving, lastSavedAt, saveError };
};

/** Selector: instancia de Fabric canvas */
export const useFabricCanvas = () => useCanvasStore((s) => s.fabricCanvas);

/** Selector: referencia al container */
export const useContainerRef = () => useCanvasStore((s) => s.containerRef);
