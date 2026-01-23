import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Users, Ticket, MapPin, Info } from "lucide-react";

interface Point {
  x: number;
  y: number;
}

interface Section {
  id: string;
  name: string;
  description?: string;
  color: string;
  polygonPoints: Point[];
  labelPosition?: Point;
  hoverColor: string;
  selectedColor: string;
  thumbnailUrl?: string;
  zone?: {
    id: string;
    name: string;
    color: string;
  } | null;
  pricing: {
    price: number;
    fee: number;
    total: number;
  };
  stats: {
    total: number;
    available: number;
    sold: number;
    reserved: number;
  };
  childLayoutId?: string | null;
}

interface SectionMapViewerProps {
  sections: Section[];
  canvas: { width: number; height: number };
  onSectionClick: (section: Section) => void;
  selectedSection: Section | null;
  className?: string;
}

// Helper to get center of polygon
function getPolygonCenter(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  const sum = points.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 }
  );
  return { x: sum.x / points.length, y: sum.y / points.length };
}

// Helper to get bounding box of polygon
function getPolygonBounds(points: Point[]) {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  }
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

// Convert points to SVG path
function pointsToPath(points: Point[]): string {
  if (points.length === 0) return "";
  const start = points[0];
  const rest = points.slice(1);
  return `M ${start.x} ${start.y} ${rest.map((p) => `L ${p.x} ${p.y}`).join(" ")} Z`;
}

// Format currency
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
  }).format(value);
}

// Get availability color gradient
function getAvailabilityColor(stats: Section["stats"]): string {
  if (stats.total === 0) return "#6B7280"; // gray
  const availablePercent = (stats.available / stats.total) * 100;
  
  if (availablePercent === 0) return "#EF4444"; // red - sold out
  if (availablePercent < 20) return "#F59E0B"; // amber - almost sold
  if (availablePercent < 50) return "#F97316"; // orange - selling fast
  return "#22C55E"; // green - good availability
}

