/**
 * useZoomController Hook
 * 
 * Centraliza TODA la lógica de zoom del canvas.
 * 
 * Mejoras sobre la implementación anterior:
 * 1. Límites de zoom consistentes (ZOOM_CONFIG)
 * 2. Viewport limitado para que el canvas no se "pierda"
 * 3. Zoom al punto del cursor (wheel) o al centro (botones)
 * 4. Factor de zoom más responsivo
 * 5. Integración con Zustand store
 */

import { useCallback, useRef } from 'react';
import { Point } from 'fabric';
import { useCanvasStore } from '@/stores/canvasStore';
import { 
  ZOOM_CONFIG, 
  CANVAS_CONFIG, 
  VIEWPORT_CONFIG 
} from '@/lib/canvas-constants';

export interface ZoomControllerReturn {
  /** Nivel de zoom actual (0.1 - 5) */
  zoomLevel: number;
  /** Porcentaje de zoom (10 - 500) */
  zoomPercentage: number;
  
  // Handlers
  /** Handler para evento wheel del mouse */
  handleWheel: (e: WheelEvent) => void;
  /** Zoom in con botón */
  handleZoomIn: () => void;
  /** Zoom out con botón */
  handleZoomOut: () => void;
  /** Ajustar al viewport */
  handleFitToScreen: () => void;
  /** Zoom a 100% */
  handleZoom100: () => void;
  /** Zoom a preset específico */
  handleZoomToPreset: (preset: number) => void;
  
  // Utilidades
  /** Zoom a un punto específico */
  zoomToPoint: (newZoom: number, point: Point) => void;
  /** Zoom al centro del viewport */
  zoomToCenter: (newZoom: number) => void;
  /** Limitar viewport para que el canvas no se pierda */
  limitViewport: () => void;
  /** Sincronizar zoom del store con Fabric */
  syncZoomToCanvas: () => void;
  /** Obtener centro del viewport actual */
  getViewportCenter: () => Point | null;
}

