/**
 * Professional Polygon Seat Generator
 * 
 * Advanced seat generation for venue layouts with support for:
 * - Multiple numbering patterns (serpentine, center-out, etc.)
 * - Automatic alignment to polygon orientation
 * - Curved rows for stadium sections
 * - Focal point orientation (seats face the stage)
 * - Aisle gaps and seat skipping
 * - Fixed seats per row with smart distribution
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface GeneratedSeat {
  id: string;
  x: number;
  y: number;
  row: string;
  number: number;
  label: string;
  /** Rotation angle in degrees (for facing focal point) */
  rotation?: number;
}

/** Numbering pattern for seats within rows */
export type NumberingPattern = 
  | "left-to-right"     // Standard: 1,2,3,4,5...
  | "right-to-left"     // Reversed: 5,4,3,2,1...
  | "serpentine"        // Zigzag: Row1→, Row2←, Row3→...
  | "center-out"        // From center: ...3,1,2,4... (odd left, even right)
  | "center-out-paired"; // Paired from center: ...4,2,1,3,5...

/** Row alignment within the polygon */
export type RowAlignment = "left" | "center" | "right" | "justify";

/** Fill strategy for the polygon */
export type FillStrategy = 
  | "top-bottom"    // Fill from top to bottom
  | "bottom-top"    // Fill from bottom to top (common for theaters)
  | "center-out"    // Fill from center outward
  | "fit-shape";    // Adapt to polygon shape (curved sections)

/** Layout pattern */
export type LayoutPattern = "grid" | "staggered" | "curved" | "radial";

export interface SeatGenerationOptions {
  /** Target number of seats (may be less if polygon is too small) */
  capacity: number;
  /** Seat diameter/size in pixels */
  seatSize?: number;
  /** Spacing between seats */
  spacing?: number;
  /** Starting row letter (A, B, C...) */
  startRow?: string;
  /** Starting seat number */
  startNumber?: number;
  /** Layout pattern */
  pattern?: LayoutPattern;
  /** How to fill the polygon */
  fillStrategy?: FillStrategy;
  /** Section prefix for labels (e.g., "S1" → "S1-A1") */
  sectionPrefix?: string;
  
  // === ADVANCED OPTIONS ===
  
  /** Numbering pattern within rows */
  numberingPattern?: NumberingPattern;
  /** How rows align within the polygon */
  rowAlignment?: RowAlignment;
  /** Fixed number of seats per row (0 = auto) */
  seatsPerRow?: number;
  /** Row curvature for curved sections (0 = straight, 1 = follow polygon curve) */
  rowCurvature?: number;
  /** Focal point for seat rotation (e.g., stage position) */
  focalPoint?: Point2D;
  /** Whether seats should rotate to face focal point */
  rotatesToFocalPoint?: boolean;
  /** Aisle positions (seat numbers to skip for aisles) */
  aislePositions?: number[];
  /** Gap size for aisles in pixels */
  aisleGap?: number;
  /** Skip specific row letters */
  skipRows?: string[];
  /** Automatically align to polygon's main axis */
  autoAlign?: boolean;
  /** Manual rotation angle for the entire grid (degrees) */
  gridRotation?: number;
  /** Offset from polygon edges */
  edgeMargin?: number;
  /** Row spacing multiplier (1 = same as seat spacing) */
  rowSpacingMultiplier?: number;
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Check if a point is inside a polygon using ray casting algorithm
 */
export function isPointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
  let inside = false;
  const n = polygon.length;
  
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    
    const intersect = ((yi > point.y) !== (yj > point.y)) &&
      (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    
    if (intersect) inside = !inside;
  }
  
  return inside;
}

/**
 * Calculate the bounding box of a polygon
 */