export function SectionMapViewer({
  sections,
  canvas,
  onSectionClick,
  selectedSection,
  className,
}: SectionMapViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Calculate scale to fit container
  useEffect(() => {
    if (!containerRef.current) return;

    const updateScale = () => {
      const container = containerRef.current!;
      const containerWidth = container.clientWidth - 40;
      const containerHeight = container.clientHeight - 40;

      // Calculate bounding box of all sections
      let allPoints: Point[] = [];
      sections.forEach((s) => {
        allPoints = allPoints.concat(s.polygonPoints);
      });

      if (allPoints.length === 0) {
        setScale(1);
        setOffset({ x: 20, y: 20 });
        return;
      }

      const bounds = getPolygonBounds(allPoints);
      const contentWidth = bounds.maxX - bounds.minX + 100;
      const contentHeight = bounds.maxY - bounds.minY + 100;

      const scaleX = containerWidth / contentWidth;
      const scaleY = containerHeight / contentHeight;
      const newScale = Math.min(scaleX, scaleY, 1.5);

      // Center the content
      const scaledWidth = contentWidth * newScale;
      const scaledHeight = contentHeight * newScale;
      const offsetX = (containerWidth - scaledWidth) / 2 + 20 - bounds.minX * newScale + 50 * newScale;
      const offsetY = (containerHeight - scaledHeight) / 2 + 20 - bounds.minY * newScale + 50 * newScale;

      setScale(newScale);
      setOffset({ x: offsetX, y: offsetY });
    };

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [sections, canvas]);

  // Section tooltip content
  const tooltipContent = useMemo(() => {
    const section = sections.find((s) => s.id === hoveredSection);
    if (!section) return null;

    const availabilityColor = getAvailabilityColor(section.stats);
    const availablePercent = section.stats.total > 0 
      ? Math.round((section.stats.available / section.stats.total) * 100) 
      : 0;

    return {
      section,
      availabilityColor,
      availablePercent,
    };
  }, [hoveredSection, sections]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full h-full min-h-[350px] sm:min-h-[400px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl overflow-hidden",
        className
      )}
    >
      {/* SVG Map */}
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${containerRef.current?.clientWidth || canvas.width} ${containerRef.current?.clientHeight || canvas.height}`}
        className="absolute inset-0"
      >
        <defs>
          {/* Gradient definitions for sections */}
          {sections.map((section) => (
            <linearGradient
              key={`gradient-${section.id}`}
              id={`section-gradient-${section.id}`}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor={section.color} stopOpacity="0.9" />
              <stop offset="100%" stopColor={section.color} stopOpacity="0.6" />
            </linearGradient>
          ))}

          {/* Glow filter */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Drop shadow */}
          <filter id="drop-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.3" />
          </filter>
        </defs>

        {/* Grid background */}
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path
            d="M 40 0 L 0 0 0 40"
            fill="none"
            stroke="rgba(255,255,255,0.03)"
            strokeWidth="1"
          />
        </pattern>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* Transform group */}
        <g transform={`translate(${offset.x}, ${offset.y}) scale(${scale})`}>
          {/* Render sections */}
          {sections.map((section) => {
            const isHovered = hoveredSection === section.id;
            const isSelected = selectedSection?.id === section.id;
            const isUnavailable = section.stats.available === 0;
            const center = section.labelPosition || getPolygonCenter(section.polygonPoints);

            return (
              <g
                key={section.id}
                className={cn(
                  "cursor-pointer transition-all duration-300",
                  isUnavailable && "opacity-50 cursor-not-allowed"
                )}
                onClick={() => !isUnavailable && onSectionClick(section)}
                onMouseEnter={() => setHoveredSection(section.id)}
                onMouseLeave={() => setHoveredSection(null)}
              >
                {/* Section polygon */}
                <path
                  d={pointsToPath(section.polygonPoints)}
                  fill={
                    isSelected
                      ? section.selectedColor
                      : isHovered
                      ? section.hoverColor
                      : `url(#section-gradient-${section.id})`
                  }
                  stroke={isSelected || isHovered ? "#fff" : section.color}
                  strokeWidth={isSelected ? 3 : isHovered ? 2 : 1}
                  filter={isHovered || isSelected ? "url(#glow)" : "url(#drop-shadow)"}
                  className="transition-all duration-200"
                  style={{
                    transform: isHovered ? "scale(1.02)" : "scale(1)",
                    transformOrigin: `${getPolygonCenter(section.polygonPoints).x}px ${getPolygonCenter(section.polygonPoints).y}px`,
                  }}
                />

                {/* Section label */}
                <text
                  x={center.x}
                  y={center.y - 10}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-white font-semibold text-sm pointer-events-none select-none"
                  style={{ textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}
                >
                  {section.name}
                </text>

                {/* Price label */}
                <text
                  x={center.x}
                  y={center.y + 10}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-white/80 font-medium text-xs pointer-events-none select-none"
                  style={{ textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}
                >
                  {formatCurrency(section.pricing.total)}
                </text>

                {/* Availability indicator */}
                <g transform={`translate(${center.x}, ${center.y + 28})`}>
                  <rect
                    x="-25"
                    y="-8"
                    width="50"
                    height="16"
                    rx="8"
                    fill={getAvailabilityColor(section.stats)}
                    fillOpacity="0.9"
                  />
                  <text
                    x="0"
                    y="0"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-white font-bold text-xs pointer-events-none select-none"
                  >
                    {section.stats.available}
                  </text>
                </g>

                {/* Sold out badge */}
                {isUnavailable && (
                  <g transform={`translate(${center.x}, ${center.y})`}>
                    <rect
                      x="-35"
                      y="-12"
                      width="70"
                      height="24"
                      rx="4"
                      fill="#DC2626"
                    />
                    <text
                      x="0"
                      y="0"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="fill-white font-bold text-xs pointer-events-none select-none"
                    >
                      AGOTADO
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Tooltip - Mobile optimized */}
      {tooltipContent && hoveredSection && (
        <div
          className="absolute bottom-12 sm:bottom-4 left-2 right-2 sm:left-auto sm:right-4 sm:w-72 bg-white/95 backdrop-blur-lg rounded-xl shadow-2xl border border-white/20 p-3 sm:p-4 z-20 transition-all duration-200 animate-in fade-in slide-in-from-bottom-2"
        >
            <div className="flex items-start gap-3">
              <div
                className="w-4 h-4 rounded-full flex-shrink-0 mt-1"
                style={{ backgroundColor: tooltipContent.section.color }}
              />
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-slate-900 truncate">
                  {tooltipContent.section.name}
                </h4>
                {tooltipContent.section.zone && (
                  <p className="text-sm text-slate-500">
                    {tooltipContent.section.zone.name}
                  </p>
                )}
              </div>
            </div>

            <Separator className="my-3" />

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Ticket className="w-4 h-4 text-slate-400" />
                <span className="text-slate-600">
                  <span className="font-semibold text-slate-900">
                    {tooltipContent.section.stats.available}
                  </span>{" "}
                  disponibles
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-400" />
                <span className="text-slate-600">
                  {tooltipContent.section.stats.total} asientos
                </span>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-slate-900">
                  {formatCurrency(tooltipContent.section.pricing.total)}
                </span>
                <span className="text-sm text-slate-500">c/u</span>
              </div>
              <Badge
                variant="outline"
                style={{
                  backgroundColor: `${tooltipContent.availabilityColor}20`,
                  borderColor: tooltipContent.availabilityColor,
                  color: tooltipContent.availabilityColor,
                }}
              >
                {tooltipContent.availablePercent}% disponible
              </Badge>
            </div>

            {tooltipContent.section.description && (
              <p className="mt-2 text-sm text-slate-500">
                {tooltipContent.section.description}
              </p>
            )}

            <div className="mt-3 text-center">
              <span className="text-xs text-slate-400">
                Clic para ver asientos
              </span>
            </div>
          </div>
        )}

      {/* Legend - Mobile optimized */}
      <div className="absolute top-2 sm:top-4 right-2 sm:right-4 bg-black/40 backdrop-blur-sm rounded-lg p-2 sm:p-3 space-y-1.5 sm:space-y-2">
        <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-white/80">
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-green-500" />
          <span className="hidden sm:inline">Buena disponibilidad</span>
          <span className="sm:hidden">Disponible</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-white/80">
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-orange-500" />
          <span className="hidden sm:inline">Últimos lugares</span>
          <span className="sm:hidden">Pocos</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-white/80">
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-500" />
          <span>Agotado</span>
        </div>
      </div>

      {/* Info hint - Mobile optimized */}
      <div className="absolute bottom-2 sm:bottom-4 left-2 sm:left-4 right-2 sm:right-auto flex items-center justify-center sm:justify-start gap-2 text-white/60 text-xs sm:text-sm">
        <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
        <span className="text-center sm:text-left">Toca una sección para ver asientos</span>
      </div>
    </div>
  );
}

// Separate component for the Zoom transition
export function SectionZoomTransition({
  section,
  onBack,
  children,
}: {
  section: Section | null;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="h-full w-full relative">
      {section ? (
        <div
          key={`section-${section.id}`}
          className="h-full w-full relative animate-in fade-in zoom-in-95 duration-300"
        >
          {/* Back button - Liquid Glass Style - Mobile optimized */}
          <div
            className="absolute top-2 sm:top-4 left-2 sm:left-4 z-30 animate-in slide-in-from-left-4 duration-300"
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="gap-1.5 sm:gap-2 text-white/90 hover:text-white hover:bg-white/10 border border-white/20 shadow-lg text-xs sm:text-sm px-2 sm:px-3"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.1)',
              }}
            >
              <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Volver al mapa</span>
              <span className="sm:hidden">Volver</span>
            </Button>
          </div>

          {/* Section info header - Liquid Glass Style - Mobile optimized */}
          <div
            className="absolute top-2 sm:top-4 left-1/2 -translate-x-1/2 z-30 animate-in slide-in-from-top-4 duration-300 max-w-[70%] sm:max-w-none"
          >
            <div 
              className="flex items-center gap-2 sm:gap-3 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 border border-white/20"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.1)',
              }}
            >
              <div
                className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full shadow-sm flex-shrink-0"
                style={{ backgroundColor: section.color, boxShadow: `0 0 8px ${section.color}` }}
              />
              <span className="font-semibold text-white text-xs sm:text-sm truncate">{section.name}</span>
              <Separator orientation="vertical" className="h-3 sm:h-4 bg-white/20 hidden sm:block" />
              <span className="text-white/70 text-xs sm:text-sm whitespace-nowrap hidden sm:inline">
                {section.stats.available} disponibles
              </span>
            </div>
          </div>

          {/* Content (SeatMapViewer) */}
          {children}
        </div>
      ) : (
        <div
          key="overview"
          className="h-full w-full animate-in fade-in zoom-in-105 duration-300"
        >
          {children}
        </div>
      )}
    </div>
  );
}