export function useZoomController(): ZoomControllerReturn {
  const { 
    fabricCanvas, 
    containerRef,
    zoomLevel,
    setZoom,
    setPan,
  } = useCanvasStore();

  // Ref para throttling del wheel
  const wheelThrottleRef = useRef<number>(0);

  /**
   * Limita el viewport para que el canvas no se "pierda"
   * Se llama después de cada operación de zoom/pan
   */
  const limitViewport = useCallback(() => {
    if (!fabricCanvas || !containerRef) return;
    
    const vpt = fabricCanvas.viewportTransform;
    if (!vpt) return;
    
    const zoom = fabricCanvas.getZoom();
    const containerWidth = containerRef.clientWidth;
    const containerHeight = containerRef.clientHeight;
    const contentWidth = CANVAS_CONFIG.WIDTH * zoom;
    const contentHeight = CANVAS_CONFIG.HEIGHT * zoom;
    
    const overscroll = VIEWPORT_CONFIG.OVERSCROLL;
    
    let minX: number, maxX: number, minY: number, maxY: number;
    
    // Si el contenido es más pequeño que el container, centrar
    if (contentWidth <= containerWidth) {
      minX = maxX = (containerWidth - contentWidth) / 2;
    } else {
      // Permitir un poco de overscroll
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
      fabricCanvas.setViewportTransform(vpt);
    }
    
    // Sincronizar con store
    setPan(vpt[4], vpt[5]);
  }, [fabricCanvas, containerRef, setPan]);

  /**
   * Obtiene el centro del viewport en coordenadas del canvas
   */
  const getViewportCenter = useCallback((): Point | null => {
    if (!fabricCanvas || !containerRef) return null;
    
    const vpt = fabricCanvas.viewportTransform;
    if (!vpt) return null;
    
    const currentZoom = fabricCanvas.getZoom();
    
    // Calcular centro del viewport visible en coordenadas del canvas
    const centerX = (containerRef.clientWidth / 2 - vpt[4]) / currentZoom;
    const centerY = (containerRef.clientHeight / 2 - vpt[5]) / currentZoom;
    
    return new Point(centerX, centerY);
  }, [fabricCanvas, containerRef]);

  /**
   * Zoom hacia un punto específico (usado por wheel)
   */
  const zoomToPoint = useCallback((newZoom: number, point: Point) => {
    if (!fabricCanvas) return;
    
    // Aplicar límites de zoom
    const clampedZoom = Math.min(
      ZOOM_CONFIG.MAX, 
      Math.max(ZOOM_CONFIG.MIN, newZoom)
    );
    
    // Aplicar zoom al punto
    fabricCanvas.zoomToPoint(point, clampedZoom);
    
    // Actualizar store
    setZoom(clampedZoom);
    
    // Limitar viewport después del zoom
    limitViewport();
    
    // Renderizar
    fabricCanvas.requestRenderAll();
  }, [fabricCanvas, setZoom, limitViewport]);

  /**
   * Zoom hacia el centro del viewport (usado por botones)
   */
  const zoomToCenter = useCallback((newZoom: number) => {
    const center = getViewportCenter();
    if (!center) return;
    
    zoomToPoint(newZoom, center);
  }, [getViewportCenter, zoomToPoint]);

  /**
   * Handler para mouse wheel - zoom suave al cursor
   */
  const handleWheel = useCallback((e: WheelEvent) => {
    if (!fabricCanvas) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Throttling simple para evitar zoom muy rápido
    const now = Date.now();
    if (now - wheelThrottleRef.current < 16) return; // ~60fps
    wheelThrottleRef.current = now;
    
    const currentZoom = fabricCanvas.getZoom();
    
    // Determinar dirección y calcular nuevo zoom
    // Usamos WHEEL_FACTOR que es más responsivo que 0.999^delta
    const direction = e.deltaY < 0 ? 1 : -1;
    const newZoom = direction > 0 
      ? currentZoom * ZOOM_CONFIG.WHEEL_FACTOR 
      : currentZoom / ZOOM_CONFIG.WHEEL_FACTOR;
    
    // Zoom al punto del cursor
    const point = new Point(e.offsetX, e.offsetY);
    zoomToPoint(newZoom, point);
  }, [fabricCanvas, zoomToPoint]);

  /**
   * Zoom in con botón (+15%)
   */
  const handleZoomIn = useCallback(() => {
    const newZoom = Math.min(zoomLevel * ZOOM_CONFIG.STEP, ZOOM_CONFIG.MAX);
    zoomToCenter(newZoom);
  }, [zoomLevel, zoomToCenter]);

  /**
   * Zoom out con botón (-15%)
   */
  const handleZoomOut = useCallback(() => {
    const newZoom = Math.max(zoomLevel / ZOOM_CONFIG.STEP, ZOOM_CONFIG.MIN);
    zoomToCenter(newZoom);
  }, [zoomLevel, zoomToCenter]);

  /**
   * Fit to Screen - ajusta el canvas al viewport con padding
   */
  const handleFitToScreen = useCallback(() => {
    if (!fabricCanvas || !containerRef) return;
    
    const containerWidth = containerRef.clientWidth;
    const containerHeight = containerRef.clientHeight;
    
    // Calcular zoom para que quepa
    const scaleX = containerWidth / CANVAS_CONFIG.WIDTH;
    const scaleY = containerHeight / CANVAS_CONFIG.HEIGHT;
    const fitZoom = Math.min(scaleX, scaleY) * ZOOM_CONFIG.FIT_PADDING;
    
    // Aplicar zoom
    fabricCanvas.setZoom(fitZoom);
    setZoom(fitZoom);
    
    // Centrar el canvas
    const vpt = fabricCanvas.viewportTransform!;
    vpt[4] = (containerWidth - CANVAS_CONFIG.WIDTH * fitZoom) / 2;
    vpt[5] = (containerHeight - CANVAS_CONFIG.HEIGHT * fitZoom) / 2;
    fabricCanvas.setViewportTransform(vpt);
    
    // Actualizar pan en store
    setPan(vpt[4], vpt[5]);
    
    fabricCanvas.requestRenderAll();
  }, [fabricCanvas, containerRef, setZoom, setPan]);

  /**
   * Zoom a 100%
   */
  const handleZoom100 = useCallback(() => {
    zoomToCenter(1);
  }, [zoomToCenter]);

  /**
   * Zoom a un preset específico (25%, 50%, 100%, etc.)
   */
  const handleZoomToPreset = useCallback((preset: number) => {
    const clampedPreset = Math.min(
      ZOOM_CONFIG.MAX, 
      Math.max(ZOOM_CONFIG.MIN, preset)
    );
    zoomToCenter(clampedPreset);
  }, [zoomToCenter]);

  /**
   * Sincroniza el zoom del store con el canvas de Fabric
   * Útil cuando el store cambia externamente
   */
  const syncZoomToCanvas = useCallback(() => {
    if (!fabricCanvas) return;
    
    const currentCanvasZoom = fabricCanvas.getZoom();
    
    // Solo sincronizar si hay diferencia significativa
    if (Math.abs(currentCanvasZoom - zoomLevel) > 0.001) {
      const center = getViewportCenter();
      if (center) {
        fabricCanvas.zoomToPoint(center, zoomLevel);
      } else {
        fabricCanvas.setZoom(zoomLevel);
      }
      limitViewport();
      fabricCanvas.requestRenderAll();
    }
  }, [fabricCanvas, zoomLevel, getViewportCenter, limitViewport]);

  return {
    zoomLevel,
    zoomPercentage: Math.round(zoomLevel * 100),
    
    handleWheel,
    handleZoomIn,
    handleZoomOut,
    handleFitToScreen,
    handleZoom100,
    handleZoomToPreset,
    
    zoomToPoint,
    zoomToCenter,
    limitViewport,
    syncZoomToCanvas,
    getViewportCenter,
  };
}
