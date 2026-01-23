/**
 * Selection Store
 * 
 * Maneja el estado de selección de objetos en el canvas.
 * Separado del canvasStore para optimizar re-renders.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { FabricObject } from 'fabric';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Objeto de Fabric extendido con propiedades custom de la aplicación
 */
export interface CustomFabricObject extends FabricObject {
  id: string;
  name?: string;
  zoneId?: string;
  price?: number;
  capacity?: number;
  status?: 'available' | 'reserved' | 'sold' | 'blocked' | 'selected';
  seatType?: 'regular' | 'vip' | 'accessible' | 'blocked';
  tableId?: string;
  row?: string;
  seatNumber?: number;
  _customType?: 'section' | 'seat' | 'text' | 'zone' | 'guide' | 'grid' | 'table';
}

export type SelectionMode = 'single' | 'multiple' | 'additive';

interface SelectionState {
  /** IDs de objetos seleccionados */
  selectedIds: string[];
  /** Objetos de Fabric seleccionados (referencia directa) */
  selectedObjects: CustomFabricObject[];
  /** Modo de selección actual */
  selectionMode: SelectionMode;
  /** Último objeto seleccionado (para shift-click range) */
  lastSelectedId: string | null;
}

interface SelectionActions {
  /** Establecer selección (reemplaza la actual) */
  setSelection: (ids: string[], objects: CustomFabricObject[]) => void;
  
  /** Agregar un objeto a la selección */
  addToSelection: (id: string, object: CustomFabricObject) => void;
  
  /** Agregar múltiples objetos a la selección */
  addMultipleToSelection: (ids: string[], objects: CustomFabricObject[]) => void;
  
  /** Remover un objeto de la selección */
  removeFromSelection: (id: string) => void;
  
  /** Toggle: si está seleccionado lo quita, si no lo agrega */
  toggleSelection: (id: string, object: CustomFabricObject) => void;
  
  /** Limpiar toda la selección */
  clearSelection: () => void;
  
  /** Seleccionar todos los objetos dados */
  selectAll: (ids: string[], objects: CustomFabricObject[]) => void;
  
  /** Seleccionar objetos por zona */
  selectByZone: (zoneId: string, objects: CustomFabricObject[]) => void;
  
  /** Seleccionar objetos por estado */
  selectByStatus: (status: string, objects: CustomFabricObject[]) => void;
  
  /** Seleccionar objetos por tipo */
  selectByType: (type: CustomFabricObject['_customType'], objects: CustomFabricObject[]) => void;
  
  /** Cambiar modo de selección */
  setSelectionMode: (mode: SelectionMode) => void;
  
  /** Verificar si un ID está seleccionado */
  isSelected: (id: string) => boolean;
}

// =============================================================================
// INITIAL STATE
// =============================================================================

const initialState: SelectionState = {
  selectedIds: [],
  selectedObjects: [],
  selectionMode: 'single',
  lastSelectedId: null,
};

// =============================================================================
// STORE
// =============================================================================

