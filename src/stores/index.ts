/**
 * Stores Index
 * 
 * Re-exporta todos los stores de Zustand para importación simplificada.
 * 
 * Uso:
 * import { useCanvasStore, useSelectionStore, useHistoryStore } from '@/stores';
 */

// Canvas Store
export { 
  useCanvasStore,
  useZoom,
  useActiveTool,
  useActiveColor,
  useIsDirty,
  useIsSaving,
  useIsPreviewMode,
  useGridEnabled,
  useSnapEnabled,
  useSaveStatus,
  useFabricCanvas,
  useContainerRef,
  type ToolType,
} from './canvasStore';

// Selection Store
export {
  useSelectionStore,
  useSelectedIds,
  useSelectedObjects,
  useSelectionCount,
  useHasSelection,
  useIsMultipleSelection,
  useFirstSelectedObject,
  useSelectionMode,
  type CustomFabricObject,
  type SelectionMode,
} from './selectionStore';

// History Store
export {
  useHistoryStore,
  useCanUndo,
  useCanRedo,
  useHistoryPresent,
  useHistoryPaused,
  useHistoryCount,
  type HistoryEntry,
} from './historyStore';

// Zones Store
export {
  useZonesStore,
  useZones,
  useZonesCount,
  useVisibleZones,
  useEditingZoneId,
  getZoneById,
  type Zone,
} from './zonesStore';
