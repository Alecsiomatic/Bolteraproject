/**
 * Zones Store
 * 
 * Maneja el estado de las zonas del venue.
 * Separado para optimizar re-renders y mantener código organizado.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// =============================================================================
// TYPES
// =============================================================================

export interface Zone {
  id: string;
  name: string;
  color?: string;
  type?: 'section' | 'vip' | 'general' | 'custom' | 'accessible';
  price?: number;
  capacity?: number;
  visible?: boolean;
}

interface ZonesState {
  /** Lista de zonas */
  zones: Zone[];
  /** Zona actualmente siendo editada */
  editingZoneId: string | null;
}

interface ZonesActions {
  // CRUD
  /** Establecer todas las zonas (útil al cargar desde servidor) */
  setZones: (zones: Zone[]) => void;
  /** Agregar una nueva zona */
  addZone: (zone: Zone) => void;
  /** Actualizar una zona existente */
  updateZone: (id: string, updates: Partial<Zone>) => void;
  /** Eliminar una zona */
  deleteZone: (id: string) => void;
  
  // Visibilidad
  /** Toggle visibilidad de una zona */
  toggleZoneVisibility: (id: string) => void;
  /** Establecer visibilidad de una zona */
  setZoneVisibility: (id: string, visible: boolean) => void;
  /** Mostrar todas las zonas */
  showAllZones: () => void;
  /** Ocultar todas las zonas */
  hideAllZones: () => void;
  
  // Ordenamiento
  /** Mover zona hacia arriba en la lista */
  moveZoneUp: (id: string) => void;
  /** Mover zona hacia abajo en la lista */
  moveZoneDown: (id: string) => void;
  /** Reordenar zonas */
  reorderZones: (fromIndex: number, toIndex: number) => void;
  
  // Edición
  /** Establecer zona en modo edición */
  setEditingZone: (id: string | null) => void;
  
  // Utilidades
  /** Obtener zona por ID */
  getZoneById: (id: string) => Zone | undefined;
  /** Obtener zonas visibles */
  getVisibleZones: () => Zone[];
  /** Limpiar todas las zonas */
  clearZones: () => void;
}

// =============================================================================
// INITIAL STATE
// =============================================================================

const initialState: ZonesState = {
  zones: [],
  editingZoneId: null,
};

// =============================================================================
// STORE
// =============================================================================

export const useZonesStore = create<ZonesState & ZonesActions>()(
  devtools(
    immer((set, get) => ({
      ...initialState,

      // =========================
      // CRUD
      // =========================
      setZones: (zones) => set(
        (state) => { state.zones = zones; },
        false,
        'zones/setZones'
      ),

      addZone: (zone) => set(
        (state) => { 
          // Evitar duplicados
          if (!state.zones.find(z => z.id === zone.id)) {
            state.zones.push(zone); 
          }
        },
        false,
        'zones/addZone'
      ),

      updateZone: (id, updates) => set(
        (state) => {
          const index = state.zones.findIndex(z => z.id === id);
          if (index !== -1) {
            state.zones[index] = { ...state.zones[index], ...updates };
          }
        },
        false,
        'zones/updateZone'
      ),

      deleteZone: (id) => set(
        (state) => {
          state.zones = state.zones.filter(z => z.id !== id);
          if (state.editingZoneId === id) {
            state.editingZoneId = null;
          }
        },
        false,
        'zones/deleteZone'
      ),

      // =========================
      // Visibilidad
      // =========================
      toggleZoneVisibility: (id) => set(
        (state) => {
          const zone = state.zones.find(z => z.id === id);
          if (zone) {
            zone.visible = !zone.visible;
          }
        },
        false,
        'zones/toggleVisibility'
      ),

      setZoneVisibility: (id, visible) => set(
        (state) => {
          const zone = state.zones.find(z => z.id === id);
          if (zone) {
            zone.visible = visible;
          }
        },
        false,
        'zones/setVisibility'
      ),

      showAllZones: () => set(
        (state) => {
          state.zones.forEach(zone => { zone.visible = true; });
        },
        false,
        'zones/showAll'
      ),

      hideAllZones: () => set(
        (state) => {
          state.zones.forEach(zone => { zone.visible = false; });
        },
        false,
        'zones/hideAll'
      ),

      // =========================
      // Ordenamiento
      // =========================
      moveZoneUp: (id) => set(
        (state) => {
          const index = state.zones.findIndex(z => z.id === id);
          if (index > 0) {
            const temp = state.zones[index];
            state.zones[index] = state.zones[index - 1];
            state.zones[index - 1] = temp;
          }
        },
        false,
        'zones/moveUp'
      ),

      moveZoneDown: (id) => set(
        (state) => {
          const index = state.zones.findIndex(z => z.id === id);
          if (index < state.zones.length - 1) {
            const temp = state.zones[index];
            state.zones[index] = state.zones[index + 1];
            state.zones[index + 1] = temp;
          }
        },
        false,
        'zones/moveDown'
      ),

      reorderZones: (fromIndex, toIndex) => set(
        (state) => {
          const [removed] = state.zones.splice(fromIndex, 1);
          state.zones.splice(toIndex, 0, removed);
        },
        false,
        'zones/reorder'
      ),

      // =========================
      // Edición
      // =========================
      setEditingZone: (id) => set(
        { editingZoneId: id },
        false,
        'zones/setEditing'
      ),

      // =========================
      // Utilidades
      // =========================
      getZoneById: (id) => {
        return get().zones.find(z => z.id === id);
      },

      getVisibleZones: () => {
        return get().zones.filter(z => z.visible !== false);
      },

      clearZones: () => set(
        (state) => {
          state.zones = [];
          state.editingZoneId = null;
        },
        false,
        'zones/clear'
      ),
    })),
    { 
      name: 'ZonesStore',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

// =============================================================================
// SELECTORES OPTIMIZADOS
// =============================================================================

/** Selector: todas las zonas */
export const useZones = () => useZonesStore((s) => s.zones);

/** Selector: cantidad de zonas */
export const useZonesCount = () => useZonesStore((s) => s.zones.length);

/** Selector: zonas visibles */
export const useVisibleZones = () => useZonesStore((s) => s.zones.filter(z => z.visible !== false));

/** Selector: zona en edición */
export const useEditingZoneId = () => useZonesStore((s) => s.editingZoneId);

/** Selector: obtener zona por ID (función, no hook) */
export const getZoneById = (id: string) => useZonesStore.getState().zones.find(z => z.id === id);
