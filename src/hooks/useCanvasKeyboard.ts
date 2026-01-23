/**
 * useCanvasKeyboard Hook
 * 
 * Maneja todos los atajos de teclado del canvas.
 * 
 * Atajos soportados:
 * - Ctrl/Cmd + Z: Undo
 * - Ctrl/Cmd + Y / Ctrl/Cmd + Shift + Z: Redo
 * - Ctrl/Cmd + D: Duplicar
 * - Ctrl/Cmd + A: Seleccionar todo
 * - Ctrl/Cmd + +/=: Zoom In
 * - Ctrl/Cmd + -: Zoom Out
 * - Ctrl/Cmd + 0: Fit to Screen
 * - Ctrl/Cmd + 1: Zoom 100%
 * - Delete: Eliminar selección (solo tecla Suprimir)
 * - Escape: Limpiar selección / Cancelar herramienta
 * - Flechas: Mover selección (con Shift = x10)
 */

import { useEffect, useCallback } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useHistoryStore } from '@/stores/historyStore';
import { useZoomController } from './useZoomController';

export interface CanvasKeyboardOptions {
  /** Callback cuando se presiona Delete */
  onDelete?: () => void;
  /** Callback cuando se presiona Ctrl+D */
  onDuplicate?: () => void;
  /** Callback cuando se presiona Ctrl+A */
  onSelectAll?: () => void;
  /** Callback cuando se hace Undo */
  onUndo?: () => void;
  /** Callback cuando se hace Redo */
  onRedo?: () => void;
  /** Callback cuando se presiona Escape */
  onEscape?: () => void;
  /** Callback para mover selección con flechas */
  onMove?: (dx: number, dy: number) => void;
  /** Habilitar/deshabilitar todos los atajos */
  enabled?: boolean;
}

