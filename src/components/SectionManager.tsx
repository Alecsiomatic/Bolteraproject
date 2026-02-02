import { useState, useMemo } from "react";
import { 
  LayoutGrid, Eye, EyeOff, Trash2, ExternalLink, Pencil, 
  ChevronDown, ChevronRight, Users, DollarSign, Plus, Armchair, Sparkles,
  Target, AlignCenter, RotateCcw, CircleDot, Aperture, Pentagon, Hand
} from "lucide-react";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Slider } from "./ui/slider";
import { Switch } from "./ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "./ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { LayoutSection } from "@/types/canvas";
import { 
  generateSeatsInPolygon, 
  calculateMaxCapacity,
  generateSectionPrefix,
  getPatternDescriptions,
  getNumberingPatternDescriptions,
  type GeneratedSeat,
  type Point2D,
  type SeatGenerationOptions,
  type LayoutPattern,
  type NumberingPattern,
  type RowAlignment,
} from "@/lib/polygon-seat-generator";

export interface SectionData extends LayoutSection {
  // Extended with runtime data
  visible?: boolean;
  seatCount?: number;
  availableSeats?: number;
  // points is alias for polygonPoints for the generator
  points?: Point2D[];
}

// Types for section creation
export type SectionShapeType = "polygon" | "circle" | "arc";

interface SectionManagerProps {
  sections: SectionData[];
  layoutId?: string;
  isHierarchical?: boolean;
  onSelectSection: (sectionId: string) => void;
  onDeleteSection: (sectionId: string) => void;
  onToggleVisibility?: (sectionId: string) => void;
  onEditSection?: (section: SectionData) => void;
  onOpenChildLayout?: (sectionId: string, childLayoutId: string) => void;
  onCreateSection?: (shapeType?: SectionShapeType) => void;
  onUpdateSection?: (sectionId: string, updates: Partial<SectionData>) => void;
  onGenerateSeats?: (sectionId: string, seats: GeneratedSeat[], options: SeatGenerationOptions) => void;
  // Pan tool support
  isPanToolActive?: boolean;
  onTogglePanTool?: () => void;
}

// Advanced generation form state
interface GenFormState {
  // Basic
  capacity: number;
  seatSize: number;
  spacing: number;
  pattern: LayoutPattern;
  startRow: string;
  startNumber: number;
  // Advanced
  numberingPattern: NumberingPattern;
  rowAlignment: RowAlignment;
  seatsPerRow: number;
  autoAlign: boolean;
  gridRotation: number;
  rotatesToFocalPoint: boolean;
  edgeMargin: number;
  rowSpacingMultiplier: number;
  // Aisles
  aisleEnabled: boolean;
  aislePosition: number;
  aisleGap: number;
}

const defaultGenForm: GenFormState = {
  capacity: 50,
  seatSize: 28,
  spacing: 8,
  pattern: "staggered",
  startRow: "A",
  startNumber: 1,
  numberingPattern: "left-to-right",
  rowAlignment: "center",
  seatsPerRow: 0,
  autoAlign: false,
  gridRotation: 0,
  rotatesToFocalPoint: false,
  edgeMargin: 10,
  rowSpacingMultiplier: 1,
  aisleEnabled: false,
  aislePosition: 5,
  aisleGap: 40,
};

