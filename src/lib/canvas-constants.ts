/**
 * Canvas Constants
 * 
 * Configuración centralizada para el sistema de canvas.
 * Todos los valores de zoom, viewport y canvas están aquí para
 * garantizar consistencia en toda la aplicación.
 */

// =============================================================================
// CANVAS DIMENSIONS
// =============================================================================

export const CANVAS_CONFIG = {
  /** Ancho base del canvas en píxeles */
  WIDTH: 1920,
  /** Alto base del canvas en píxeles */
  HEIGHT: 1080,
  /** Color de fondo del canvas */
  BACKGROUND_COLOR: '#1a1a2e',
} as const;

// =============================================================================
// ZOOM CONFIGURATION
// =============================================================================

export const ZOOM_CONFIG = {
  /** Zoom mínimo permitido (10%) */
  MIN: 0.1,
  /** Zoom máximo permitido (500%) */
  MAX: 5,
  /** Zoom por defecto al iniciar (100%) */
  DEFAULT: 1,
  /** Factor de zoom para botones +/- (15% por click) */
  STEP: 1.15,
  /** Factor de zoom para scroll del mouse (8% por scroll) - más responsivo */
  WHEEL_FACTOR: 1.08,
  /** Padding al hacer fit-to-screen (5% de margen) */
  FIT_PADDING: 0.95,
  /** Presets de zoom rápido */
  PRESETS: [0.25, 0.5, 0.75, 1, 1.5, 2, 3] as const,
} as const;

// =============================================================================
// VIEWPORT CONFIGURATION
// =============================================================================

export const VIEWPORT_CONFIG = {
  /** Porcentaje de overscroll permitido fuera del canvas (10%) */
  OVERSCROLL: 0.1,
  /** Velocidad de panning con teclado */
  PAN_SPEED: 20,
} as const;

// =============================================================================
// HISTORY (UNDO/REDO)
// =============================================================================

export const HISTORY_CONFIG = {
  /** Número máximo de estados en el historial */
  MAX_STATES: 50,
  /** Debounce en ms antes de guardar un nuevo estado */
  DEBOUNCE_MS: 300,
} as const;

// =============================================================================
// GRID CONFIGURATION
// =============================================================================

export const GRID_CONFIG = {
  /** Tamaño de celda del grid en píxeles */
  CELL_SIZE: 20,
  /** Color de las líneas del grid */
  LINE_COLOR: 'rgba(255, 255, 255, 0.1)',
  /** Color de las líneas principales (cada 5 celdas) */
  MAJOR_LINE_COLOR: 'rgba(255, 255, 255, 0.2)',
  /** Grosor de línea */
  LINE_WIDTH: 1,
} as const;

// =============================================================================
// SNAP CONFIGURATION
// =============================================================================

export const SNAP_CONFIG = {
  /** Distancia en píxeles para activar el snap */
  THRESHOLD: 10,
  /** Mostrar líneas guía al hacer snap */
  SHOW_GUIDES: true,
  /** Color de las líneas guía */
  GUIDE_COLOR: '#3B82F6',
} as const;

// =============================================================================
// SEAT CONFIGURATION
// =============================================================================

export const SEAT_CONFIG = {
  /** Radio por defecto de un asiento */
  DEFAULT_RADIUS: 12,
  /** Radio mínimo de un asiento */
  MIN_RADIUS: 8,
  /** Radio máximo de un asiento */
  MAX_RADIUS: 24,
  /** Espaciado por defecto entre asientos */
  DEFAULT_SPACING: 30,
  /** Colores por estado de asiento */
  STATUS_COLORS: {
    available: '#22C55E',   // green-500
    reserved: '#F59E0B',    // amber-500
    sold: '#EF4444',        // red-500
    blocked: '#6B7280',     // gray-500
    selected: '#3B82F6',    // blue-500
  },
  /** Colores por tipo de asiento */
  TYPE_COLORS: {
    regular: '#22C55E',
    vip: '#A855F7',         // purple-500
    accessible: '#06B6D4',  // cyan-500
    blocked: '#6B7280',
  },
} as const;

// =============================================================================
// ZONE CONFIGURATION
// =============================================================================

export const ZONE_CONFIG = {
  /** Opacidad de relleno de zona */
  FILL_OPACITY: 0.3,
  /** Grosor del borde de zona */
  STROKE_WIDTH: 2,
  /** Colores predefinidos para zonas */
  PRESET_COLORS: [
    '#3B82F6', // blue
    '#22C55E', // green
    '#F59E0B', // amber
    '#EF4444', // red
    '#A855F7', // purple
    '#06B6D4', // cyan
    '#F97316', // orange
    '#EC4899', // pink
  ],
} as const;

// =============================================================================
// AUTOSAVE CONFIGURATION
// =============================================================================

export const AUTOSAVE_CONFIG = {
  /** Intervalo de auto-guardado en ms (30 segundos) */
  INTERVAL_MS: 30000,
  /** Debounce antes de guardar después de un cambio */
  DEBOUNCE_MS: 2000,
  /** Mostrar notificación al auto-guardar */
  SHOW_NOTIFICATION: true,
} as const;

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type ZoomPreset = (typeof ZOOM_CONFIG.PRESETS)[number];
export type SeatStatus = keyof typeof SEAT_CONFIG.STATUS_COLORS;
export type SeatType = keyof typeof SEAT_CONFIG.TYPE_COLORS;
