import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import { CheckCircle2, Clock, DollarSign, Ban, Search, Info } from "lucide-react";
import { SeatStatus } from "@/types/canvas";
import { useState } from "react";

interface SeatStatistics {
  total: number;
  available: number;
  reserved: number;
  sold: number;
  blocked: number;
  selected: number;
}

interface SeatStatusManagerProps {
  statistics: SeatStatistics | null;
  onChangeStatus: (status: SeatStatus) => void;
  onSearchSeat: (seatName: string) => void;
}

export const SeatStatusManager = ({ statistics, onChangeStatus, onSearchSeat }: SeatStatusManagerProps) => {
  const [searchQuery, setSearchQuery] = useState("");

  const statusOptions: { status: SeatStatus; label: string; icon: any; color: string }[] = [
    { status: "available", label: "Disponible", icon: CheckCircle2, color: "bg-emerald-400" },
    { status: "reserved", label: "Reservado", icon: Clock, color: "bg-amber-300" },
    { status: "sold", label: "Vendido", icon: DollarSign, color: "bg-rose-400" },
    { status: "blocked", label: "Bloqueado", icon: Ban, color: "bg-slate-500" },
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearchSeat(searchQuery.trim());
    }
  };

  return (
    <div className="w-[280px] rounded-[24px] border border-white/10 bg-white/5 p-5 text-white shadow-[0_20px_60px_rgba(2,6,23,0.65)] backdrop-blur-2xl">
      <div className="mb-4 flex items-center gap-2">
        <Info className="h-5 w-5 text-cyan-300" />
        <h3 className="text-sm font-semibold">Estado de Asientos</h3>
      </div>

      {/* Estadísticas */}
      {statistics && (
        <div className="mb-4 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Total:</span>
            <Badge className="border border-white/10 bg-white/5">{statistics.total}</Badge>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-emerald-200">
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
              Disponibles
            </span>
            <Badge className="border border-white/10 bg-white/5">{statistics.available}</Badge>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-amber-200">
              <div className="h-2 w-2 rounded-full bg-amber-300" />
              Reservados
            </span>
            <Badge className="border border-white/10 bg-white/5">{statistics.reserved}</Badge>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-rose-200">
              <div className="h-2 w-2 rounded-full bg-rose-400" />
              Vendidos
            </span>
            <Badge className="border border-white/10 bg-white/5">{statistics.sold}</Badge>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-slate-300">
              <div className="h-2 w-2 rounded-full bg-slate-500" />
              Bloqueados
            </span>
            <Badge className="border border-white/10 bg-white/5">{statistics.blocked}</Badge>
          </div>
        </div>
      )}

      <Separator className="my-4" />

      {/* Búsqueda de asiento */}
      <form onSubmit={handleSearch} className="mb-4">
        <Label htmlFor="search" className="mb-2 block text-xs text-slate-300">
          Buscar Asiento
        </Label>
        <div className="flex gap-2">
          <Input
            id="search"
            placeholder="Ej: A1, B15"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-11 flex-1"
          />
          <Button type="submit" size="sm" variant="secondary" className="h-11 w-11 rounded-2xl p-0">
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </form>

      <Separator className="my-4" />

      {/* Cambiar estado */}
      <div>
        <Label className="mb-3 block text-xs text-slate-300">Cambiar Estado (Seleccionados)</Label>
        <ScrollArea className="h-[180px]">
          <div className="space-y-2">
            {statusOptions.map(({ status, label, icon: Icon, color }) => (
              <Button
                key={status}
                variant="outline"
                size="sm"
                onClick={() => onChangeStatus(status)}
                className="h-10 w-full justify-start gap-3 rounded-2xl border-white/20"
              >
                <div className={`h-3 w-3 rounded-full ${color}`} />
                <Icon className="h-4 w-4" />
                <span className="text-xs">{label}</span>
              </Button>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
