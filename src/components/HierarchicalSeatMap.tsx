import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SeatMapViewer } from "./SeatMapViewer";
import { SectionMapViewer, SectionZoomTransition } from "./SectionMapViewer";
import { Loader2 } from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

// Use a generic seat type that works with both local and API types
interface BaseSeat {
  id: string;
  zoneId: string | null;
  label: string;
  rowLabel: string | null;
  columnNumber: number | null;
  available: boolean;
  status: string;
  price: number;
  [key: string]: any; // Allow additional properties like x, y, etc
}

interface Section {
  id: string;
  name: string;
  description?: string;
  color: string;
  polygonPoints: Array<{ x: number; y: number }>;
  labelPosition?: { x: number; y: number };
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

interface HierarchicalSeatMapProps<T extends BaseSeat = BaseSeat> {
  eventId: string;
  sessionId: string;
  selectedSeats: T[];
  onSeatClick?: (seat: T) => void;
  onSeatSelect?: (seat: T) => void; // Alias for onSeatClick
  className?: string;
}

/**
 * HierarchicalSeatMap - Smart component that handles both flat and hierarchical layouts
 * 
 * For flat layouts: Shows seats directly
 * For hierarchical layouts: Shows sections first, then zooms into seats
 */
export function HierarchicalSeatMap<T extends BaseSeat = BaseSeat>({
  eventId,
  sessionId,
  selectedSeats,
  onSeatClick,
  onSeatSelect,
  className,
}: HierarchicalSeatMapProps<T>) {
  // Use either onSeatClick or onSeatSelect (for backward compatibility)
  const handleSeatClick = (onSeatClick || onSeatSelect || (() => {})) as (seat: any) => void;
  // Track which section is currently selected (for hierarchical view)
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);

  // First, fetch the sections/layout type to determine which view to show
  const { data: sectionsData, isLoading: sectionsLoading } = useQuery({
    queryKey: ["event-sections", eventId, sessionId],
    queryFn: async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/events/${eventId}/sessions/${sessionId}/sections`
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "Error loading sections");
      }
      return response.json();
    },
    enabled: !!eventId && !!sessionId,
    staleTime: 10000,
  });

  // If hierarchical and a section is selected, fetch the section detail with seats
  const { data: sectionDetail, isLoading: sectionLoading } = useQuery({
    queryKey: ["section-detail", eventId, sessionId, selectedSection?.id],
    queryFn: async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/events/${eventId}/sessions/${sessionId}/sections/${selectedSection!.id}`
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "Error loading section");
      }
      return response.json();
    },
    enabled: !!selectedSection?.id,
    staleTime: 5000,
  });

  // For flat layouts, fetch the regular availability
  const { data: flatAvailability, isLoading: flatLoading } = useQuery({
    queryKey: ["flat-availability", eventId, sessionId],
    queryFn: async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/events/${eventId}/sessions/${sessionId}/availability`
      );
      if (!response.ok) {
        throw new Error("Error loading availability");
      }
      return response.json();
    },
    enabled: !!eventId && !!sessionId && sectionsData?.layoutType === "flat",
    staleTime: 10000,
  });

  // Determine if we should show hierarchical view (either "parent" or "sections" layoutType)
  const isHierarchical = (sectionsData?.layoutType === "parent" || sectionsData?.layoutType === "sections") && sectionsData?.sections?.length > 0;

  // Handle section click
  const handleSectionClick = useCallback((section: Section) => {
    if (section.stats.available === 0) return;
    setSelectedSection(section);
  }, []);

  // Handle back to overview
  const handleBack = useCallback(() => {
    setSelectedSection(null);
  }, []);

  // Loading state
  if (sectionsLoading) {
    return (
      <div className="flex items-center justify-center h-[350px] sm:h-[400px] bg-slate-900/50 rounded-xl">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  // Hierarchical layout with sections
  if (isHierarchical) {
    const sections = sectionsData.sections as Section[];
    const canvas = sectionsData.canvas || { width: 1200, height: 800 };

    return (
      <div className={`min-h-[350px] sm:min-h-[450px] h-[55vh] sm:h-[60vh] max-h-[600px] sm:max-h-[700px] ${className || ""}`}>
        <SectionZoomTransition section={selectedSection} onBack={handleBack}>
          {selectedSection ? (
            // Section detail view with seats
            <>
              {sectionLoading ? (
                <div className="flex items-center justify-center h-full bg-slate-900/50 rounded-xl">
                  <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
                </div>
              ) : sectionDetail?.seats ? (
                <div className="h-full pt-14 sm:pt-16">
                  <SeatMapViewer
                    seats={sectionDetail.seats}
                    selectedSeats={selectedSeats}
                    onSeatClick={handleSeatClick}
                    canvasWidth={sectionDetail.layout?.canvas?.width || 800}
                    canvasHeight={sectionDetail.layout?.canvas?.height || 600}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full bg-slate-900/50 rounded-xl">
                  <p className="text-slate-400">No hay asientos en esta sección</p>
                </div>
              )}
            </>
          ) : (
            // Overview with all sections
            <SectionMapViewer
              sections={sections}
              canvas={canvas}
              onSectionClick={handleSectionClick}
              selectedSection={selectedSection}
            />
          )}
        </SectionZoomTransition>
      </div>
    );
  }

  // Flat layout - show seats directly
  if (flatLoading) {
    return (
      <div className="flex items-center justify-center h-[350px] sm:h-[500px] bg-slate-900/50 rounded-xl">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  if (flatAvailability?.seats && flatAvailability.seats.length > 0) {
    return (
      <div className={`min-h-[350px] sm:min-h-[450px] h-[55vh] sm:h-[60vh] max-h-[600px] sm:max-h-[700px] ${className || ""}`}>
        <SeatMapViewer
          seats={flatAvailability.seats}
          selectedSeats={selectedSeats}
          onSeatClick={handleSeatClick}
          canvasWidth={flatAvailability.layout?.canvas?.width || 1200}
          canvasHeight={flatAvailability.layout?.canvas?.height || 800}
        />
      </div>
    );
  }

  // No seats available
  return (
    <div className="flex flex-col items-center justify-center h-[350px] sm:h-[500px] bg-slate-900/50 rounded-xl px-4 text-center">
      <p className="text-slate-400 text-base sm:text-lg">No hay asientos disponibles</p>
      <p className="text-slate-500 text-xs sm:text-sm mt-2">
        Este evento aún no tiene un mapa de asientos configurado
      </p>
    </div>
  );
}

export default HierarchicalSeatMap;