export const SectionManager = ({
  sections,
  layoutId,
  isHierarchical = false,
  onSelectSection,
  onDeleteSection,
  onToggleVisibility,
  onEditSection,
  onOpenChildLayout,
  onCreateSection,
  onUpdateSection,
  onGenerateSeats,
  isPanToolActive = false,
  onTogglePanTool,
}: SectionManagerProps) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [editingSection, setEditingSection] = useState<SectionData | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    capacity: 0,
    color: "#3b82f6",
  });

  // Seat generation modal state
  const [generatingSection, setGeneratingSection] = useState<SectionData | null>(null);
  const [genForm, setGenForm] = useState<GenFormState>(defaultGenForm);
  const [maxCapacity, setMaxCapacity] = useState(0);
  const [previewSeats, setPreviewSeats] = useState<GeneratedSeat[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Pattern descriptions for UI
  const patternOptions = getPatternDescriptions();
  const numberingOptions = getNumberingPatternDescriptions();

  // Summary stats
  const stats = useMemo(() => {
    const totalCapacity = sections.reduce((sum, s) => sum + (s.capacity || 0), 0);
    const totalAvailable = sections.reduce((sum, s) => sum + (s.availableSeats || 0), 0);
    const withChildren = sections.filter(s => s.childLayoutId).length;
    return { totalCapacity, totalAvailable, withChildren, total: sections.length };
  }, [sections]);

  const toggleExpanded = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const openEditModal = (section: SectionData, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingSection(section);
    setEditForm({
      name: section.name,
      capacity: section.capacity,
      color: section.color,
    });
  };

  const closeModal = () => {
    setEditingSection(null);
    setEditForm({ name: "", capacity: 0, color: "#3b82f6" });
  };

  const saveEdit = () => {
    if (editingSection && onUpdateSection && editForm.name.trim()) {
      onUpdateSection(editingSection.id, {
        name: editForm.name.trim(),
        capacity: editForm.capacity,
        color: editForm.color,
      });
    }
    closeModal();
  };

  // Open seat generation modal
  const openGenerateModal = (section: SectionData, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!section.points || section.points.length < 3) {
      return; // Can't generate without polygon points
    }
    
    setGeneratingSection(section);
    const max = calculateMaxCapacity(section.points, genForm.seatSize, genForm.spacing);
    setMaxCapacity(max);
    setGenForm(prev => ({
      ...prev,
      capacity: Math.min(prev.capacity, max),
    }));
    
    // Generate preview with section prefix
    updatePreview(section, Math.min(genForm.capacity, max));
  };

  const closeGenerateModal = () => {
    setGeneratingSection(null);
    setPreviewSeats([]);
    setMaxCapacity(0);
  };

  // Generate section prefix from name or index
  const getSectionPrefix = (section: SectionData): string => {
    const sectionIndex = sections.findIndex(s => s.id === section.id);
    return generateSectionPrefix(section.name, sectionIndex);
  };

  // Build full options object from form
  const buildOptions = (section: SectionData): SeatGenerationOptions => {
    const sectionPrefix = getSectionPrefix(section);
    return {
      capacity: genForm.capacity,
      seatSize: genForm.seatSize,
      spacing: genForm.spacing,
      pattern: genForm.pattern,
      startRow: genForm.startRow,
      startNumber: genForm.startNumber,
      sectionPrefix,
      // Advanced options
      numberingPattern: genForm.numberingPattern,
      rowAlignment: genForm.rowAlignment,
      seatsPerRow: genForm.seatsPerRow > 0 ? genForm.seatsPerRow : undefined,
      autoAlign: genForm.autoAlign,
      gridRotation: genForm.gridRotation,
      rotatesToFocalPoint: genForm.rotatesToFocalPoint,
      edgeMargin: genForm.edgeMargin,
      rowSpacingMultiplier: genForm.rowSpacingMultiplier,
      // Aisles
      aislePositions: genForm.aisleEnabled ? [genForm.aislePosition] : undefined,
      aisleGap: genForm.aisleEnabled ? genForm.aisleGap : undefined,
    };
  };

  const updatePreview = (section: SectionData, capacity?: number) => {
    if (!section.points) return;
    const options = buildOptions(section);
    if (capacity !== undefined) {
      options.capacity = capacity;
    }
    const seats = generateSeatsInPolygon(section.points, options);
    setPreviewSeats(seats);
  };

  const handleGenFormChange = (key: keyof GenFormState, value: any) => {
    const newForm = { ...genForm, [key]: value };
    setGenForm(newForm);
    
    if (generatingSection?.points) {
      // Recalculate max capacity if size/spacing changed
      if (key === "seatSize" || key === "spacing" || key === "edgeMargin") {
        const max = calculateMaxCapacity(generatingSection.points, newForm.seatSize, newForm.spacing);
        setMaxCapacity(max);
        newForm.capacity = Math.min(newForm.capacity, max);
        setGenForm(newForm);
      }
      updatePreview(generatingSection, newForm.capacity);
    }
  };

  const confirmGeneration = () => {
    if (generatingSection && onGenerateSeats && previewSeats.length > 0) {
      const options = buildOptions(generatingSection);
      onGenerateSeats(generatingSection.id, previewSeats, options);
    }
    closeGenerateModal();
  };

  return (
    <>
      <div className="bg-card rounded-xl shadow-lg p-4 border border-border">
        <div className="flex items-center gap-2 mb-3">
          <LayoutGrid className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Secciones</h3>
          <Badge variant="secondary" className="ml-auto text-xs">
            {sections.length}
          </Badge>
        </div>

        {/* Summary Stats */}
        {sections.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mb-3 p-2 bg-secondary/30 rounded-lg text-xs">
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Capacidad:</span>
              <span className="font-medium">{stats.totalCapacity}</span>
            </div>
            {isHierarchical && (
              <div className="flex items-center gap-1.5">
                <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Con layout:</span>
                <span className="font-medium">{stats.withChildren}</span>
              </div>
            )}
          </div>
        )}

        {/* Toolbar: Create Section + Pan Tool */}
        <div className="flex gap-2 mb-3">
          {/* Hand/Pan tool button */}
          {onTogglePanTool && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={isPanToolActive ? "default" : "outline"}
                    size="sm"
                    onClick={onTogglePanTool}
                    className="h-9 w-9 p-0 flex-shrink-0"
                  >
                    <Hand className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Mover vista (H)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Create Section Dropdown */}
          {onCreateSection && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Crear Sección
                  <ChevronDown className="h-3 w-3 ml-auto opacity-50" />
                </Button>
              </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Tipo de Sección</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onCreateSection("polygon")} className="gap-2 cursor-pointer">
                <Pentagon className="h-4 w-4 text-blue-500" />
                <div className="flex flex-col">
                  <span>Polígono</span>
                  <span className="text-xs text-muted-foreground">Dibuja punto a punto</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onCreateSection("circle")} className="gap-2 cursor-pointer">
                <CircleDot className="h-4 w-4 text-green-500" />
                <div className="flex flex-col">
                  <span>Circular / Elipse</span>
                  <span className="text-xs text-muted-foreground">Arrastra para crear</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onCreateSection("arc")} className="gap-2 cursor-pointer">
                <Aperture className="h-4 w-4 text-purple-500" />
                <div className="flex flex-col">
                  <span>Arco / Curva</span>
                  <span className="text-xs text-muted-foreground">Ideal para estadios</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          )}
        </div>

        <ScrollArea className="h-[300px] pr-2">
          {sections.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-muted-foreground gap-3">
              <LayoutGrid className="h-10 w-10 opacity-20" />
              <div className="text-center space-y-2">
                <p className="text-xs font-medium">No hay secciones</p>
                <div className="text-[11px] text-left bg-secondary/50 rounded-lg p-3 space-y-2">
                  <p className="font-semibold text-foreground">¿Cómo crear secciones?</p>
                  <p className="text-muted-foreground">Usa el botón "Crear Sección" arriba para elegir:</p>
                  <ul className="space-y-1 text-muted-foreground ml-2">
                    <li className="flex items-center gap-2">
                      <Pentagon className="h-3 w-3 text-blue-500" />
                      <span><strong>Polígono:</strong> Dibuja punto a punto</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CircleDot className="h-3 w-3 text-green-500" />
                      <span><strong>Circular:</strong> Arrastra para crear</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Aperture className="h-3 w-3 text-purple-500" />
                      <span><strong>Arco:</strong> Define centro, radios y ángulos</span>
                    </li>
                  </ul>
                  <p className="text-[10px] text-muted-foreground/80 mt-2 pt-2 border-t border-border">
                    💡 <strong>Tip:</strong> Después de crear una sección, usa el botón ✨ para generar asientos automáticamente
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {sections.map((section) => {
                const isExpanded = expandedSections.has(section.id);
                const hasChildLayout = Boolean(section.childLayoutId);
                
                return (
                  <Collapsible 
                    key={section.id} 
                    open={isExpanded} 
                    onOpenChange={() => toggleExpanded(section.id)}
                  >
                    <div
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-lg transition-colors group cursor-pointer overflow-hidden",
                        "bg-secondary/50 hover:bg-secondary",
                        hasChildLayout && "border-l-2",
                      )}
                      style={hasChildLayout ? { borderLeftColor: section.color } : undefined}
                      onClick={() => onSelectSection(section.id)}
                    >
                      {/* Expand/Collapse */}
                      <CollapsibleTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-5 w-5 p-0 flex-shrink-0">
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </CollapsibleTrigger>

                      {/* Color indicator */}
                      <div
                        className="w-3 h-3 rounded-full border border-border flex-shrink-0"
                        style={{ backgroundColor: section.color }}
                      />

                      {/* Name and capacity */}
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="font-medium text-sm truncate">
                          {section.name}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-0.5">
                            <Users className="h-3 w-3 flex-shrink-0" />
                            {section.capacity}
                          </span>
                          {hasChildLayout && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 flex-shrink-0">
                              Layout
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-0.5 opacity-60 group-hover:opacity-100 flex-shrink-0 ml-auto" onClick={(e) => e.stopPropagation()}>
                        {/* Generate Seats Button */}
                        {onGenerateSeats && section.points && section.points.length >= 3 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 flex-shrink-0 text-primary hover:bg-primary/10"
                            onClick={(e) => openGenerateModal(section, e)}
                            title="Generar asientos automáticamente"
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                          </Button>
                        )}

                        {onEditSection && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 flex-shrink-0"
                            onClick={(e) => openEditModal(section, e)}
                            title="Editar sección"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                        
                        {onToggleVisibility && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 flex-shrink-0"
                            onClick={(e) => { e.stopPropagation(); onToggleVisibility(section.id); }}
                            title={section.visible !== false ? "Ocultar" : "Mostrar"}
                          >
                            {section.visible !== false ? (
                              <Eye className="h-3.5 w-3.5" />
                            ) : (
                              <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </Button>
                        )}

                        {hasChildLayout && onOpenChildLayout && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 flex-shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenChildLayout(section.id, section.childLayoutId!);
                            }}
                            title="Abrir layout de sección"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 flex-shrink-0 text-destructive hover:bg-destructive/10"
                          onClick={(e) => { e.stopPropagation(); onDeleteSection(section.id); }}
                          title="Eliminar sección"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    <CollapsibleContent>
                      <div className="ml-7 mt-1 p-2 bg-muted/50 rounded-md text-xs space-y-1.5">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Orden:</span>
                          <span>{section.displayOrder}</span>
                        </div>
                        {section.zoneId && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Zona:</span>
                            <span className="truncate max-w-[120px]">{section.zoneId}</span>
                          </div>
                        )}
                        {section.childLayoutId && (
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Layout hijo:</span>
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto p-0 text-xs"
                              onClick={() => onOpenChildLayout?.(section.id, section.childLayoutId!)}
                            >
                              Abrir <ExternalLink className="h-3 w-3 ml-1" />
                            </Button>
                          </div>
                        )}
                        {!section.childLayoutId && isHierarchical && (
                          <div className="pt-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full text-xs h-7"
                              onClick={() => {/* TODO: Create child layout */}}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Crear layout de asientos
                            </Button>
                          </div>
                        )}
                        {/* Generate Seats Button (in expanded area) */}
                        {onGenerateSeats && section.points && section.points.length >= 3 && (
                          <div className="pt-1">
                            <Button
                              variant="default"
                              size="sm"
                              className="w-full text-xs h-7 gap-1"
                              onClick={(e) => openGenerateModal(section, e)}
                            >
                              <Sparkles className="h-3 w-3" />
                              Generar Asientos Automáticamente
                            </Button>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Hierarchical Mode Indicator */}
        {isHierarchical && (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <LayoutGrid className="h-4 w-4" />
              <span>Modo jerárquico activo</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Las secciones pueden tener layouts hijos con asientos
            </p>
          </div>
        )}
      </div>

      {/* Edit Section Modal */}
      <Dialog open={!!editingSection} onOpenChange={() => closeModal()}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Editar Sección</DialogTitle>
            <DialogDescription>
              Modifica las propiedades de la sección "{editingSection?.name}"
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="section-name">Nombre</Label>
              <Input
                id="section-name"
                value={editForm.name}
                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Nombre de la sección"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="section-capacity">Capacidad</Label>
              <Input
                id="section-capacity"
                type="number"
                min={0}
                value={editForm.capacity}
                onChange={(e) => setEditForm(prev => ({ ...prev, capacity: parseInt(e.target.value) || 0 }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="section-color">Color</Label>
              <div className="flex gap-2">
                <Input
                  id="section-color"
                  type="color"
                  value={editForm.color}
                  onChange={(e) => setEditForm(prev => ({ ...prev, color: e.target.value }))}
                  className="w-12 h-9 p-1 cursor-pointer"
                />
                <Input
                  value={editForm.color}
                  onChange={(e) => setEditForm(prev => ({ ...prev, color: e.target.value }))}
                  placeholder="#3b82f6"
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>
              Cancelar
            </Button>
            <Button onClick={saveEdit}>
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Seats Modal - Professional Version */}
      <Dialog open={!!generatingSection} onOpenChange={() => closeGenerateModal()}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Generador Profesional de Asientos
            </DialogTitle>
            <DialogDescription>
              Configura y genera asientos automáticamente en "{generatingSection?.name}"
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Básico</TabsTrigger>
              <TabsTrigger value="layout">Distribución</TabsTrigger>
              <TabsTrigger value="advanced">Avanzado</TabsTrigger>
            </TabsList>

            {/* Basic Tab */}
            <TabsContent value="basic" className="space-y-4 mt-4">
              {/* Capacity slider */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label>Cantidad de asientos</Label>
                  <span className="text-sm font-medium text-primary">{genForm.capacity}</span>
                </div>
                <Slider
                  value={[genForm.capacity]}
                  onValueChange={([value]) => handleGenFormChange("capacity", value)}
                  min={1}
                  max={maxCapacity}
                  step={1}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Máximo: {maxCapacity} asientos (basado en el área del polígono)
                </p>
              </div>

              {/* Size and spacing */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="seat-size">Tamaño asiento (px)</Label>
                  <Input
                    id="seat-size"
                    type="number"
                    min={16}
                    max={50}
                    value={genForm.seatSize}
                    onChange={(e) => handleGenFormChange("seatSize", parseInt(e.target.value) || 28)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="seat-spacing">Espaciado (px)</Label>
                  <Input
                    id="seat-spacing"
                    type="number"
                    min={2}
                    max={30}
                    value={genForm.spacing}
                    onChange={(e) => handleGenFormChange("spacing", parseInt(e.target.value) || 8)}
                  />
                </div>
              </div>

              {/* Row/Number start */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="start-row">Fila inicial</Label>
                  <Input
                    id="start-row"
                    value={genForm.startRow}
                    onChange={(e) => handleGenFormChange("startRow", e.target.value.toUpperCase() || "A")}
                    maxLength={2}
                    placeholder="A"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="start-number">Número inicial</Label>
                  <Input
                    id="start-number"
                    type="number"
                    min={1}
                    value={genForm.startNumber}
                    onChange={(e) => handleGenFormChange("startNumber", parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>
            </TabsContent>

            {/* Layout/Distribution Tab */}
            <TabsContent value="layout" className="space-y-4 mt-4">
              {/* Pattern selection */}
              <div className="space-y-2">
                <Label>Patrón de distribución</Label>
                <Select 
                  value={genForm.pattern} 
                  onValueChange={(value: LayoutPattern) => handleGenFormChange("pattern", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {patternOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex items-center gap-2">
                          <span>{opt.value === "grid" ? "⬜" : opt.value === "staggered" ? "🔷" : opt.value === "curved" ? "🌙" : "🎯"}</span>
                          <span>{opt.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Numbering pattern */}
              <div className="space-y-2">
                <Label>Patrón de numeración</Label>
                <Select 
                  value={genForm.numberingPattern} 
                  onValueChange={(value: NumberingPattern) => handleGenFormChange("numberingPattern", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {numberingOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex items-center gap-2">
                          <span>
                            {opt.value === "serpentine" ? "🐍" : 
                             opt.value === "center-out" ? "↔️" : 
                             opt.value === "center-out-paired" ? "⚡" :
                             opt.value === "right-to-left" ? "◀️" : "▶️"}
                          </span>
                          <span>{opt.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Row alignment */}
              <div className="space-y-2">
                <Label>Alineación de filas</Label>
                <Select 
                  value={genForm.rowAlignment} 
                  onValueChange={(value: RowAlignment) => handleGenFormChange("rowAlignment", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">
                      <div className="flex items-center gap-2">
                        <AlignCenter className="h-4 w-4 rotate-180" />
                        <span>Izquierda</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="center">
                      <div className="flex items-center gap-2">
                        <AlignCenter className="h-4 w-4" />
                        <span>Centro</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="right">
                      <div className="flex items-center gap-2">
                        <AlignCenter className="h-4 w-4" />
                        <span>Derecha</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="justify">
                      <div className="flex items-center gap-2">
                        <LayoutGrid className="h-4 w-4" />
                        <span>Justificado</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Seats per row */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="seats-per-row">Asientos por fila (0 = automático)</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-xs text-muted-foreground cursor-help">ℹ️</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs text-xs">
                          Define un número fijo de asientos por fila. 
                          Si es 0, se calculará automáticamente según el ancho del polígono.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input
                  id="seats-per-row"
                  type="number"
                  min={0}
                  max={100}
                  value={genForm.seatsPerRow}
                  onChange={(e) => handleGenFormChange("seatsPerRow", parseInt(e.target.value) || 0)}
                  placeholder="0 = automático"
                />
              </div>
            </TabsContent>

            {/* Advanced Tab */}
            <TabsContent value="advanced" className="space-y-4 mt-4">
              {/* Auto-align to polygon */}
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <RotateCcw className="h-4 w-4 text-primary" />
                    Auto-alinear al polígono
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Rota la grilla para alinearse con el borde más largo
                  </p>
                </div>
                <Switch
                  checked={genForm.autoAlign}
                  onCheckedChange={(checked) => handleGenFormChange("autoAlign", checked)}
                />
              </div>

              {/* Manual rotation (only if not auto-align) */}
              {!genForm.autoAlign && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label>Rotación manual</Label>
                    <span className="text-sm font-medium">{genForm.gridRotation}°</span>
                  </div>
                  <Slider
                    value={[genForm.gridRotation]}
                    onValueChange={([value]) => handleGenFormChange("gridRotation", value)}
                    min={-180}
                    max={180}
                    step={5}
                    className="w-full"
                  />
                </div>
              )}

              {/* Rotate seats to focal point */}
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    Orientar hacia escenario
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Rota cada asiento hacia el punto focal (centro inferior)
                  </p>
                </div>
                <Switch
                  checked={genForm.rotatesToFocalPoint}
                  onCheckedChange={(checked) => handleGenFormChange("rotatesToFocalPoint", checked)}
                />
              </div>

              {/* Edge margin */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Margen del borde (px)</Label>
                  <span className="text-sm font-medium">{genForm.edgeMargin}px</span>
                </div>
                <Slider
                  value={[genForm.edgeMargin]}
                  onValueChange={([value]) => handleGenFormChange("edgeMargin", value)}
                  min={0}
                  max={50}
                  step={2}
                  className="w-full"
                />
              </div>

              {/* Row spacing multiplier */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Multiplicador espacio entre filas</Label>
                  <span className="text-sm font-medium">{genForm.rowSpacingMultiplier.toFixed(1)}x</span>
                </div>
                <Slider
                  value={[genForm.rowSpacingMultiplier * 10]}
                  onValueChange={([value]) => handleGenFormChange("rowSpacingMultiplier", value / 10)}
                  min={5}
                  max={20}
                  step={1}
                  className="w-full"
                />
              </div>

              {/* Aisles */}
              <div className="space-y-3 p-3 border border-border rounded-lg">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    🚶 Pasillo central
                  </Label>
                  <Switch
                    checked={genForm.aisleEnabled}
                    onCheckedChange={(checked) => handleGenFormChange("aisleEnabled", checked)}
                  />
                </div>
                
                {genForm.aisleEnabled && (
                  <div className="space-y-3 pt-2">
                    <div className="space-y-2">
                      <Label className="text-xs">Posición del pasillo (después del asiento #)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={50}
                        value={genForm.aislePosition}
                        onChange={(e) => handleGenFormChange("aislePosition", parseInt(e.target.value) || 5)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Ancho del pasillo (px)</Label>
                      <Input
                        type="number"
                        min={20}
                        max={100}
                        value={genForm.aisleGap}
                        onChange={(e) => handleGenFormChange("aisleGap", parseInt(e.target.value) || 40)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* Preview info - Always visible */}
          <div className="p-3 bg-gradient-to-r from-primary/10 to-secondary/30 rounded-lg border border-primary/20 mt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-2">
                <Armchair className="h-4 w-4" />
                Asientos a generar:
              </span>
              <Badge variant="secondary" className="text-base font-bold">
                {previewSeats.length}
              </Badge>
            </div>
            {previewSeats.length > 0 && (
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>
                  <span>Primer asiento: </span>
                  <span className="font-medium text-foreground">{previewSeats[0]?.label}</span>
                </div>
                <div>
                  <span>Último asiento: </span>
                  <span className="font-medium text-foreground">{previewSeats[previewSeats.length - 1]?.label}</span>
                </div>
                <div>
                  <span>Filas: </span>
                  <span className="font-medium text-foreground">
                    {new Set(previewSeats.map(s => s.row)).size}
                  </span>
                </div>
                <div>
                  <span>Patrón: </span>
                  <span className="font-medium text-foreground capitalize">{genForm.pattern}</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={closeGenerateModal}>
              Cancelar
            </Button>
            <Button 
              onClick={confirmGeneration} 
              disabled={previewSeats.length === 0}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Generar {previewSeats.length} asientos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SectionManager;
