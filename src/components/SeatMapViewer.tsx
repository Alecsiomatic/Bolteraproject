import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { ZoomIn, ZoomOut, RotateCcw, Move, Hand } from "lucide-react";

type Seat = {
  id: string;
  label: string;
  zoneName?: string | null;
  zoneColor?: string | null;
  available: boolean;
  status: string;
  price: number;
  fee?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  rowLabel?: string;
  columnNumber?: number;
};

type SeatMapViewerProps = {
  seats: Seat[];
  selectedSeats: Seat[];
  onSeatClick: (seat: Seat) => void;
  canvasWidth?: number;
  canvasHeight?: number;
};

// Tamaño base de asientos
const BASE_SEAT_SIZE = 32;
const MIN_SEAT_SIZE = 18;
const MAX_SEAT_SIZE = 50;
const SEAT_SPACING_RATIO = 0.65;

// Zoom limits
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

export function SeatMapViewer({
  seats,
  selectedSeats,
  onSeatClick,
}: SeatMapViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 350, height: 350 });
  const [zoom, setZoom] = useState(1);
  const [isPinching, setIsPinching] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [showMobileHint, setShowMobileHint] = useState(true);
  const lastPinchDistance = useRef(0);
  const initialPinchZoom = useRef(1);

  // Observe container size changes
  useEffect(() => {
    if (!containerRef.current) return;
    
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setContainerSize({ width: rect.width, height: rect.height });
        }
      }
    };
    
    // Initial size
    updateSize();
    
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(containerRef.current);
    
    // Also listen to window resize for mobile orientation changes
    window.addEventListener('resize', updateSize);
    
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  // Zoom functions
  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(MAX_ZOOM, prev + ZOOM_STEP));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(MIN_ZOOM, prev - ZOOM_STEP));
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoom(1);
    if (containerRef.current) {
      const container = containerRef.current;
      setTimeout(() => {
        container.scrollLeft = (container.scrollWidth - container.clientWidth) / 2;
        container.scrollTop = (container.scrollHeight - container.clientHeight) / 2;
      }, 50);
    }
  }, []);

  // Touch pinch-to-zoom for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      setIsPinching(true);
      setShowMobileHint(false);
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDistance.current = Math.sqrt(dx * dx + dy * dy);
      initialPinchZoom.current = zoom;
    }
  }, [zoom]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && isPinching) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      const scale = distance / lastPinchDistance.current;
      const newZoom = initialPinchZoom.current * scale;
      setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newZoom)));
    }
  }, [isPinching]);

  const handleTouchEnd = useCallback(() => {
    setIsPinching(false);
  }, []);

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      setZoom(prev => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta)));
    }
  }, []);

  const selectedSeatIds = useMemo(
    () => new Set(selectedSeats.map(s => s.id)),
    [selectedSeats]
  );

  // Calculate layout that fits all seats centered in the visible container
  const layout = useMemo(() => {
    if (seats.length === 0) {
      return { 
        seats: [], 
        scale: 1,
        seatSize: BASE_SEAT_SIZE,
        offsetX: 0,
        offsetY: 0,
        contentWidth: containerSize.width,
        contentHeight: containerSize.height,
      };
    }
    
    // Find bounds of all seats
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    for (const seat of seats) {
      const x = seat.x ?? 0;
      const y = seat.y ?? 0;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    
    // Handle edge case where all seats have same position
    if (minX === maxX) { minX -= 50; maxX += 50; }
    if (minY === maxY) { minY -= 50; maxY += 50; }
    
    const seatsWidth = maxX - minX;
    const seatsHeight = maxY - minY;
    
    // Calculate minimum distance between any two seats (sampling for performance)
    let minDistBetweenSeats = Infinity;
    const sampleSize = Math.min(seats.length, 50);
    for (let i = 0; i < sampleSize; i++) {
      for (let j = i + 1; j < sampleSize; j++) {
        const dx = (seats[i].x ?? 0) - (seats[j].x ?? 0);
        const dy = (seats[i].y ?? 0) - (seats[j].y ?? 0);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0 && dist < minDistBetweenSeats) {
          minDistBetweenSeats = dist;
        }
      }
    }
    if (minDistBetweenSeats === Infinity || minDistBetweenSeats === 0) minDistBetweenSeats = 30;
    
    // Calculate scale to fit seats with good spacing
    const targetSeatSize = BASE_SEAT_SIZE;
    const scale = targetSeatSize / (minDistBetweenSeats * SEAT_SPACING_RATIO);
    
    // Final seat size
    const finalSeatSize = Math.min(MAX_SEAT_SIZE, Math.max(MIN_SEAT_SIZE, minDistBetweenSeats * scale * SEAT_SPACING_RATIO));
    
    // Add padding
    const padding = finalSeatSize * 2;
    
    // Calculate content dimensions
    const contentWidth = (seatsWidth * scale) + padding * 2;
    const contentHeight = (seatsHeight * scale) + padding * 2;
    
    // Center offset
    const offsetX = padding - (minX * scale);
    const offsetY = padding - (minY * scale);
    
    // Map seats to render positions
    const mappedSeats = seats.map(seat => {
      const x = seat.x ?? 0;
      const y = seat.y ?? 0;
      
      return {
        ...seat,
        renderX: (x * scale) + offsetX,
        renderY: (y * scale) + offsetY,
      };
    });
    
    return {
      seats: mappedSeats,
      scale,
      seatSize: finalSeatSize,
      offsetX,
      offsetY,
      contentWidth,
      contentHeight,
    };
  }, [seats, containerSize]);

  const getSeatColor = (seat: Seat) => {
    if (!seat.available) return '#475569';
    if (selectedSeatIds.has(seat.id)) return '#06b6d4';
    if (seat.zoneColor) return seat.zoneColor;
    return '#22c55e';
  };

  const seatSize = layout.seatSize * zoom;

  // Calculate the actual content bounds for proper scrolling and centering
  const contentBounds = useMemo(() => {
    const scaledWidth = layout.contentWidth * zoom;
    const scaledHeight = layout.contentHeight * zoom;
    
    // If content is smaller than container, use container size to center content
    const width = Math.max(scaledWidth, containerSize.width);
    const height = Math.max(scaledHeight, containerSize.height);
    
    // Calculate offset to center the content when it's smaller than container
    const centerOffsetX = scaledWidth < containerSize.width ? (containerSize.width - scaledWidth) / 2 : 0;
    const centerOffsetY = scaledHeight < containerSize.height ? (containerSize.height - scaledHeight) / 2 : 0;
    
    return { width, height, centerOffsetX, centerOffsetY };
  }, [layout.contentWidth, layout.contentHeight, containerSize, zoom]);

  // Initialize zoom and center on load
  useEffect(() => {
    if (containerRef.current && layout.seats.length > 0 && !hasInitialized) {
      setHasInitialized(true);
      
      // Calculate optimal zoom to fit content with padding
      const isMobile = containerSize.width < 640;
      const fitPadding = isMobile ? 0.85 : 0.95; // More padding on mobile
      const fitZoomX = (containerSize.width * fitPadding) / layout.contentWidth;
      const fitZoomY = (containerSize.height * fitPadding) / layout.contentHeight;
      const fitZoom = Math.min(fitZoomX, fitZoomY);
      const optimalZoom = Math.max(MIN_ZOOM, Math.min(fitZoom, isMobile ? 1.0 : 1.2));
      
      setZoom(optimalZoom);
      
      // Center after a small delay (mostly for larger content that needs scrolling)
      setTimeout(() => {
        if (containerRef.current) {
          const container = containerRef.current;
          const scrollLeft = Math.max(0, (container.scrollWidth - container.clientWidth) / 2);
          const scrollTop = Math.max(0, (container.scrollHeight - container.clientHeight) / 2);
          container.scrollLeft = scrollLeft;
          container.scrollTop = scrollTop;
        }
      }, 100);
    }
  }, [layout.seats.length, hasInitialized, layout.contentWidth, layout.contentHeight, containerSize]);

  return (
    <div className="relative w-full h-full" style={{ minHeight: '300px' }}>
      {/* Zoom Controls */}
      <div className="absolute top-2 right-2 z-30 flex flex-col gap-1.5">
        <div className="flex flex-col rounded-xl overflow-hidden"
          style={{
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.15)',
          }}
        >
          <button
            onClick={handleZoomIn}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 transition-all active:scale-95"
            title="Acercar"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="h-px bg-white/10" />
          <button
            onClick={handleZoomOut}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 transition-all active:scale-95"
            title="Alejar"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <div className="h-px bg-white/10" />
          <button
            onClick={handleResetZoom}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 transition-all active:scale-95"
            title="Restablecer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
        
        {/* Zoom level indicator */}
        <div 
          className="text-center text-[10px] text-white/60 py-0.5 px-1.5 rounded"
          style={{ background: 'rgba(0,0,0,0.5)' }}
        >
          {Math.round(zoom * 100)}%
        </div>
      </div>

      {/* Mobile hint */}
      {showMobileHint && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 sm:hidden">
          <div 
            className="flex items-center gap-2 px-3 py-2 rounded-full text-white text-xs font-medium animate-pulse"
            style={{
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.9) 0%, rgba(147, 51, 234, 0.9) 100%)',
            }}
            onClick={() => setShowMobileHint(false)}
          >
            <Hand className="w-3.5 h-3.5" />
            <span>Pellizca para zoom • Arrastra para mover</span>
          </div>
        </div>
      )}
      
      {/* Desktop hint */}
      <div className="absolute bottom-2 left-2 z-30 items-center gap-1 text-[10px] text-white/40 hidden sm:flex"
        style={{
          background: 'rgba(0,0,0,0.4)',
          padding: '4px 8px',
          borderRadius: '6px',
        }}
      >
        <Move className="w-3 h-3" />
        <span>Ctrl + scroll = zoom</span>
      </div>

      {/* Main Scrollable Container */}
      <div 
        ref={containerRef} 
        className="w-full h-full bg-slate-900/60 rounded-xl border border-white/10 overflow-auto"
        style={{
          minHeight: '300px',
          touchAction: isPinching ? 'none' : 'pan-x pan-y',
          WebkitOverflowScrolling: 'touch',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
      >
        {/* Content wrapper */}
        <div 
          ref={contentRef}
          style={{ 
            width: `${contentBounds.width}px`, 
            height: `${contentBounds.height}px`,
            position: 'relative',
          }}
        >
          {seats.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">
              No hay asientos disponibles
            </div>
          ) : (
            /* Seats */
            layout.seats.map((seat) => {
              const size = seatSize;
              // Apply center offset for proper centering on mobile
              const x = (seat.renderX * zoom) + contentBounds.centerOffsetX - size / 2;
              const y = (seat.renderY * zoom) + contentBounds.centerOffsetY - size / 2;
              const isSelected = selectedSeatIds.has(seat.id);
              
              return (
                <button
                  key={seat.id}
                  onClick={() => seat.available && onSeatClick(seat)}
                  disabled={!seat.available}
                  style={{
                    position: 'absolute',
                    left: `${x}px`,
                    top: `${y}px`,
                    width: `${size}px`,
                    height: `${size}px`,
                    backgroundColor: getSeatColor(seat),
                    border: isSelected 
                      ? '3px solid #67e8f9' 
                      : '2px solid rgba(255,255,255,0.3)',
                    borderRadius: '50%',
                    cursor: seat.available ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: `${Math.max(8, size * 0.3)}px`,
                    fontWeight: '700',
                    color: '#fff',
                    opacity: seat.available ? 1 : 0.4,
                    boxShadow: isSelected
                      ? '0 0 0 3px rgba(103, 232, 249, 0.4), 0 4px 12px rgba(6, 182, 212, 0.5)'
                      : seat.available
                      ? '0 2px 6px rgba(0,0,0,0.4)'
                      : 'none',
                    textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                    zIndex: isSelected ? 10 : 1,
                    transition: 'transform 0.1s, box-shadow 0.1s',
                  }}
                  className="hover:scale-110 hover:z-20 active:scale-95"
                  title={`${seat.label}${seat.zoneName ? ` - ${seat.zoneName}` : ''} - $${(seat.price + (seat.fee || 0)).toLocaleString()}`}
                >
                  {size > 20 ? (seat.label.length > 4 ? seat.label.slice(-3) : seat.label) : ''}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
