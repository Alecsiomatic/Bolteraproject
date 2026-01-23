import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useVenues } from "@/hooks/useVenues";
import { useVenueLayouts, useCreateLayout, useDuplicateLayout, useSetDefaultLayout, useDeleteLayout } from "@/hooks/useVenueLayouts";
import { Plus, Search, MapPin, Edit, Trash2, Map, RefreshCw, Layers, ChevronDown, ChevronUp, Copy, Star, StarOff } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

// Componente para el panel de layouts de un venue
function VenueLayoutsPanel({ venueId, venueName }: { venueId: string; venueName: string }) {
  const { data: layouts, isLoading } = useVenueLayouts(venueId);
  const createLayoutMutation = useCreateLayout(venueId);
  const duplicateLayoutMutation = useDuplicateLayout(venueId);
  const setDefaultMutation = useSetDefaultLayout(venueId);
  const deleteLayoutMutation = useDeleteLayout(venueId);
  
  const [newLayoutName, setNewLayoutName] = useState("");
  const [showNewLayoutDialog, setShowNewLayoutDialog] = useState(false);
  const [copyFromLayoutId, setCopyFromLayoutId] = useState<string | undefined>();

  const handleCreateLayout = async () => {
    try {
      await createLayoutMutation.mutateAsync({ 
        name: newLayoutName || `${venueName} - Nuevo Layout`,
        copyFromLayoutId 
      });
      toast.success("Layout creado exitosamente");
      setShowNewLayoutDialog(false);
      setNewLayoutName("");
      setCopyFromLayoutId(undefined);
    } catch (error: any) {
      toast.error(error?.message || "No se pudo crear el layout");
    }
  };

  const handleDuplicateLayout = async (layoutId: string, layoutName: string) => {
    try {
      await duplicateLayoutMutation.mutateAsync({ 
        layoutId, 
        newName: `${layoutName} (copia)` 
      });
      toast.success("Layout duplicado exitosamente");
    } catch (error: any) {
      toast.error(error?.message || "No se pudo duplicar el layout");
    }
  };

  const handleSetDefault = async (layoutId: string) => {
    try {
      await setDefaultMutation.mutateAsync(layoutId);
      toast.success("Layout establecido como predeterminado");
    } catch (error: any) {
      toast.error(error?.message || "No se pudo establecer como predeterminado");
    }
  };

  const handleDeleteLayout = async (layoutId: string, layoutName: string) => {
    if (!confirm(`¿Eliminar el layout "${layoutName}"?\n\nLos asientos asociados también serán eliminados.`)) {
      return;
    }
    try {
      await deleteLayoutMutation.mutateAsync(layoutId);
      toast.success("Layout eliminado");
    } catch (error: any) {
      console.error("Error deleting layout:", error);
      toast.error(error?.message || error?.error || "No se pudo eliminar el layout");
    }
  };

  if (isLoading) {
    return <div className="py-2 text-xs text-slate-500">Cargando layouts...</div>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
          Layouts ({layouts?.length || 0})
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-cyan-400 hover:text-cyan-300"
          onClick={() => setShowNewLayoutDialog(true)}
        >
          <Plus className="h-3 w-3 mr-1" />
          Nuevo
        </Button>
      </div>

      <div className="space-y-1.5">
        {layouts?.map((layout) => (
          <div
            key={layout.id}
            className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm"
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Layers className="h-3.5 w-3.5 text-slate-500 shrink-0" />
              <span className="truncate">{layout.name}</span>
              {layout.isDefault && (
                <span className="text-[10px] px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 rounded shrink-0">
                  Default
                </span>
              )}
              {layout.eventId && (
                <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded shrink-0" title="Este layout pertenece a un evento y no puede eliminarse desde aquí">
                  Evento
                </span>
              )}
              <span className="text-[10px] text-slate-500 shrink-0">
                {layout.seatCount} asientos
              </span>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <Link to={`/canvas?venueId=${venueId}&layoutId=${layout.id}`}>
                <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar layout">
                  <Edit className="h-3 w-3" />
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Duplicar layout"
                onClick={() => handleDuplicateLayout(layout.id, layout.name)}
                disabled={duplicateLayoutMutation.isPending}
              >
                <Copy className="h-3 w-3" />
              </Button>
              {!layout.isDefault && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-amber-400"
                  title="Establecer como default"
                  onClick={() => handleSetDefault(layout.id)}
                  disabled={setDefaultMutation.isPending}
                >
                  <Star className="h-3 w-3" />
                </Button>
              )}
              {!layout.eventId && (layouts?.length ?? 0) > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-rose-400 hover:text-rose-300 hover:bg-rose-500/20"
                  title="Eliminar layout"
                  onClick={() => handleDeleteLayout(layout.id, layout.name)}
                  disabled={deleteLayoutMutation.isPending}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Dialog para crear nuevo layout */}
      <Dialog open={showNewLayoutDialog} onOpenChange={setShowNewLayoutDialog}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Layout</DialogTitle>
            <DialogDescription className="text-slate-400">
              Crea un layout vacío o basado en uno existente
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre del layout</Label>
              <Input
                value={newLayoutName}
                onChange={(e) => setNewLayoutName(e.target.value)}
                placeholder={`${venueName} - Concierto`}
                className="border-white/20 bg-white/5"
              />
            </div>
            {layouts && layouts.length > 0 && (
              <div className="space-y-2">
                <Label>Copiar desde (opcional)</Label>
                <select
                  value={copyFromLayoutId || ""}
                  onChange={(e) => setCopyFromLayoutId(e.target.value || undefined)}
                  className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm"
                >
                  <option value="">Layout vacío</option>
                  {layouts.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.seatCount} asientos)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNewLayoutDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateLayout} disabled={createLayoutMutation.isPending}>
              {createLayoutMutation.isPending ? "Creando..." : "Crear Layout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const AdminVenues = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { data: venues, isLoading, isFetching, isError, refetch } = useVenues();

  const handleDelete = async (venueId: string, venueName: string) => {
    if (!confirm(`¿Estás seguro de eliminar "${venueName}"?\n\nEsto eliminará también todos los layouts, asientos, zonas y eventos asociados.`)) {
      return;
    }
    
    setDeletingId(venueId);
    try {
      const result = await api.deleteVenue(venueId);
      toast.success(result.message);
      refetch();
    } catch (error: any) {
      const message = error?.message || "No se pudo eliminar el venue";
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredVenues = useMemo(() => {
    if (!venues) return [];
    const term = searchTerm.toLowerCase();
    return venues.filter((venue) => {
      const haystack = `${venue.name} ${venue.address ?? ""} ${venue.city ?? ""}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [venues, searchTerm]);

  return (
    <div className="space-y-8 px-2 py-4 text-white lg:px-0">
      {/* Header */}
      <div className="flex flex-col gap-6 rounded-[32px] border border-white/10 bg-white/5 px-6 py-6 backdrop-blur-2xl md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-300">Venues</p>
          <h1 className="text-3xl font-semibold">Gestión de Venues</h1>
          <p className="text-slate-300">Administra espacios y mapas de asientos</p>
        </div>
        <div className="flex flex-col gap-3 md:flex-row">
          {isError && (
            <Button variant="outline" className="border-rose-400/40 text-rose-200" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Reintentar
            </Button>
          )}
          <Link to="/admin/venues/new">
            <Button className="px-6 py-5">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Venue
            </Button>
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <Input
          placeholder="Buscar venues por nombre o dirección..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="rounded-3xl border-white/10 bg-white/5 pl-12 text-white placeholder:text-slate-500"
        />
      </div>

      {/* Venues Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {(isLoading || !venues) && !isError && (
          <>
            {Array.from({ length: 3 }).map((_, index) => (
              <Card key={`skeleton-${index}`} className="border-white/10 bg-white/5">
                <CardHeader>
                  <div className="h-6 w-3/4 animate-pulse rounded-full bg-white/10" />
                  <div className="mt-2 h-4 w-1/2 animate-pulse rounded-full bg-white/5" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((__, line) => (
                      <div key={line} className="h-4 w-full animate-pulse rounded-full bg-white/5" />
                    ))}
                    <div className="mt-4 h-10 w-full animate-pulse rounded-2xl bg-white/10" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        )}

        {filteredVenues.map((venue) => {
          const hasLayout = Boolean(venue.defaultLayoutId);
          const totalSeats = venue.stats.totalSeats ?? venue.capacity ?? 0;
          const canvasHref = hasLayout
            ? `/canvas?venueId=${venue.id}&layoutId=${venue.defaultLayoutId}`
            : `/canvas?venueId=${venue.id}`;
          return (
          <Card key={venue.id} className={deletingId === venue.id ? "opacity-50" : ""}>
            <CardHeader>
              <CardTitle className="flex items-start justify-between text-white">
                <span className="flex-1">{venue.name}</span>
                <div className="flex gap-1">
                  <Link to={`/admin/venues/${venue.id}/edit`}>
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-2xl">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 rounded-2xl text-rose-400 hover:bg-rose-500/20 hover:text-rose-300"
                    onClick={() => handleDelete(venue.id, venue.name)}
                    disabled={deletingId === venue.id}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardTitle>
              <CardDescription className="flex items-center gap-2 text-slate-400">
                <MapPin className="h-3 w-3" />
                {[venue.address, venue.city].filter(Boolean).join(" · ") || "Sin dirección"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Capacidad</span>
                    <span className="font-semibold">{totalSeats} personas</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Eventos vinculados</span>
                    <span className="font-semibold">{venue.stats.events}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Mapa de asientos</span>
                    <span className={`font-semibold ${hasLayout ? "text-emerald-300" : "text-amber-300"}`}>
                      {hasLayout ? "Configurado" : "Pendiente"}
                    </span>
                  </div>
                </div>

                {/* Layouts Panel - Collapsible */}
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-between text-slate-300 hover:text-white">
                      <span className="flex items-center gap-2">
                        <Layers className="h-4 w-4" />
                        Ver Layouts
                      </span>
                      <ChevronDown className="h-4 w-4 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <VenueLayoutsPanel venueId={venue.id} venueName={venue.name} />
                  </CollapsibleContent>
                </Collapsible>

                <div className="flex gap-2">
                  {hasLayout ? (
                    <Link to={canvasHref} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full rounded-2xl border-white/20">
                        <Map className="mr-2 h-4 w-4" />
                        Ver Mapa
                      </Button>
                    </Link>
                  ) : (
                    <Link to={canvasHref} className="flex-1">
                      <Button size="sm" className="w-full">
                        <Plus className="mr-2 h-4 w-4" />
                        Crear Mapa
                      </Button>
                    </Link>
                  )}
                  <Button variant="outline" size="sm" className="flex-1 rounded-2xl border-white/20">
                    Detalles
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          );
        })}
      </div>

      {!isLoading && filteredVenues.length === 0 && (
        <div className="rounded-3xl border border-white/10 bg-white/5 py-12 text-center text-slate-400">
          <MapPin className="mx-auto mb-4 h-12 w-12 text-slate-500" />
          <p>No se encontraron venues</p>
        </div>
      )}

      {isFetching && !isLoading && (
        <p className="text-sm text-slate-400">Actualizando datos...</p>
      )}
    </div>
  );
};

export default AdminVenues;
