import { useState, useEffect } from "react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { 
    Settings, Save, Tag, Layers, Lock, Unlock, 
    AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal, 
    AlignStartVertical, AlignCenterVertical, AlignEndVertical,
    SeparatorHorizontal, SeparatorVertical, Group, Ungroup,
    MapPin
} from "lucide-react";
import { CustomFabricObject } from "@/types/canvas";
import { Separator } from "./ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

interface Zone {
  id: string;
  name: string;
  color?: string;
}

interface PropertiesPanelProps {
  selectedObjects: CustomFabricObject[];
  onUpdate: (properties: Record<string, any>) => void;
  onAlign: (direction: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  onDistribute?: (direction: 'horizontal' | 'vertical') => void;
  onGroup?: () => void;
  onUngroup?: () => void;
  zones?: Zone[];
  onZoneChange?: (zoneId: string | null) => void;
}

export const PropertiesPanel = ({ 
  selectedObjects, 
  onUpdate, 
  onAlign, 
  onDistribute, 
  onGroup, 
  onUngroup,
  zones = [],
  onZoneChange
}: PropertiesPanelProps) => {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [capacity, setCapacity] = useState("");
  const [isLocked, setIsLocked] = useState(false);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedObjects.length === 1) {
      const obj = selectedObjects[0];
      setName(obj.name || "");
      setPrice(obj.price?.toString() || "");
      setCapacity(obj.capacity?.toString() || "");
      setIsLocked(!!obj.lockMovementX);
      setSelectedZoneId(obj.zoneId || null);
    } else if (selectedObjects.length > 1) {
      const firstPrice = selectedObjects[0].price;
      const samePrice = selectedObjects.every(o => o.price === firstPrice);
      setPrice(samePrice ? firstPrice?.toString() || "" : "");

      const firstName = selectedObjects[0].name;
      const sameName = selectedObjects.every(o => o.name === firstName);
      setName(sameName ? firstName || "" : "");
      
      const firstZone = selectedObjects[0].zoneId;
      const sameZone = selectedObjects.every(o => o.zoneId === firstZone);
      setSelectedZoneId(sameZone ? firstZone || null : null);
      
      setCapacity("");
      setIsLocked(selectedObjects.every(o => !!o.lockMovementX));
    } else {
      setName("");
      setPrice("");
      setCapacity("");
      setIsLocked(false);
      setSelectedZoneId(null);
    }
  }, [selectedObjects]);

  const handleSave = () => {
    const updates: Record<string, any> = {};
    if (name) updates.name = name;
    if (price) updates.price = parseFloat(price);
    if (capacity) updates.capacity = parseInt(capacity);
    onUpdate(updates);
  };

  const handleZoneSelect = (value: string) => {
    const zoneId = value === "none" ? null : value;
    setSelectedZoneId(zoneId);
    if (onZoneChange) {
      onZoneChange(zoneId);
    }
    onUpdate({ zoneId });
  };

  const toggleLock = () => {
      const newState = !isLocked;
      setIsLocked(newState);
      onUpdate({
          lockMovementX: newState,
          lockMovementY: newState,
          lockRotation: newState,
          lockScalingX: newState,
          lockScalingY: newState,
          selectable: true, 
          hasControls: !newState, 
          hoverCursor: newState ? 'default' : 'move'
      });
  };

  const getTypeLabel = (type: string | undefined) => {
    switch(type) {
      case 'seat': return '🪑 Asiento';
      case 'zone': return '📍 Zona';
      case 'table': return '🍽️ Mesa';
      case 'text': return '📝 Texto';
      case 'rect': return '⬜ Rectángulo';
      case 'circle': return '⭕ Círculo';
      case 'polygon': return '⬡ Polígono';
      case 'group': return '📦 Grupo';
      default: return '📦 Objeto';
    }
  };

  const currentZone = zones.find(z => z.id === selectedZoneId);

  if (selectedObjects.length === 0) {
    return (
      <div className="bg-card rounded-xl shadow-lg p-4 border border-border">
        <div className="flex items-center gap-2 mb-4 text-muted-foreground">
          <Settings className="h-5 w-5" />
          <h3 className="text-sm font-semibold">Propiedades</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50 border-2 border-dashed border-muted rounded-lg">
            <Tag className="h-8 w-8 mb-2" />
            <p className="text-xs text-center px-4">
            Selecciona elementos para editar
            </p>
        </div>
      </div>
    );
  }

  const isMultiple = selectedObjects.length > 1;
  const firstObj = selectedObjects[0];

  return (
    <div className="bg-card rounded-xl shadow-lg p-4 border border-border">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
            {isMultiple ? <Layers className="h-5 w-5 text-primary" /> : <Settings className="h-5 w-5 text-primary" />}
            <h3 className="text-sm font-semibold text-foreground">
                {isMultiple ? `${selectedObjects.length} Elementos` : getTypeLabel(firstObj._customType || firstObj.type)}
            </h3>
        </div>
        <Button 
            variant={isLocked ? "destructive" : "ghost"} 
            size="icon" 
            className="h-6 w-6" 
            onClick={toggleLock}
            title={isLocked ? "Desbloquear" : "Bloquear posición"}
        >
            {isLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
        </Button>
      </div>

      <div className="space-y-3">
        {/* Nombre */}
        <div>
          <Label htmlFor="name" className="text-xs font-medium">Nombre / Etiqueta</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isMultiple ? "Varios nombres..." : "Ej: Zona VIP, Mesa 1, A1"}
            className="h-8 text-sm mt-1"
            disabled={isLocked}
          />
        </div>

        {/* Zona - Selector */}
        {zones.length > 0 && (
          <div>
            <Label className="text-xs font-medium flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Zona Asignada
            </Label>
            <Select 
              value={selectedZoneId || "none"} 
              onValueChange={handleZoneSelect}
              disabled={isLocked}
            >
              <SelectTrigger className="h-8 text-sm mt-1">
                <SelectValue placeholder="Sin zona asignada">
                  {currentZone ? (
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full border" 
                        style={{ backgroundColor: currentZone.color || '#888' }}
                      />
                      <span>{currentZone.name}</span>
                    </div>
                  ) : (
                    "Sin zona asignada"
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">Sin zona asignada</span>
                </SelectItem>
                {zones.map(zone => (
                  <SelectItem key={zone.id} value={zone.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full border" 
                        style={{ backgroundColor: zone.color || '#888' }}
                      />
                      <span>{zone.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Precio y Capacidad */}
        <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="price" className="text-xs font-medium">Precio ($)</Label>
              <Input
                  id="price"
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder={isMultiple ? "Varios..." : "0.00"}
                  className="h-8 text-sm mt-1"
                  disabled={isLocked}
              />
            </div>

            <div>
              <Label htmlFor="capacity" className="text-xs font-medium">Capacidad</Label>
              <Input
                  id="capacity"
                  type="number"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  placeholder={isMultiple ? "-" : "-"}
                  className="h-8 text-sm mt-1"
                  disabled={firstObj._customType === 'seat' || isLocked}
              />
            </div>
        </div>

        <Button onClick={handleSave} className="w-full gap-2" size="sm" disabled={isLocked}>
          <Save className="h-4 w-4" />
          {isMultiple ? "Aplicar a Todos" : "Guardar Cambios"}
        </Button>
        
        {isMultiple && !isLocked && (
            <>
                <Separator className="my-2" />
                <Label className="text-xs font-medium mb-2 block">Alineación</Label>
                <div className="grid grid-cols-6 gap-1">
                    <Button variant="outline" size="icon" className="h-7 w-full" onClick={() => onAlign('left')} title="Izquierda">
                        <AlignStartHorizontal className="h-3 w-3" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-7 w-full" onClick={() => onAlign('center')} title="Centro Horizontal">
                        <AlignCenterHorizontal className="h-3 w-3" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-7 w-full" onClick={() => onAlign('right')} title="Derecha">
                        <AlignEndHorizontal className="h-3 w-3" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-7 w-full" onClick={() => onAlign('top')} title="Arriba">
                        <AlignStartVertical className="h-3 w-3" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-7 w-full" onClick={() => onAlign('middle')} title="Centro Vertical">
                        <AlignCenterVertical className="h-3 w-3" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-7 w-full" onClick={() => onAlign('bottom')} title="Abajo">
                        <AlignEndVertical className="h-3 w-3" />
                    </Button>
                </div>

                {selectedObjects.length >= 3 && onDistribute && (
                    <>
                        <Separator className="my-2" />
                        <Label className="text-xs font-medium mb-2 block">Distribución</Label>
                        <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" size="sm" onClick={() => onDistribute('horizontal')} className="h-8 text-xs gap-2">
                                <SeparatorHorizontal className="h-3 w-3" />
                                Horizontal
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => onDistribute('vertical')} className="h-8 text-xs gap-2">
                                <SeparatorVertical className="h-3 w-3" />
                                Vertical
                            </Button>
                        </div>
                    </>
                )}

                {onGroup && (
                    <>
                        <Separator className="my-2" />
                        <Button variant="outline" size="sm" onClick={onGroup} className="w-full h-8 text-xs gap-2">
                            <Group className="h-3 w-3" />
                            Agrupar Selección
                        </Button>
                    </>
                )}
            </>
        )}

        {!isMultiple && firstObj.type === 'group' && onUngroup && (
            <>
                <Separator className="my-2" />
                <Button variant="outline" size="sm" onClick={onUngroup} className="w-full h-8 text-xs gap-2">
                    <Ungroup className="h-3 w-3" />
                    Desagrupar
                </Button>
            </>
        )}

        {!isMultiple && (
            <div className="text-[10px] text-muted-foreground text-center mt-2 space-y-0.5">
                <div>ID: {firstObj.id?.slice(0, 20)}...</div>
                {firstObj.zoneId && <div>ZonaID: {firstObj.zoneId.slice(0, 15)}...</div>}
            </div>
        )}
      </div>
    </div>
  );
};
