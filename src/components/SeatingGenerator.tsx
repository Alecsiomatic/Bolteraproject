import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Grid3x3, Plus } from "lucide-react";
import { SeatType, SeatingGrid, SeatShape } from "@/types/canvas";
import { Separator } from "./ui/separator";
import { generateSectionPrefix } from "@/lib/polygon-seat-generator";

interface Zone {
  id: string;
  name: string;
  color?: string;
}

interface SeatingGeneratorProps {
  onGenerate: (grid: SeatingGrid) => void;
  zones?: Zone[];
}

export const SeatingGenerator = ({ onGenerate, zones = [] }: SeatingGeneratorProps) => {
  const [rows, setRows] = useState(5);
  const [columns, setColumns] = useState(10);
  const [rowSpacing, setRowSpacing] = useState(40);
  const [seatSpacing, setSeatSpacing] = useState(35);
  const [startRow, setStartRow] = useState("A");
  const [seatType, setSeatType] = useState<SeatType>("regular");
  const [seatShape, setSeatShape] = useState<SeatShape>("circle");
  const [selectedZoneId, setSelectedZoneId] = useState<string>("");

  const selectedZone = zones.find(z => z.id === selectedZoneId);

  const handleGenerate = () => {
    // Validaciones
    if (rows < 1 || rows > 50) {
      alert("Las filas deben estar entre 1 y 50");
      return;
    }
    if (columns < 1 || columns > 100) {
      alert("Las columnas deben estar entre 1 y 100");
      return;
    }
    if (rowSpacing < 10 || rowSpacing > 200) {
      alert("El espaciado de filas debe estar entre 10 y 200");
      return;
    }
    if (seatSpacing < 10 || seatSpacing > 200) {
      alert("El espaciado de asientos debe estar entre 10 y 200");
      return;
    }
    
    // Generar prefijo basado en la zona seleccionada
    const zoneIndex = zones.findIndex(z => z.id === selectedZoneId);
    const labelPrefix = selectedZone?.name 
      ? generateSectionPrefix(selectedZone.name, zoneIndex)
      : zoneIndex >= 0 ? `Z${zoneIndex + 1}` : `Z${Date.now() % 1000}`;
    
    onGenerate({
      rows: Number(rows) || 1,
      columns: Number(columns) || 1,
      rowSpacing: Number(rowSpacing) || 20,
      seatSpacing: Number(seatSpacing) || 20,
      startRow: startRow || "A",
      seatType, 
      seatShape,
      zoneId: selectedZoneId || `zone-${Date.now()}`,
      zoneName: selectedZone?.name,
      zoneColor: selectedZone?.color,
      labelPrefix,
    });
  };

  return (
    <div className="bg-card rounded-xl shadow-lg p-4 border border-border w-[280px]">
      <div className="flex items-center gap-2 mb-4">
        <Grid3x3 className="h-5 w-5 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Generador de Asientos</h3>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
            <div>
                <Label htmlFor="rows" className="text-xs">Filas</Label>
                <Input 
                  id="rows" 
                  type="number" 
                  min="1" 
                  max="50"
                  value={rows} 
                  onChange={(e) => setRows(parseInt(e.target.value) || 0)} 
                  className="h-9" 
                />
            </div>
            <div>
                <Label htmlFor="cols" className="text-xs">Columnas</Label>
                <Input 
                  id="cols" 
                  type="number" 
                  min="1" 
                  max="100"
                  value={columns} 
                  onChange={(e) => setColumns(parseInt(e.target.value) || 0)} 
                  className="h-9" 
                />
            </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
            <div>
                <Label htmlFor="rspace" className="text-xs">Esp. Fila (px)</Label>
                <Input 
                  id="rspace" 
                  type="number"
                  min="10"
                  max="200" 
                  value={rowSpacing} 
                  onChange={(e) => setRowSpacing(parseInt(e.target.value) || 0)} 
                  className="h-9" 
                />
            </div>
            <div>
                <Label htmlFor="sspace" className="text-xs">Esp. Asiento (px)</Label>
                <Input 
                  id="sspace" 
                  type="number"
                  min="10"
                  max="200" 
                  value={seatSpacing} 
                  onChange={(e) => setSeatSpacing(parseInt(e.target.value) || 0)} 
                  className="h-9" 
                />
            </div>
        </div>

        <Separator />
        
        <div>
          <Label htmlFor="startRow" className="text-xs">Fila Inicial</Label>
          <Select value={startRow} onValueChange={setStartRow}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)).map(letter => (
                <SelectItem key={letter} value={letter}>{letter}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="seatShape" className="text-xs">Forma</Label>
          <Select value={seatShape} onValueChange={(v) => setSeatShape(v as SeatShape)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="circle">🔵 Círculo</SelectItem>
              <SelectItem value="square">🟦 Cuadrado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Zona selector */}
        {zones.length > 0 ? (
          <div>
            <Label htmlFor="seatZone" className="text-xs">Zona</Label>
            <Select value={selectedZoneId || "__none__"} onValueChange={(v) => setSelectedZoneId(v === "__none__" ? "" : v)}>
              <SelectTrigger className="h-9">
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
            💡 Primero crea zonas (rectángulos/polígonos) para asignar asientos a ellas
          </p>
        )}

        <div>
          <Label htmlFor="seatType" className="text-xs">Tipo de Asiento</Label>
          <Select value={seatType} onValueChange={(v) => setSeatType(v as SeatType)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="regular">🪑 Regular</SelectItem>
              <SelectItem value="vip">⭐ VIP</SelectItem>
              <SelectItem value="accessible">♿ Accesible</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleGenerate} className="w-full gap-2" size="lg">
          <Plus className="h-4 w-4" />
          Generar Asientos
        </Button>
      </div>
    </div>
  );
};