export function getPolygonBounds(polygon: Point2D[]): { 
  minX: number; 
  minY: number; 
  maxX: number; 
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
} {
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  
  for (const point of polygon) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

/**
 * Calculate polygon area using Shoelace formula
 */
export function getPolygonArea(polygon: Point2D[]): number {
  let area = 0;
  const n = polygon.length;
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += polygon[i].x * polygon[j].y;
    area -= polygon[j].x * polygon[i].y;
  }
  
  return Math.abs(area) / 2;
}

/**
 * Get the centroid of a polygon
 */
export function getPolygonCentroid(polygon: Point2D[]): Point2D {
  let cx = 0, cy = 0;
  const n = polygon.length;
  const area = getPolygonArea(polygon);
  
  if (area === 0) {
    // Fallback to simple average for degenerate polygons
    for (const p of polygon) {
      cx += p.x;
      cy += p.y;
    }
    return { x: cx / n, y: cy / n };
  }
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const factor = (polygon[i].x * polygon[j].y - polygon[j].x * polygon[i].y);
    cx += (polygon[i].x + polygon[j].x) * factor;
    cy += (polygon[i].y + polygon[j].y) * factor;
  }
  
  const areaFactor = 1 / (6 * area);
  return {
    x: Math.abs(cx * areaFactor),
    y: Math.abs(cy * areaFactor),
  };
}

/**
 * Calculate the principal axis (orientation) of a polygon
 * Returns angle in radians
 */
export function getPolygonOrientation(polygon: Point2D[]): number {
  if (polygon.length < 2) return 0;
  
  // Find the longest edge
  let maxLength = 0;
  let longestEdgeAngle = 0;
  
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    const dx = polygon[j].x - polygon[i].x;
    const dy = polygon[j].y - polygon[i].y;
    const length = Math.hypot(dx, dy);
    
    if (length > maxLength) {
      maxLength = length;
      longestEdgeAngle = Math.atan2(dy, dx);
    }
  }
  
  return longestEdgeAngle;
}

/**
 * Rotate a point around a center
 */