export const useSelectionStore = create<SelectionState & SelectionActions>()(
  devtools(
    (set, get) => ({
      ...initialState,

      setSelection: (ids, objects) => set({
        selectedIds: ids,
        selectedObjects: objects,
        lastSelectedId: ids.length > 0 ? ids[ids.length - 1] : null,
      }, false, 'setSelection'),

      addToSelection: (id, object) => set((state) => {
        // Evitar duplicados
        if (state.selectedIds.includes(id)) return state;
        
        return {
          selectedIds: [...state.selectedIds, id],
          selectedObjects: [...state.selectedObjects, object],
          lastSelectedId: id,
        };
      }, false, 'addToSelection'),

      addMultipleToSelection: (ids, objects) => set((state) => {
        const newIds = ids.filter(id => !state.selectedIds.includes(id));
        const newObjects = objects.filter(obj => !state.selectedIds.includes(obj.id));
        
        return {
          selectedIds: [...state.selectedIds, ...newIds],
          selectedObjects: [...state.selectedObjects, ...newObjects],
          lastSelectedId: newIds.length > 0 ? newIds[newIds.length - 1] : state.lastSelectedId,
        };
      }, false, 'addMultipleToSelection'),

      removeFromSelection: (id) => set((state) => ({
        selectedIds: state.selectedIds.filter((i) => i !== id),
        selectedObjects: state.selectedObjects.filter((o) => o.id !== id),
        lastSelectedId: state.lastSelectedId === id ? null : state.lastSelectedId,
      }), false, 'removeFromSelection'),

      toggleSelection: (id, object) => set((state) => {
        const isCurrentlySelected = state.selectedIds.includes(id);
        
        if (isCurrentlySelected) {
          return {
            selectedIds: state.selectedIds.filter((i) => i !== id),
            selectedObjects: state.selectedObjects.filter((o) => o.id !== id),
            lastSelectedId: state.lastSelectedId === id ? null : state.lastSelectedId,
          };
        } else {
          return {
            selectedIds: [...state.selectedIds, id],
            selectedObjects: [...state.selectedObjects, object],
            lastSelectedId: id,
          };
        }
      }, false, 'toggleSelection'),

      clearSelection: () => set({
        selectedIds: [],
        selectedObjects: [],
        lastSelectedId: null,
      }, false, 'clearSelection'),

      selectAll: (ids, objects) => set({
        selectedIds: ids,
        selectedObjects: objects,
        lastSelectedId: ids.length > 0 ? ids[ids.length - 1] : null,
      }, false, 'selectAll'),

      selectByZone: (zoneId, objects) => {
        const filtered = objects.filter(obj => obj.zoneId === zoneId);
        const ids = filtered.map(obj => obj.id);
        
        set({
          selectedIds: ids,
          selectedObjects: filtered,
          lastSelectedId: ids.length > 0 ? ids[ids.length - 1] : null,
        }, false, 'selectByZone');
      },

      selectByStatus: (status, objects) => {
        const filtered = objects.filter(obj => obj.status === status);
        const ids = filtered.map(obj => obj.id);
        
        set({
          selectedIds: ids,
          selectedObjects: filtered,
          lastSelectedId: ids.length > 0 ? ids[ids.length - 1] : null,
        }, false, 'selectByStatus');
      },

      selectByType: (type, objects) => {
        const filtered = objects.filter(obj => obj._customType === type);
        const ids = filtered.map(obj => obj.id);
        
        set({
          selectedIds: ids,
          selectedObjects: filtered,
          lastSelectedId: ids.length > 0 ? ids[ids.length - 1] : null,
        }, false, 'selectByType');
      },

      setSelectionMode: (mode) => set({ selectionMode: mode }, false, 'setSelectionMode'),

      isSelected: (id) => get().selectedIds.includes(id),
    }),
    { 
      name: 'SelectionStore',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

// =============================================================================
// SELECTORES OPTIMIZADOS
// =============================================================================

/** Selector: IDs seleccionados */
export const useSelectedIds = () => useSelectionStore((s) => s.selectedIds);

/** Selector: objetos seleccionados */
export const useSelectedObjects = () => useSelectionStore((s) => s.selectedObjects);

/** Selector: cantidad de objetos seleccionados */
export const useSelectionCount = () => useSelectionStore((s) => s.selectedIds.length);

/** Selector: hay algo seleccionado */
export const useHasSelection = () => useSelectionStore((s) => s.selectedIds.length > 0);

/** Selector: es selección múltiple */
export const useIsMultipleSelection = () => useSelectionStore((s) => s.selectedIds.length > 1);

/** Selector: primer objeto seleccionado (útil para panel de propiedades) */
export const useFirstSelectedObject = () => useSelectionStore((s) => s.selectedObjects[0] ?? null);

/** Selector: modo de selección */
export const useSelectionMode = () => useSelectionStore((s) => s.selectionMode);
