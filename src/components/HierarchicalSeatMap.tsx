import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SeatMapViewer } from "./SeatMapViewer";
import { SectionMapViewer, SectionZoomTransition } from "./SectionMapViewer";
import { Loader2, Minus, Plus, Ticket, Users } from "lucide-react";
import { API_BASE_URL } from "@/lib/api-base";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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

type AdmissionType = "seated" | "general";

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
  admissionType?: AdmissionType;
}

// General admission ticket selection for hybrid events
interface GeneralAdmissionSelection {
  sectionId: string;
  sectionName: string;
  tierId: string;
  quantity: number;
  price: number;
  color: string;
}

interface HierarchicalSeatMapProps<T extends BaseSeat = BaseSeat> {
  eventId: string;
  sessionId: string;
  selectedSeats: T[];
  onSeatClick?: (seat: T) => void;
  onSeatSelect?: (seat: T) => void; // Alias for onSeatClick
  generalAdmissionSelections?: GeneralAdmissionSelection[];
  onGeneralAdmissionChange?: (selection: GeneralAdmissionSelection) => void;
  className?: string;
}

// Format currency
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
  }).format(value);
}

// General Admission Quantity Selector Component
function GeneralAdmissionSelector({
  section,
  currentQuantity,
  onQuantityChange,
}: {
  section: Section;
  currentQuantity: number;
  onQuantityChange: (quantity: number) => void;
}) {
  const maxQuantity = Math.min(section.stats.available, 10); // Max 10 per transaction
  
  const handleDecrease = () => {
    if (currentQuantity > 0) {
      onQuantityChange(currentQuantity - 1);
    }
  };

  const handleIncrease = () => {
    if (currentQuantity < maxQuantity) {
      onQuantityChange(currentQuantity + 1);
    }
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-4 sm:p-8 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl">
      {/* Section info */}
      <div className="text-center mb-6 sm:mb-8">
        <div 
          className="w-16 h-16 sm:w-20 sm:h-20 rounded-full mx-auto mb-4 flex items-center justify-center"
          style={{ backgroundColor: section.color }}
        >
          <Users className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
        </div>
        <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">{section.name}</h3>
        <Badge variant="secondary" className="bg-purple-600/20 text-purple-300 border-purple-500/30">
          Admisión General
        </Badge>
        {section.description && (
          <p className="text-slate-400 text-sm mt-2 max-w-md">{section.description}</p>
        )}
      </div>

      {/* Price */}
      <div className="text-center mb-6">
        <span className="text-3xl sm:text-4xl font-bold text-white">
          {formatCurrency(section.pricing.total)}
        </span>
        <span className="text-slate-400 text-sm ml-2">por persona</span>
      </div>

      {/* Availability */}
      <div className="flex items-center gap-2 text-slate-400 mb-6 sm:mb-8">
        <Ticket className="w-4 h-4" />
        <span>{section.stats.available} disponibles</span>
      </div>

      {/* Quantity selector */}
      <div className="flex items-center gap-4 sm:gap-6 mb-6">
        <Button
          variant="outline"
          size="lg"
          onClick={handleDecrease}
          disabled={currentQuantity === 0}
          className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-white/20 bg-white/5 hover:bg-white/10 text-white disabled:opacity-30"
        >
          <Minus className="w-5 h-5 sm:w-6 sm:h-6" />
        </Button>
        
        <div className="w-20 sm:w-24 text-center">
          <span className="text-4xl sm:text-5xl font-bold text-white">{currentQuantity}</span>
        </div>
        
        <Button
          variant="outline"
          size="lg"
          onClick={handleIncrease}
          disabled={currentQuantity >= maxQuantity}
          className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-white/20 bg-white/5 hover:bg-white/10 text-white disabled:opacity-30"
        >
          <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
        </Button>
      </div>

      {/* Subtotal */}
      {currentQuantity > 0 && (
        <div className="text-center animate-in fade-in slide-in-from-bottom-2 duration-200">
          <p className="text-slate-400 text-sm">Subtotal</p>
          <p className="text-2xl sm:text-3xl font-bold text-white">
            {formatCurrency(section.pricing.total * currentQuantity)}
          </p>
        </div>
      )}

      {/* Max tickets notice */}
      <p className="text-slate-500 text-xs mt-6">
        Máximo 10 boletos por transacción
      </p>
    </div>
  );
}

/**
 * HierarchicalSeatMap - Smart component that handles both flat and hierarchical layouts
 * 
 * For flat layouts: Shows seats directly
 * For hierarchical layouts: Shows sections first, then zooms into seats
 * For general admission sections: Shows quantity selector
 */
export function HierarchicalSeatMap<T extends BaseSeat = BaseSeat>({
  eventId,
  sessionId,
  selectedSeats,
  onSeatClick,
  onSeatSelect,
  generalAdmissionSelections = [],
  onGeneralAdmissionChange,
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

  // Get current GA quantity for selected section
  const getCurrentGAQuantity = useCallback((sectionId: string): number => {
    const selection = generalAdmissionSelections.find(s => s.sectionId === sectionId);
    return selection?.quantity || 0;
  }, [generalAdmissionSelections]);

  // Handle GA quantity change
  const handleGAQuantityChange = useCallback((section: Section, quantity: number) => {
    if (!onGeneralAdmissionChange) return;
    
    onGeneralAdmissionChange({
      sectionId: section.id,
      sectionName: section.name,
      tierId: section.zone?.id || section.id, // Use zone id as tier id, or section id as fallback
      quantity,
      price: section.pricing.total,
      color: section.color,
    });
  }, [onGeneralAdmissionChange]);

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
            // Section detail view - show quantity selector for GA, seats for seated
            <>
              {selectedSection.admissionType === "general" ? (
                // General admission - show quantity selector
                <div className="h-full pt-14 sm:pt-16">
                  <GeneralAdmissionSelector
                    section={selectedSection}
                    currentQuantity={getCurrentGAQuantity(selectedSection.id)}
                    onQuantityChange={(qty) => handleGAQuantityChange(selectedSection, qty)}
                  />
                </div>
              ) : (
                // Seated admission - show seat map
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

export type { GeneralAdmissionSelection };
export default HierarchicalSeatMap;
