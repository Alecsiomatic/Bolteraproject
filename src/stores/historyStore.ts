/**
 * History Store
 * 
 * Maneja el historial de estados para Undo/Redo.
 * 
 * IMPORTANTE: Este store solo guarda el estado del CONTENIDO (objetos, zonas),
 * NO el estado de la VISTA (zoom, pan). Esto es intencional - el usuario
 * espera que Undo revierta sus cambios de diseño, no su navegación.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { HISTORY_CONFIG } from '@/lib/canvas-constants';
import type { Zone } from './zonesStore';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Entrada en el historial
 * NO incluye zoom/viewport - son estado de vista, no de contenido
 */
export interface HistoryEntry {
  /** JSON serializado del canvas de Fabric */
  canvasJSON: string;
  /** Lista de zonas */
  zones: Zone[];
  /** Timestamp para debugging */
  timestamp: number;
  /** Descripción opcional de la acción (para debugging) */
  action?: string;
}

interface HistoryState {
  /** Estados anteriores (para undo) */
  past: HistoryEntry[];
  /** Estado actual */
  present: HistoryEntry | null;
  /** Estados futuros (para redo) */
  future: HistoryEntry[];
  /** Flag: se puede hacer undo */
  canUndo: boolean;
  /** Flag: se puede hacer redo */
  canRedo: boolean;
  /** Flag: historial pausado (útil durante operaciones batch) */
  isPaused: boolean;
}

interface HistoryActions {
  /**
   * Agregar un nuevo estado al historial
   * Esto limpia el stack de redo
   */
  push: (entry: Omit<HistoryEntry, 'timestamp'>) => void;
  
  /**
   * Deshacer: volver al estado anterior
   * Retorna el estado anterior o null si no hay
   */
  undo: () => HistoryEntry | null;
  
  /**
   * Rehacer: ir al siguiente estado
   * Retorna el siguiente estado o null si no hay
   */
  redo: () => HistoryEntry | null;
  
  /**
   * Establecer el estado presente sin afectar el historial
   * Útil para inicialización
   */
  setPresent: (entry: Omit<HistoryEntry, 'timestamp'>) => void;
  
  /**
   * Limpiar todo el historial
   */
  clear: () => void;
  
  /**
   * Pausar grabación de historial
   * Útil durante operaciones batch
   */
  pause: () => void;
  
  /**
   * Reanudar grabación de historial
   */
  resume: () => void;
  
  /**
   * Obtener el estado actual
   */
  getPresent: () => HistoryEntry | null;
  
  /**
   * Contar estados en el historial
   */
  getHistoryLength: () => { past: number; future: number };
}

// =============================================================================
// INITIAL STATE
// =============================================================================

const initialState: HistoryState = {
  past: [],
  present: null,
  future: [],
  canUndo: false,
  canRedo: false,
  isPaused: false,
};

// =============================================================================
// STORE
// =============================================================================

export const useHistoryStore = create<HistoryState & HistoryActions>()(
  devtools(
    (set, get) => ({
      ...initialState,

      push: (entry) => {
        const { isPaused, present, past } = get();
        
        // Si está pausado, no guardar
        if (isPaused) return;
        
        const newEntry: HistoryEntry = {
          ...entry,
          timestamp: Date.now(),
        };
        
        // Si hay estado presente, moverlo al pasado
        const newPast = present 
          ? [...past, present].slice(-HISTORY_CONFIG.MAX_STATES)
          : past;
        
        set({
          past: newPast,
          present: newEntry,
          future: [], // Limpiar redo stack al hacer nueva acción
          canUndo: newPast.length > 0 || present !== null,
          canRedo: false,
        }, false, `history/push${entry.action ? `: ${entry.action}` : ''}`);
      },

      undo: () => {
        const { past, present, future } = get();
        
        if (past.length === 0) return null;
        
        const previous = past[past.length - 1];
        const newPast = past.slice(0, -1);
        
        set({
          past: newPast,
          present: previous,
          future: present ? [present, ...future] : future,
          canUndo: newPast.length > 0,
          canRedo: true,
        }, false, 'history/undo');
        
        return previous;
      },

      redo: () => {
        const { past, present, future } = get();
        
        if (future.length === 0) return null;
        
        const next = future[0];
        const newFuture = future.slice(1);
        
        set({
          past: present ? [...past, present] : past,
          present: next,
          future: newFuture,
          canUndo: true,
          canRedo: newFuture.length > 0,
        }, false, 'history/redo');
        
        return next;
      },

      setPresent: (entry) => {
        const newEntry: HistoryEntry = {
          ...entry,
          timestamp: Date.now(),
        };
        
        set({
          present: newEntry,
        }, false, 'history/setPresent');
      },

      clear: () => set({
        ...initialState,
      }, false, 'history/clear'),

      pause: () => set({ isPaused: true }, false, 'history/pause'),

      resume: () => set({ isPaused: false }, false, 'history/resume'),

      getPresent: () => get().present,

      getHistoryLength: () => ({
        past: get().past.length,
        future: get().future.length,
      }),
    }),
    { 
      name: 'HistoryStore',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

// =============================================================================
// SELECTORES OPTIMIZADOS
// =============================================================================

/** Selector: se puede hacer undo */
export const useCanUndo = () => useHistoryStore((s) => s.canUndo);

/** Selector: se puede hacer redo */
export const useCanRedo = () => useHistoryStore((s) => s.canRedo);

/** Selector: estado presente */
export const useHistoryPresent = () => useHistoryStore((s) => s.present);

/** Selector: historial pausado */
export const useHistoryPaused = () => useHistoryStore((s) => s.isPaused);

/** Selector: cantidad de estados en historial */
export const useHistoryCount = () => useHistoryStore((s) => ({
  past: s.past.length,
  future: s.future.length,
  total: s.past.length + s.future.length + (s.present ? 1 : 0),
}));
