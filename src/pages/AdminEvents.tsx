import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useEvents } from "@/hooks/useEvents";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Search, Calendar, MapPin, Edit, Trash2, RefreshCw, Loader2 } from "lucide-react";

const AdminEvents = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { data: events, isLoading, isFetching, isError, refetch } = useEvents({ all: true });

  const handleDeleteEvent = async (eventId: string, eventName: string) => {
    if (!window.confirm(`¿Estás seguro de eliminar "${eventName}"?\n\nEsto eliminará todas las sesiones, precios y boletos asociados.`)) {
      return;
    }
    
    setDeletingId(eventId);
    try {
      await api.deleteEvent(eventId);
      toast.success(`Evento "${eventName}" eliminado`);
      refetch();
    } catch (error: any) {
      console.error("Error deleting event:", error);
      toast.error(error.message || "Error al eliminar el evento");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    const term = searchTerm.toLowerCase();
    return events.filter((event) => {
      const venueName = event.venue?.name ?? "";
      const haystack = `${event.name} ${venueName}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [events, searchTerm]);

  return (
    <div className="space-y-8 px-2 py-4 text-white lg:px-0">
      {/* Header */}
      <div className="flex flex-col gap-6 rounded-[32px] border border-white/10 bg-white/5 px-6 py-6 backdrop-blur-2xl md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-300">Eventos</p>
          <h1 className="text-3xl font-semibold">Gestión de Eventos</h1>
          <p className="text-slate-300">Administra sesiones, ocupación y mapas.</p>
        </div>
        <div className="flex flex-col gap-3 md:flex-row">
          {isError && (
            <Button variant="outline" className="border-rose-400/40 text-rose-200" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Reintentar
            </Button>
          )}
          <Link to="/admin/events/new">
            <Button className="px-6 py-5">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Evento
            </Button>
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <Input
          placeholder="Buscar eventos por nombre o venue..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="rounded-3xl border-white/10 bg-white/5 pl-12 text-white placeholder:text-slate-500"
        />
      </div>

      {/* Events Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {(isLoading || !events) && !isError && (
          <>
            {Array.from({ length: 3 }).map((_, index) => (
              <Card key={`event-skeleton-${index}`} className="border-white/10 bg-white/5">
                <CardHeader>
                  <div className="h-6 w-4/5 animate-pulse rounded-full bg-white/10" />
                  <div className="mt-2 h-4 w-1/3 animate-pulse rounded-full bg-white/5" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((__, line) => (
                      <div key={line} className="h-4 w-full animate-pulse rounded-full bg-white/5" />
                    ))}
                    <div className="h-10 w-full animate-pulse rounded-2xl bg-white/10" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        )}

        {filteredEvents.map((event) => {
          const progress = event.stats.progress ?? 0;
          const venueName = event.venue?.name ?? "Sin venue";
          const nextSession = event.firstSession
            ? new Date(event.firstSession).toLocaleDateString("es-ES", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })
            : "Sin fecha";
          return (
          <Card key={event.id} className="border-white/15">
            <CardHeader>
              <CardTitle className="flex items-start justify-between text-white">
                <span className="flex-1">{event.name}</span>
                <div className="flex gap-1">
                  <Link to={`/admin/events/${event.id}/edit`}>
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-2xl" title="Editar evento">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 rounded-2xl text-rose-400 hover:bg-rose-500/20 hover:text-rose-300"
                    title="Eliminar evento"
                    disabled={deletingId === event.id}
                    onClick={() => handleDeleteEvent(event.id, event.name)}
                  >
                    {deletingId === event.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardTitle>
              <CardDescription className="flex items-center gap-2 text-slate-400">
                <MapPin className="h-3 w-3" />
                {venueName}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Calendar className="h-4 w-4" />
                  {nextSession}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Sesiones</span>
                    <span className="font-semibold">{event.stats.sessions}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Boletos vendidos</span>
                    <span className="font-semibold">{event.stats.soldTickets}/{event.stats.totalTickets}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500 transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="text-right text-xs text-slate-400">
                    {progress}% ocupado
                  </div>
                </div>

                <div className="flex gap-2">
                  <Link to={`/admin/events/${event.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full rounded-2xl border-white/20">
                      Ver Detalles
                    </Button>
                  </Link>
                  <Link to={`/admin/events/${event.id}?tab=sessions`} className="flex-1">
                    <Button size="sm" className="w-full">
                      Sesiones
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
          );
        })}
      </div>

      {!isLoading && filteredEvents.length === 0 && (
        <div className="rounded-3xl border border-white/10 bg-white/5 py-12 text-center text-slate-400">
          <Calendar className="mx-auto mb-4 h-12 w-12 text-slate-500" />
          <p>No se encontraron eventos</p>
        </div>
      )}

      {isFetching && !isLoading && (
        <p className="text-sm text-slate-400">Actualizando datos...</p>
      )}
    </div>
  );
};

export default AdminEvents;