function rotatePoint(point: Point2D, center: Point2D, angle: number): Point2D {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

/**
 * Calculate angle from point to focal point (for seat rotation)
 */
function getAngleToFocalPoint(point: Point2D, focalPoint: Point2D): number {
  const dx = focalPoint.x - point.x;
  const dy = focalPoint.y - point.y;
  return Math.atan2(dy, dx) * (180 / Math.PI); // Convert to degrees
}

/**
 * Generate a row label from index (A, B, C, ..., Z, AA, AB, ...)
 */
function getRowLabel(index: number, startRow: string = "A"): string {
  const startCode = startRow.charCodeAt(0);
  const adjustedIndex = index + (startCode - 65);
  
  if (adjustedIndex < 26) {
    return String.fromCharCode(65 + adjustedIndex);
  }
  
  // For indices >= 26, generate AA, AB, etc.
  const first = Math.floor(adjustedIndex / 26) - 1;
  const second = adjustedIndex % 26;
  return String.fromCharCode(65 + first) + String.fromCharCode(65 + second);
}

/**
 * Generate a short prefix from section name
 * Examples: "Sección A" -> "SA", "VIP Norte" -> "VN", "Platea 1" -> "P1"
 */
export function generateSectionPrefix(sectionName: string, sectionIndex?: number): string {
  if (!sectionName) {
    return sectionIndex !== undefined ? `S${sectionIndex + 1}` : 'S';
  }
  
  // Clean and normalize
  const cleaned = sectionName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .toUpperCase()
    .trim();
  
  // Try to extract meaningful prefix
  const words = cleaned.split(/[\s\-_]+/).filter(w => w.length > 0);
  
  if (words.length === 0) {
    return sectionIndex !== undefined ? `S${sectionIndex + 1}` : 'S';
  }
  
  if (words.length === 1) {
    const word = words[0];
    // If it's a single word with numbers, use first letter + number
    const match = word.match(/^([A-Z]+)(\d+)$/);
    if (match) {
      return `${match[1].charAt(0)}${match[2]}`;
    }
    // Otherwise use first 2 chars
    return word.slice(0, 2);
  }
  
  // Multiple words: use first letter of each (up to 3)
  return words.slice(0, 3).map(w => w.charAt(0)).join('');
}

/**
 * Apply numbering pattern to seat numbers in a row
 */
function applyNumberingPattern(
  seatCount: number,
  startNumber: number,
  pattern: NumberingPattern,
  isEvenRow: boolean
): number[] {
  const numbers: number[] = [];
  
  switch (pattern) {
    case "right-to-left":
      for (let i = seatCount - 1; i >= 0; i--) {
        numbers.push(startNumber + i);
      }
      break;
      
    case "serpentine":
      if (isEvenRow) {
        // Even rows: right to left
        for (let i = seatCount - 1; i >= 0; i--) {
          numbers.push(startNumber + i);
        }
      } else {
        // Odd rows: left to right
        for (let i = 0; i < seatCount; i++) {
          numbers.push(startNumber + i);
        }
      }
      break;
      
    case "center-out":
      // Odd numbers on left, even on right from center
      const center = Math.floor(seatCount / 2);
      for (let i = 0; i < seatCount; i++) {
        if (i % 2 === 0) {
          numbers.push(startNumber + center - Math.floor(i / 2));
        } else {
          numbers.push(startNumber + center + Math.ceil(i / 2));
        }
      }
      break;
      
    case "center-out-paired":
      // Paired from center outward: center, center+1, center-1, center+2...
      const mid = Math.floor(seatCount / 2);
      const result: number[] = new Array(seatCount);
      let leftIdx = mid;
      let rightIdx = mid + 1;
      
      for (let i = 0; i < seatCount; i++) {
        if (i % 2 === 0 && leftIdx >= 0) {
          result[leftIdx--] = startNumber + i;
        } else if (rightIdx < seatCount) {
          result[rightIdx++] = startNumber + i;
        } else if (leftIdx >= 0) {
          result[leftIdx--] = startNumber + i;
        }
      }
      return result.map(n => n ?? startNumber);
      
    case "left-to-right":
    default:
      for (let i = 0; i < seatCount; i++) {
        numbers.push(startNumber + i);
      }
      break;
  }
  
  return numbers;
}

/**
 * Get valid seat positions for a row, considering aisles
 */
function getRowPositions(
  y: number,
  startX: number,
  endX: number,
  cellSize: number,
  aislePositions: number[],
  aisleGap: number,
  rowAlignment: RowAlignment,
  seatsPerRow: number,
  polygon: Point2D[],
  edgeMargin: number
): { positions: Point2D[]; seatIndices: number[] } {
  const positions: Point2D[] = [];
  const seatIndices: number[] = [];
  
  // First pass: find all valid positions in this row
  const availableWidth = endX - startX - (edgeMargin * 2);
  let maxSeats = Math.floor(availableWidth / cellSize);
  
  if (seatsPerRow > 0 && seatsPerRow < maxSeats) {
    maxSeats = seatsPerRow;
  }
  
  // Calculate starting X based on alignment
  let rowStartX = startX + edgeMargin;
  const totalRowWidth = maxSeats * cellSize;
  
  switch (rowAlignment) {
    case "center":
      rowStartX = startX + (endX - startX - totalRowWidth) / 2;
      break;
    case "right":
      rowStartX = endX - totalRowWidth - edgeMargin;
      break;
    case "justify":
      // Will be handled differently - spread seats to fill width
      if (maxSeats > 1) {
        const spacing = (availableWidth - cellSize) / (maxSeats - 1);
        for (let i = 0; i < maxSeats; i++) {
          const x = startX + edgeMargin + (cellSize / 2) + (i * spacing);
          const point = { x, y };
          
          // Skip if this is an aisle position
          if (aislePositions.includes(i + 1)) continue;
          
          // Check if point is inside polygon
          if (isPointInPolygon(point, polygon)) {
            positions.push(point);
            seatIndices.push(i + 1);
          }
        }
        return { positions, seatIndices };
      }
      break;
    case "left":
    default:
      rowStartX = startX + edgeMargin;
      break;
  }
  
  // Standard alignment
  for (let i = 0; i < maxSeats; i++) {
    // Add aisle gap if needed
    let aisleOffset = 0;
    for (const aislePos of aislePositions) {
      if (i >= aislePos) {
        aisleOffset += aisleGap;
      }
    }
    
    const x = rowStartX + (cellSize / 2) + (i * cellSize) + aisleOffset;
    const point = { x, y };
    
    // Skip if this is an aisle position
    if (aislePositions.includes(i + 1)) continue;
    
    // Check if point is inside polygon with margin
    if (isPointInPolygon(point, polygon)) {
      positions.push(point);
      seatIndices.push(i + 1);
    }
  }
  
  return { positions, seatIndices };
}

// ============================================================
// MAIN GENERATION FUNCTIONS
// ============================================================

/**
 * Generate seats in a standard grid pattern
 */
function generateGridSeats(
  polygon: Point2D[],
  options: SeatGenerationOptions
): GeneratedSeat[] {
  const {
    capacity,
    seatSize = 28,
    spacing = 8,
    startRow = "A",
    startNumber = 1,
    sectionPrefix,
    numberingPattern = "left-to-right",
    rowAlignment = "center",
    seatsPerRow = 0,
    focalPoint,
    rotatesToFocalPoint = false,
    aislePositions = [],
    aisleGap = 40,
    skipRows = [],
    autoAlign = false,
    gridRotation = 0,
    edgeMargin = 10,
    rowSpacingMultiplier = 1,
  } = options;

  const bounds = getPolygonBounds(polygon);
  const centroid = getPolygonCentroid(polygon);
  const cellSize = seatSize + spacing;
  const rowHeight = cellSize * rowSpacingMultiplier;
  
  // Calculate rotation
  let rotation = gridRotation * (Math.PI / 180);
  if (autoAlign) {
    rotation = getPolygonOrientation(polygon);
  }
  
  // Transform polygon if rotated
  let workingPolygon = polygon;
  if (rotation !== 0) {
    workingPolygon = polygon.map(p => rotatePoint(p, centroid, -rotation));
  }
  
  const workingBounds = getPolygonBounds(workingPolygon);
  
  // Collect all valid positions
  const allSeats: GeneratedSeat[] = [];
  const rows = Math.ceil(workingBounds.height / rowHeight);
  
  let rowIndex = 0;
  let totalSeats = 0;
  
  for (let r = 0; r < rows && totalSeats < capacity; r++) {
    const y = workingBounds.minY + edgeMargin + (r * rowHeight) + (cellSize / 2);
    
    // Get row label, skipping specified rows
    let rowLabel = getRowLabel(rowIndex, startRow);
    while (skipRows.includes(rowLabel)) {
      rowIndex++;
      rowLabel = getRowLabel(rowIndex, startRow);
    }
    
    const { positions, seatIndices } = getRowPositions(
      y,
      workingBounds.minX,
      workingBounds.maxX,
      cellSize,
      aislePositions,
      aisleGap,
      rowAlignment,
      seatsPerRow,
      workingPolygon,
      edgeMargin
    );
    
    if (positions.length === 0) continue;
    
    // Apply numbering pattern
    const seatNumbers = applyNumberingPattern(
      positions.length,
      startNumber,
      numberingPattern,
      rowIndex % 2 === 0
    );
    
    // Create seats for this row
    for (let i = 0; i < positions.length && totalSeats < capacity; i++) {
      let pos = positions[i];
      
      // Rotate back if we rotated the polygon
      if (rotation !== 0) {
        pos = rotatePoint(pos, centroid, rotation);
      }
      
      const seatNum = seatNumbers[i];
      const label = sectionPrefix 
        ? `${sectionPrefix}-${rowLabel}${seatNum}` 
        : `${rowLabel}${seatNum}`;
      
      let seatRotation: number | undefined;
      if (rotatesToFocalPoint && focalPoint) {
        seatRotation = getAngleToFocalPoint(pos, focalPoint);
      }
      
      allSeats.push({
        id: `seat-${Date.now()}-${totalSeats}`,
        x: pos.x,
        y: pos.y,
        row: rowLabel,
        number: seatNum,
        label,
        rotation: seatRotation,
      });
      
      totalSeats++;
    }
    
    rowIndex++;
  }
  
  return allSeats;
}

/**
 * Generate seats in a staggered (honeycomb) pattern
 */
function generateStaggeredSeats(
  polygon: Point2D[],
  options: SeatGenerationOptions
): GeneratedSeat[] {
  const {
    capacity,
    seatSize = 28,
    spacing = 8,
    startRow = "A",
    startNumber = 1,
    sectionPrefix,
    numberingPattern = "left-to-right",
    focalPoint,
    rotatesToFocalPoint = false,
    skipRows = [],
    edgeMargin = 10,
    rowSpacingMultiplier = 1,
  } = options;

  const bounds = getPolygonBounds(polygon);
  const cellSize = seatSize + spacing;
  const rowHeight = cellSize * 0.866 * rowSpacingMultiplier; // sqrt(3)/2 for hexagonal packing
  
  const seats: GeneratedSeat[] = [];
  const rows = Math.ceil(bounds.height / rowHeight) + 1;
  
  let rowIndex = 0;
  let totalSeats = 0;
  
  for (let r = 0; r < rows && totalSeats < capacity; r++) {
    const offset = (r % 2) * (cellSize / 2);
    const y = bounds.minY + edgeMargin + r * rowHeight + cellSize / 2;
    
    // Get row label, skipping specified rows
    let rowLabel = getRowLabel(rowIndex, startRow);
    while (skipRows.includes(rowLabel)) {
      rowIndex++;
      rowLabel = getRowLabel(rowIndex, startRow);
    }
    
    // Collect valid positions for this row
    const rowPositions: Point2D[] = [];
    const cols = Math.ceil(bounds.width / cellSize) + 1;
    
    for (let c = 0; c < cols; c++) {
      const x = bounds.minX + edgeMargin + c * cellSize + offset + cellSize / 2;
      const point = { x, y };
      
      if (isPointInPolygon(point, polygon)) {
        // Check corners for better fit
        const halfSize = seatSize / 2 - 2;
        const corners = [
          { x: x - halfSize, y: y - halfSize },
          { x: x + halfSize, y: y - halfSize },
          { x: x - halfSize, y: y + halfSize },
          { x: x + halfSize, y: y + halfSize },
        ];
        
        if (corners.every(c => isPointInPolygon(c, polygon))) {
          rowPositions.push(point);
        }
      }
    }
    
    if (rowPositions.length === 0) continue;
    
    // Apply numbering pattern
    const seatNumbers = applyNumberingPattern(
      rowPositions.length,
      startNumber,
      numberingPattern,
      rowIndex % 2 === 0
    );
    
    // Create seats
    for (let i = 0; i < rowPositions.length && totalSeats < capacity; i++) {
      const pos = rowPositions[i];
      const seatNum = seatNumbers[i];
      const label = sectionPrefix 
        ? `${sectionPrefix}-${rowLabel}${seatNum}` 
        : `${rowLabel}${seatNum}`;
      
      let seatRotation: number | undefined;
      if (rotatesToFocalPoint && focalPoint) {
        seatRotation = getAngleToFocalPoint(pos, focalPoint);
      }
      
      seats.push({
        id: `seat-${Date.now()}-${totalSeats}`,
        x: pos.x,
        y: pos.y,
        row: rowLabel,
        number: seatNum,
        label,
        rotation: seatRotation,
      });
      
      totalSeats++;
    }
    
    rowIndex++;
  }
  
  return seats;
}

/**
 * Generate seats following a curved pattern (for stadium sections)
 */
function generateCurvedSeats(
  polygon: Point2D[],
  options: SeatGenerationOptions
): GeneratedSeat[] {
  const {
    capacity,
    seatSize = 28,
    spacing = 8,
    startRow = "A",
    startNumber = 1,
    sectionPrefix,
    numberingPattern = "left-to-right",
    rowCurvature = 0.5,
    focalPoint,
    rotatesToFocalPoint = true,
    seatsPerRow = 0,
    skipRows = [],
    edgeMargin = 15,
    rowSpacingMultiplier = 1,
  } = options;

  // For curved sections, we use the focal point as the curve center
  // If no focal point, use a point below the polygon (typical for theater)
  const bounds = getPolygonBounds(polygon);
  const centroid = getPolygonCentroid(polygon);
  
  const curveCenter = focalPoint ?? {
    x: centroid.x,
    y: bounds.maxY + bounds.height * 2, // Point "behind" the section
  };
  
  const seats: GeneratedSeat[] = [];
  const cellSize = seatSize + spacing;
  const rowHeight = cellSize * rowSpacingMultiplier;
  
  // Calculate min and max radius from curve center
  let minRadius = Infinity;
  let maxRadius = 0;
  
  for (const p of polygon) {
    const dist = Math.hypot(p.x - curveCenter.x, p.y - curveCenter.y);
    minRadius = Math.min(minRadius, dist);
    maxRadius = Math.max(maxRadius, dist);
  }
  
  // Offset from edges
  minRadius += edgeMargin;
  maxRadius -= edgeMargin;
  
  const numRows = Math.floor((maxRadius - minRadius) / rowHeight);
  let rowIndex = 0;
  let totalSeats = 0;
  
  for (let r = 0; r < numRows && totalSeats < capacity; r++) {
    // Get row label, skipping specified rows
    let rowLabel = getRowLabel(rowIndex, startRow);
    while (skipRows.includes(rowLabel)) {
      rowIndex++;
      rowLabel = getRowLabel(rowIndex, startRow);
    }
    
    // Current row radius (from outer to inner, as typical in theaters)
    const radius = maxRadius - (r * rowHeight);
    
    // Calculate arc length at this radius and determine seats
    const circumference = 2 * Math.PI * radius;
    
    // Find the angular extent of the polygon at this radius
    let minAngle = Infinity;
    let maxAngle = -Infinity;
    
    // Sample points on this radius and check if they're in polygon
    for (let angle = -Math.PI; angle <= Math.PI; angle += 0.01) {
      const testPoint = {
        x: curveCenter.x + radius * Math.cos(angle),
        y: curveCenter.y + radius * Math.sin(angle),
      };
      
      if (isPointInPolygon(testPoint, polygon)) {
        minAngle = Math.min(minAngle, angle);
        maxAngle = Math.max(maxAngle, angle);
      }
    }
    
    if (minAngle === Infinity) continue; // No valid points at this radius
    
    // Calculate number of seats that fit on this arc
    const arcLength = radius * (maxAngle - minAngle);
    let seatsInRow = Math.floor(arcLength / cellSize);
    
    if (seatsPerRow > 0 && seatsPerRow < seatsInRow) {
      seatsInRow = seatsPerRow;
    }
    
    if (seatsInRow === 0) continue;
    
    // Distribute seats evenly along the arc
    const angleStep = (maxAngle - minAngle) / seatsInRow;
    const startAngle = minAngle + angleStep / 2;
    
    // Apply numbering pattern
    const seatNumbers = applyNumberingPattern(
      seatsInRow,
      startNumber,
      numberingPattern,
      rowIndex % 2 === 0
    );
    
    const rowPositions: Point2D[] = [];
    
    for (let s = 0; s < seatsInRow; s++) {
      const angle = startAngle + s * angleStep;
      const pos = {
        x: curveCenter.x + radius * Math.cos(angle),
        y: curveCenter.y + radius * Math.sin(angle),
      };
      
      // Verify position is inside polygon
      if (isPointInPolygon(pos, polygon)) {
        rowPositions.push(pos);
      }
    }
    
    // Create seats
    for (let i = 0; i < rowPositions.length && totalSeats < capacity; i++) {
      const pos = rowPositions[i];
      const seatNum = seatNumbers[i];
      const label = sectionPrefix 
        ? `${sectionPrefix}-${rowLabel}${seatNum}` 
        : `${rowLabel}${seatNum}`;
      
      let seatRotation: number | undefined;
      if (rotatesToFocalPoint) {
        seatRotation = getAngleToFocalPoint(pos, curveCenter);
      }
      
      seats.push({
        id: `seat-${Date.now()}-${totalSeats}`,
        x: pos.x,
        y: pos.y,
        row: rowLabel,
        number: seatNum,
        label,
        rotation: seatRotation,
      });
      
      totalSeats++;
    }
    
    rowIndex++;
  }
  
  return seats;
}

/**
 * Generate seats in a radial pattern (around a center point)
 */
function generateRadialSeats(
  polygon: Point2D[],
  options: SeatGenerationOptions
): GeneratedSeat[] {
  const {
    capacity,
    seatSize = 28,
    spacing = 8,
    startRow = "A",
    startNumber = 1,
    sectionPrefix,
    focalPoint,
    rotatesToFocalPoint = true,
    edgeMargin = 10,
    rowSpacingMultiplier = 1,
  } = options;

  const centroid = focalPoint ?? getPolygonCentroid(polygon);
  const bounds = getPolygonBounds(polygon);
  const cellSize = seatSize + spacing;
  const rowHeight = cellSize * rowSpacingMultiplier;
  
  // Find max radius that fits in polygon
  let maxRadius = Math.min(bounds.width, bounds.height) / 2 - edgeMargin;
  const minRadius = cellSize;
  
  const seats: GeneratedSeat[] = [];
  let rowIndex = 0;
  let totalSeats = 0;
  
  // Generate concentric rings from center outward
  for (let radius = minRadius; radius <= maxRadius && totalSeats < capacity; radius += rowHeight) {
    const rowLabel = getRowLabel(rowIndex, startRow);
    const circumference = 2 * Math.PI * radius;
    const seatsInRing = Math.floor(circumference / cellSize);
    
    if (seatsInRing === 0) continue;
    
    const angleStep = (2 * Math.PI) / seatsInRing;
    
    for (let s = 0; s < seatsInRing && totalSeats < capacity; s++) {
      const angle = s * angleStep;
      const pos = {
        x: centroid.x + radius * Math.cos(angle),
        y: centroid.y + radius * Math.sin(angle),
      };
      
      // Check if inside polygon
      if (!isPointInPolygon(pos, polygon)) continue;
      
      const seatNum = startNumber + s;
      const label = sectionPrefix 
        ? `${sectionPrefix}-${rowLabel}${seatNum}` 
        : `${rowLabel}${seatNum}`;
      
      let seatRotation: number | undefined;
      if (rotatesToFocalPoint) {
        // Point outward from center
        seatRotation = (angle * 180 / Math.PI) + 90;
      }
      
      seats.push({
        id: `seat-${Date.now()}-${totalSeats}`,
        x: pos.x,
        y: pos.y,
        row: rowLabel,
        number: seatNum,
        label,
        rotation: seatRotation,
      });
      
      totalSeats++;
    }
    
    rowIndex++;
  }
  
  return seats;
}

// ============================================================
// PUBLIC API
// ============================================================

/**
 * Main function to generate seats inside a polygon
 */
export function generateSeatsInPolygon(
  polygon: Point2D[],
  options: SeatGenerationOptions
): GeneratedSeat[] {
  if (polygon.length < 3) {
    console.warn("Polygon must have at least 3 points");
    return [];
  }
  
  if (options.capacity <= 0) {
    return [];
  }
  
  const pattern = options.pattern ?? "staggered";
  
  switch (pattern) {
    case "curved":
      return generateCurvedSeats(polygon, options);
    case "radial":
      return generateRadialSeats(polygon, options);
    case "grid":
      return generateGridSeats(polygon, options);
    case "staggered":
    default:
      return generateStaggeredSeats(polygon, options);
  }
}

/**
 * Calculate maximum capacity that can fit in a polygon
 */
export function calculateMaxCapacity(
  polygon: Point2D[],
  seatSize: number = 28,
  spacing: number = 8,
  pattern: LayoutPattern = "staggered"
): number {
  const bounds = getPolygonBounds(polygon);
  const cellSize = seatSize + spacing;
  const rowHeight = pattern === "staggered" ? cellSize * 0.866 : cellSize;
  
  let count = 0;
  const rows = Math.ceil(bounds.height / rowHeight) + 1;
  const cols = Math.ceil(bounds.width / cellSize) + 1;
  
  for (let row = 0; row < rows; row++) {
    const offset = (pattern === "staggered" && row % 2 === 1) ? cellSize / 2 : 0;
    const y = bounds.minY + row * rowHeight + cellSize / 2;
    
    for (let col = 0; col < cols; col++) {
      const x = bounds.minX + col * cellSize + offset + cellSize / 2;
      
      if (isPointInPolygon({ x, y }, polygon)) {
        const halfSize = seatSize / 2 - 2;
        const corners = [
          { x: x - halfSize, y: y - halfSize },
          { x: x + halfSize, y: y - halfSize },
          { x: x - halfSize, y: y + halfSize },
          { x: x + halfSize, y: y + halfSize },
        ];
        
        if (corners.every(c => isPointInPolygon(c, polygon))) {
          count++;
        }
      }
    }
  }
  
  return count;
}

/**
 * Get a description of available patterns for UI
 */
export function getPatternDescriptions(): { value: LayoutPattern; label: string; description: string }[] {
  return [
    { 
      value: "staggered", 
      label: "Escalonado", 
      description: "Patrón hexagonal con filas alternadas (mejor visibilidad)" 
    },
    { 
      value: "grid", 
      label: "Cuadrícula", 
      description: "Filas y columnas alineadas" 
    },
    { 
      value: "curved", 
      label: "Curvado", 
      description: "Filas curvas siguiendo un punto focal (ideal para teatros)" 
    },
    { 
      value: "radial", 
      label: "Radial", 
      description: "Anillos concéntricos desde el centro" 
    },
  ];
}

/**
 * Get a description of numbering patterns for UI
 */
export function getNumberingPatternDescriptions(): { value: NumberingPattern; label: string; description: string }[] {
  return [
    { 
      value: "left-to-right", 
      label: "Izquierda a derecha", 
      description: "1, 2, 3, 4, 5... (estándar)" 
    },
    { 
      value: "right-to-left", 
      label: "Derecha a izquierda", 
      description: "...5, 4, 3, 2, 1" 
    },
    { 
      value: "serpentine", 
      label: "Serpentina", 
      description: "Fila 1: 1→5, Fila 2: 5→1, Fila 3: 1→5..." 
    },
    { 
      value: "center-out", 
      label: "Centro hacia afuera", 
      description: "Empieza en el centro: ...3, 1, 2, 4..." 
    },
    { 
      value: "center-out-paired", 
      label: "Centro pareado", 
      description: "Pares desde el centro hacia afuera" 
    },
  ];
}
