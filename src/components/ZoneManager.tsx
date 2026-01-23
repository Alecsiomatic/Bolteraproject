import { useState } from "react";
import { Layers, Eye, EyeOff, Trash2, MapPin, ArrowUp, ArrowDown, Pencil } from "lucide-react";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Input } from "./ui/input";
import { Zone } from "@/types/canvas";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

interface ZoneManagerProps {
  zones: Zone[];
  onToggleVisibility: (zoneId: string) => void;
  onDeleteZone: (zoneId: string) => void;
  onSelectZone: (zoneId: string) => void;
  onMoveLayer: (zoneId: string, dir: 'up' | 'down' | 'top' | 'bottom') => void;
  onRenameZone?: (zoneId: string, newName: string) => void;
}

export const ZoneManager = ({ 
  zones, 
  onToggleVisibility, 
  onDeleteZone, 
  onSelectZone, 
  onMoveLayer,
  onRenameZone 
}: ZoneManagerProps) => {
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [editName, setEditName] = useState("");

  const openRenameModal = (zone: Zone, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingZone(zone);
    setEditName(zone.name || "");
  };

  const closeModal = () => {
    setEditingZone(null);
    setEditName("");
  };

  const saveRename = () => {
    if (editingZone && onRenameZone && editName.trim()) {
      onRenameZone(editingZone.id, editName.trim());
    }
    closeModal();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveRename();
    } else if (e.key === 'Escape') {
      closeModal();
    }
  };

  return (
    <>
      <div className="bg-card rounded-xl shadow-lg p-4 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Capas y Zonas</h3>
          <span className="ml-auto text-xs text-muted-foreground">{zones.length}</span>
        </div>

        <ScrollArea className="h-[350px] pr-2">
          {zones.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
              <MapPin className="h-8 w-8 opacity-20" />
              <p className="text-xs text-center">
                No hay zonas creadas.<br/>Dibuja o genera asientos.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {[...zones].reverse().map((zone) => (
                <div
                  key={zone.id}
                  className="flex items-center gap-2 p-2 bg-secondary/50 rounded-lg hover:bg-secondary transition-colors group cursor-pointer"
                  onClick={() => onSelectZone(zone.id)}
                  onDoubleClick={(e) => openRenameModal(zone, e)}
                  role="button"
                  tabIndex={0}
                  title="Clic para seleccionar, doble clic para renombrar"
                >
                  <div
                    className="w-3 h-3 rounded-full border border-border flex-shrink-0"
                    style={{ backgroundColor: zone.color }}
                  />
                  
                  <div className="flex-1 text-left text-sm text-foreground truncate">
                    <div className="font-medium truncate">{zone.name || "Sin nombre"}</div>
                  </div>

                  <div className="flex gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    {/* Edit button */}
                    {onRenameZone && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6" 
                        onClick={(e) => openRenameModal(zone, e)}
                        title="Renombrar zona"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                    
                    {/* Layer controls */}
                    <div className="flex flex-col">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-3 w-5 p-0" 
                        onClick={(e) => { e.stopPropagation(); onMoveLayer(zone.id, 'up'); }} 
                        title="Subir capa"
                      >
                        <ArrowUp className="h-2.5 w-2.5" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-3 w-5 p-0" 
                        onClick={(e) => { e.stopPropagation(); onMoveLayer(zone.id, 'down'); }} 
                        title="Bajar capa"
                      >
                        <ArrowDown className="h-2.5 w-2.5" />
                      </Button>
                    </div>

                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6" 
                      onClick={(e) => { e.stopPropagation(); onToggleVisibility(zone.id); }}
                      title={zone.visible ? "Ocultar" : "Mostrar"}
                    >
                      {zone.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-destructive hover:bg-destructive/10" 
                      onClick={(e) => { e.stopPropagation(); onDeleteZone(zone.id); }}
                      title="Eliminar zona"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-[10px] text-muted-foreground text-center">
            💡 Doble clic para renombrar zona
          </p>
        </div>
      </div>

      {/* Modal para renombrar zona */}
      <Dialog open={!!editingZone} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Renombrar Zona</DialogTitle>
            <DialogDescription>
              Ingresa el nuevo nombre para la zona
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-3">
              {editingZone && (
                <div
                  className="w-6 h-6 rounded-full border-2 border-border flex-shrink-0"
                  style={{ backgroundColor: editingZone.color }}
                />
              )}
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Nombre de la zona"
                className="flex-1"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>
              Cancelar
            </Button>
            <Button onClick={saveRename} disabled={!editName.trim()}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};