import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { api } from "@/lib/api";
import { toast } from "sonner";

type TableShape = "rectangle" | "circle" | "oval";

interface TableGeneratorModalProps {
  open: boolean;
  onClose: () => void;
  venueId: string;
  zones: Array<{ id: string; name: string; color: string }>;
  canvasCenter: { x: number; y: number };
  onTableCreated: () => void;
}

export function TableGeneratorModal({
  open,
  onClose,
  venueId,
  zones,
  canvasCenter,
  onTableCreated,
}: TableGeneratorModalProps) {
  const [name, setName] = useState("Mesa");
  const [shape, setShape] = useState<TableShape>("circle");
  const [seatCount, setSeatCount] = useState(4);
  const [zoneId, setZoneId] = useState(zones[0]?.id ?? "");
  const [width, setWidth] = useState(120);
  const [height, setHeight] = useState(80);
  const [radius, setRadius] = useState(50);
  const [startNumber, setStartNumber] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!name.trim()) {
      toast.error("El nombre de la mesa es requerido");
      return;
    }

    if (!zoneId) {
      toast.error("Selecciona una zona");
      return;
    }

    setIsGenerating(true);

    try {
      const config = {
        name: name.trim(),
        shape,
        seatCount,
        zoneId,
        centerX: canvasCenter.x,
        centerY: canvasCenter.y,
        startNumber,
        ...(shape === "rectangle" && { width, height }),
        ...(shape !== "rectangle" && { radius }),
      };

      await api.generateTable(venueId, config);

      toast.success(`Mesa "${name}" generada con ${seatCount} asientos`);
      onTableCreated();
      onClose();
      resetForm();
    } catch (error) {
      console.error("Error generating table:", error);
      toast.error("Error al generar la mesa");
    } finally {
      setIsGenerating(false);
    }
  };

  const resetForm = () => {
    setName("Mesa");
    setShape("circle");
    setSeatCount(4);
    setWidth(120);
    setHeight(80);
    setRadius(50);
    setStartNumber(1);
  };

  const handleClose = () => {
    if (!isGenerating) {
      resetForm();
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Generar Mesa con Asientos</DialogTitle>
          <DialogDescription>
            Configura la forma, número de asientos y distribución de la nueva mesa.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Name */}
          <div className="grid gap-2">
            <Label htmlFor="table-name">Nombre de la Mesa</Label>
            <Input
              id="table-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Mesa A1"
            />
          </div>

          {/* Zone */}
          <div className="grid gap-2">
            <Label htmlFor="zone-select">Zona</Label>
            <Select value={zoneId} onValueChange={setZoneId}>
              <SelectTrigger id="zone-select">
                <SelectValue placeholder="Selecciona zona" />
              </SelectTrigger>
              <SelectContent>
                {zones.map((zone) => (
                  <SelectItem key={zone.id} value={zone.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: zone.color }}
                      />
                      {zone.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Shape */}
          <div className="grid gap-2">
            <Label htmlFor="shape-select">Forma</Label>
            <Select value={shape} onValueChange={(v) => setShape(v as TableShape)}>
              <SelectTrigger id="shape-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="circle">Círculo</SelectItem>
                <SelectItem value="oval">Óvalo</SelectItem>
                <SelectItem value="rectangle">Rectángulo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Seat Count */}
          <div className="grid gap-2">
            <Label htmlFor="seat-count">
              Número de Asientos: <span className="font-bold">{seatCount}</span>
            </Label>
            <Slider
              id="seat-count"
              min={2}
              max={20}
              step={1}
              value={[seatCount]}
              onValueChange={(vals) => setSeatCount(vals[0])}
            />
            <p className="text-xs text-muted-foreground">Entre 2 y 20 asientos</p>
          </div>

          {/* Shape-specific dimensions */}
          {shape === "rectangle" && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="table-width">Ancho (px)</Label>
                <Input
                  id="table-width"
                  type="number"
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                  min={60}
                  max={300}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="table-height">Alto (px)</Label>
                <Input
                  id="table-height"
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                  min={40}
                  max={200}
                />
              </div>
            </>
          )}

          {(shape === "circle" || shape === "oval") && (
            <div className="grid gap-2">
              <Label htmlFor="table-radius">Radio (px)</Label>
              <Input
                id="table-radius"
                type="number"
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                min={30}
                max={150}
              />
            </div>
          )}

          {/* Start Number */}
          <div className="grid gap-2">
            <Label htmlFor="start-number">Número Inicial</Label>
            <Input
              id="start-number"
              type="number"
              value={startNumber}
              onChange={(e) => setStartNumber(Number(e.target.value))}
              min={1}
            />
            <p className="text-xs text-muted-foreground">
              Asientos numerados: {name}-{startNumber} a {name}-{startNumber + seatCount - 1}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isGenerating}>
            Cancelar
          </Button>
          <Button onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? "Generando..." : "Generar Mesa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