export function useCanvasKeyboard(options: CanvasKeyboardOptions = {}) {
  const {
    onDelete,
    onDuplicate,
    onSelectAll,
    onUndo,
    onRedo,
    onEscape,
    onMove,
    enabled = true,
  } = options;

  const { 
    handleZoomIn, 
    handleZoomOut, 
    handleFitToScreen, 
    handleZoom100,
    handleZoomToPreset,
  } = useZoomController();
  
  const { canUndo, canRedo } = useHistoryStore();
  const { setActiveTool } = useCanvasStore();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    // Ignorar si está en un input, textarea o contenteditable
    const target = e.target as HTMLElement;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target.isContentEditable
    ) {
      return;
    }

    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;

    // =========================================
    // ZOOM SHORTCUTS
    // =========================================
    
    // Ctrl/Cmd + Plus/Equal: Zoom In
    if (isCtrlOrCmd && (e.key === '+' || e.key === '=')) {
      e.preventDefault();
      handleZoomIn();
      return;
    }

    // Ctrl/Cmd + Minus: Zoom Out
    if (isCtrlOrCmd && e.key === '-') {
      e.preventDefault();
      handleZoomOut();
      return;
    }

    // Ctrl/Cmd + 0: Fit to Screen
    if (isCtrlOrCmd && e.key === '0') {
      e.preventDefault();
      handleFitToScreen();
      return;
    }

    // Ctrl/Cmd + 1: Zoom 100%
    if (isCtrlOrCmd && e.key === '1') {
      e.preventDefault();
      handleZoom100();
      return;
    }

    // Ctrl/Cmd + 2: Zoom 200%
    if (isCtrlOrCmd && e.key === '2') {
      e.preventDefault();
      handleZoomToPreset(2);
      return;
    }

    // Ctrl/Cmd + 5: Zoom 50%
    if (isCtrlOrCmd && e.key === '5') {
      e.preventDefault();
      handleZoomToPreset(0.5);
      return;
    }

    // =========================================
    // UNDO/REDO
    // =========================================

    // Ctrl/Cmd + Z: Undo (sin Shift)
    if (isCtrlOrCmd && e.key === 'z' && !isShift) {
      e.preventDefault();
      if (canUndo && onUndo) {
        onUndo();
      }
      return;
    }

    // Ctrl/Cmd + Y: Redo
    // Ctrl/Cmd + Shift + Z: Redo (alternativo)
    if (isCtrlOrCmd && (e.key === 'y' || (e.key === 'z' && isShift))) {
      e.preventDefault();
      if (canRedo && onRedo) {
        onRedo();
      }
      return;
    }

    // =========================================
    // EDIT SHORTCUTS
    // =========================================

    // Ctrl/Cmd + D: Duplicar
    if (isCtrlOrCmd && e.key === 'd') {
      e.preventDefault();
      onDuplicate?.();
      return;
    }

    // Ctrl/Cmd + A: Seleccionar todo
    if (isCtrlOrCmd && e.key === 'a') {
      e.preventDefault();
      onSelectAll?.();
      return;
    }

    // Delete: Eliminar (solo con tecla Suprimir, no Backspace)
    if (e.key === 'Delete') {
      e.preventDefault();
      onDelete?.();
      return;
    }

    // =========================================
    // NAVIGATION & CANCEL
    // =========================================

    // Escape: Cancelar/Limpiar selección
    if (e.key === 'Escape') {
      e.preventDefault();
      onEscape?.();
      // También cambiar a herramienta select
      setActiveTool('select');
      return;
    }

    // =========================================
    // ARROW KEYS: Mover selección
    // =========================================
    
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      if (!onMove) return;
      
      e.preventDefault();
      
      // Con Shift se mueve 10px, sin Shift 1px
      const step = isShift ? 10 : 1;
      
      let dx = 0;
      let dy = 0;
      
      switch (e.key) {
        case 'ArrowUp':
          dy = -step;
          break;
        case 'ArrowDown':
          dy = step;
          break;
        case 'ArrowLeft':
          dx = -step;
          break;
        case 'ArrowRight':
          dx = step;
          break;
      }
      
      onMove(dx, dy);
      return;
    }

    // =========================================
    // TOOL SHORTCUTS (sin modificadores)
    // =========================================
    
    if (!isCtrlOrCmd && !isShift) {
      switch (e.key.toLowerCase()) {
        case 'v':
          e.preventDefault();
          setActiveTool('select');
          break;
        case 'h':
          e.preventDefault();
          setActiveTool('hand');
          break;
        case 'r':
          e.preventDefault();
          setActiveTool('rectangle');
          break;
        case 'c':
          e.preventDefault();
          setActiveTool('circle');
          break;
        case 'p':
          e.preventDefault();
          setActiveTool('polygon');
          break;
        case 't':
          e.preventDefault();
          setActiveTool('text');
          break;
        case 'g':
          e.preventDefault();
          setActiveTool('seating-grid');
          break;
      }
    }
  }, [
    enabled,
    handleZoomIn,
    handleZoomOut,
    handleFitToScreen,
    handleZoom100,
    handleZoomToPreset,
    canUndo,
    canRedo,
    onDelete,
    onDuplicate,
    onSelectAll,
    onUndo,
    onRedo,
    onEscape,
    onMove,
    setActiveTool,
  ]);

  // Agregar/remover event listener
  useEffect(() => {
    if (!enabled) return;
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, enabled]);

  return {
    /** Lista de atajos para mostrar en UI (help) */
    shortcuts: [
      { key: 'Ctrl/⌘ + Z', action: 'Deshacer' },
      { key: 'Ctrl/⌘ + Y', action: 'Rehacer' },
      { key: 'Ctrl/⌘ + D', action: 'Duplicar' },
      { key: 'Ctrl/⌘ + A', action: 'Seleccionar todo' },
      { key: 'Ctrl/⌘ + +', action: 'Zoom In' },
      { key: 'Ctrl/⌘ + -', action: 'Zoom Out' },
      { key: 'Ctrl/⌘ + 0', action: 'Ajustar a pantalla' },
      { key: 'Ctrl/⌘ + 1', action: 'Zoom 100%' },
      { key: 'Delete', action: 'Eliminar' },
      { key: 'Escape', action: 'Cancelar / Deseleccionar' },
      { key: 'Flechas', action: 'Mover selección' },
      { key: 'Shift + Flechas', action: 'Mover x10' },
      { key: 'V', action: 'Herramienta Selección' },
      { key: 'H', action: 'Herramienta Mover' },
      { key: 'R', action: 'Herramienta Rectángulo' },
      { key: 'C', action: 'Herramienta Círculo' },
      { key: 'P', action: 'Herramienta Polígono' },
      { key: 'T', action: 'Herramienta Texto' },
      { key: 'G', action: 'Herramienta Grid de Asientos' },
    ],
  };
}
