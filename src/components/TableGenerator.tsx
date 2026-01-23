import { useState } from "react";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { Table2 } from "lucide-react";

interface Zone {
  id: string;
  name: string;
  color?: string;
}

export type TableConfig = {
  label: string;
  seatCount: number;
  tableRadius: number;
  seatDistance: number;
  zoneId?: string;
  zoneColor?: string;
};

interface TableGeneratorProps {
  onAddTable: (config: TableConfig) => void;
  zones?: Zone[];
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const TableGenerator = ({ onAddTable, zones = [] }: TableGeneratorProps) => {
  const [label, setLabel] = useState("Mesa 1");
  const [seatCount, setSeatCount] = useState(6);
  const [tableDiameter, setTableDiameter] = useState(160);
  const [seatRing, setSeatRing] = useState(120);
  const [selectedZoneId, setSelectedZoneId] = useState<string>("");
  const [tableIndex, setTableIndex] = useState(1);

  const selectedZone = zones.find(z => z.id === selectedZoneId);

  const handleAdd = () => {
    if (seatCount < 2 || seatCount > 24) {
      alert("El número de asientos debe estar entre 2 y 24");
      return;
    }

    const radius = clamp(tableDiameter / 2, 40, 250);
    const minDistance = radius + 20;
    const seatDistance = clamp(seatRing, minDistance, radius + 120);
    const normalizedLabel = label.trim() || `Mesa ${tableIndex}`;

    onAddTable({
      label: normalizedLabel,
      seatCount,
      tableRadius: radius,
      seatDistance,
      zoneId: selectedZoneId || undefined,
      zoneColor: selectedZone?.color,
    });

    setTableIndex((prev) => prev + 1);
    setLabel(`Mesa ${tableIndex + 1}`);
  };

  return (
    <div className="bg-card rounded-xl shadow-lg p-4 border border-border w-[240px]">
      <div className="flex items-center gap-2 mb-4">
        <Table2 className="h-5 w-5 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Mesas</h3>
      </div>

      <div className="space-y-4 text-sm">
        <div>
          <Label htmlFor="tableName" className="text-xs">Nombre</Label>
          <Input
            id="tableName"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Mesa VIP 1"
            className="h-9 text-xs mt-1"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="seatCount" className="text-xs">Asientos</Label>
            <Input
              id="seatCount"
              type="number"
              min={2}
              max={24}
              value={seatCount}
              onChange={(event) => setSeatCount(parseInt(event.target.value, 10) || 0)}
              className="h-9 text-xs mt-1"
            />
          </div>
          <div>
            <Label htmlFor="tableDiameter" className="text-xs">Diámetro (px)</Label>
            <Input
              id="tableDiameter"
              type="number"
              min={80}
              max={500}
              value={tableDiameter}
              onChange={(event) => setTableDiameter(parseInt(event.target.value, 10) || 0)}
              className="h-9 text-xs mt-1"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="seatRing" className="text-xs">Radio de asientos (px)</Label>
          <Input
            id="seatRing"
            type="number"
            min={60}
            max={600}
            value={seatRing}
            onChange={(event) => setSeatRing(parseInt(event.target.value, 10) || 0)}
            className="h-9 text-xs mt-1"
          />
          <p className="text-[11px] text-muted-foreground mt-1">Debe ser mayor al radio de la mesa.</p>
        </div>

        {/* Zona selector */}
        {zones.length > 0 ? (
          <div>
            <Label htmlFor="tableZone" className="text-xs">Zona</Label>
            <Select value={selectedZoneId || "__none__"} onValueChange={(v) => setSelectedZoneId(v === "__none__" ? "" : v)}>
              <SelectTrigger id="tableZone" className="h-9 text-xs mt-1">
                <SelectValue placeholder="Seleccionar zona...">
                  {selectedZone ? (
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full border" 
                        style={{ backgroundColor: selectedZone.color || '#888' }}
                      />
                      <span>{selectedZone.name}</span>
                    </div>
                  ) : (
                    "Crear nueva zona"
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">➕ Crear nueva zona</SelectItem>
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
        ) : (
          <p className="text-xs text-muted-foreground bg-secondary/50 p-2 rounded">
            💡 Crea zonas primero para asignar mesas a ellas
          </p>
        )}

        <Separator />

        <Button onClick={handleAdd} className="w-full" size="sm">
          Añadir mesa
        </Button>
      </div>
    </div>
  );
};
