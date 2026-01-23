import { 
  MousePointer2, Square, Circle, Trash2, Pentagon, Type, Hand, 
  Save, Upload, Undo2, Redo2, Copy, Image, FileJson, LayoutGrid,
  CircleDot, Aperture
} from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { ToolType } from "@/types/canvas";
import { Separator } from "./ui/separator";

interface ToolbarProps {
  activeTool: ToolType;
  onToolClick: (tool: ToolType) => void;
  onClear: () => void;
  onSave: () => void;
  onLoad: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDuplicate: () => void;
  onExportImage: () => void; // Nueva prop
  onExportJSON: () => void;  // Nueva prop
  canUndo: boolean;
  canRedo: boolean;
  saveLabel?: string;
  isSaving?: boolean;
  loadLabel?: string;
  isLoading?: boolean;
}

export const Toolbar = ({ 
  activeTool, 
  onToolClick, 
  onClear, 
  onSave, 
  onLoad, 
  onUndo, 
  onRedo, 
  onDuplicate,
  onExportImage,
  onExportJSON, 
  canUndo, 
  canRedo,
  saveLabel,
  isSaving = false,
  loadLabel,
  isLoading = false,
}: ToolbarProps) => {
  const tools = [
    { id: "select" as const, icon: MousePointer2, label: "Seleccionar" },
    { id: "hand" as const, icon: Hand, label: "Mover (Pan)" },
    { id: "rectangle" as const, icon: Square, label: "Rectángulo" },
    { id: "circle" as const, icon: Circle, label: "Asiento" },
    { id: "polygon" as const, icon: Pentagon, label: "Polígono (Zona)" },
    { id: "section" as const, icon: LayoutGrid, label: "Sección (Polígono)" },
    { id: "section-circle" as const, icon: CircleDot, label: "Sección Circular" },
    { id: "section-arc" as const, icon: Aperture, label: "Sección Curva (Arco)" },
    { id: "text" as const, icon: Type, label: "Texto" },
  ];

  return (
    <div className="bg-card rounded-xl shadow-lg p-4 border border-border w-[240px] flex flex-col gap-4">
      
      {/* Historial */}
      <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onUndo} disabled={!canUndo} className="flex-1" title="Deshacer (Undo)">
              <Undo2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={onRedo} disabled={!canRedo} className="flex-1" title="Rehacer (Redo)">
              <Redo2 className="h-4 w-4" />
          </Button>
      </div>

      <Separator />

      <div>
        <h3 className="text-sm font-semibold mb-3 text-foreground">Herramientas</h3>
        <div className="flex flex-col gap-2">
          {tools.map((tool) => (
            <Button
              key={tool.id}
              variant={activeTool === tool.id ? "default" : "outline"}
              size="sm"
              onClick={() => onToolClick(tool.id)}
              className={cn(
                "justify-start gap-3 transition-all w-full",
                activeTool === tool.id && "bg-primary text-primary-foreground shadow-md"
              )}
            >
              <tool.icon className="h-4 w-4" />
              <span className="text-xs">{tool.label}</span>
            </Button>
          ))}
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-sm font-semibold mb-3 text-foreground">Acciones</h3>
        <div className="flex flex-col gap-2">
            <Button variant="secondary" size="sm" onClick={onDuplicate} className="justify-start gap-3 w-full">
                <Copy className="h-4 w-4" />
                <span className="text-xs">Duplicar Selección</span>
            </Button>
            
            {/* Guardado Local */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onSave}
                className="justify-start gap-2"
                title="Guardar layout"
                disabled={isSaving}
              >
                  <Save className="h-4 w-4" />
                  <span className="text-xs">{isSaving ? "Guardando..." : saveLabel ?? "Guardar"}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onLoad}
                className="justify-start gap-2"
                title="Recargar layout"
                disabled={isLoading}
              >
                  <Upload className="h-4 w-4" />
                  <span className="text-xs">{isLoading ? "Cargando..." : loadLabel ?? "Cargar"}</span>
              </Button>
            </div>

            {/* Exportar */}
            <div className="grid grid-cols-2 gap-2 mt-1">
              <Button variant="outline" size="sm" onClick={onExportImage} className="justify-start gap-2" title="Descargar imagen">
                  <Image className="h-4 w-4" />
                  <span className="text-xs">Imagen</span>
              </Button>
              <Button variant="outline" size="sm" onClick={onExportJSON} className="justify-start gap-2" title="Descargar archivo">
                  <FileJson className="h-4 w-4" />
                  <span className="text-xs">JSON</span>
              </Button>
            </div>
            
            <Button
                variant="destructive"
                size="sm"
                onClick={onClear}
                className="justify-start gap-3 w-full mt-2"
            >
                <Trash2 className="h-4 w-4" />
                <span className="text-xs">Limpiar Todo</span>
            </Button>
        </div>
      </div>
    </div>
  );
};