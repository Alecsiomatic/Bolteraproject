import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  Ticket,
  DollarSign,
  Plus,
  Edit,
  Trash2,
  Eye,
  Save,
  Loader2,
  Map,
  Armchair,
} from "lucide-react";

type EventDetail = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  venueId: string | null;
  venue: {
    id: string;
    name: string;
    slug: string;
    zones?: Array<{
      id: string;
      name: string;
      color: string;
      seatCount: number;
    }>;
  } | null;
  sessions: Array<{
    id: string;
    title: string | null;
    startsAt: string;
    endsAt: string | null;
    status: string;
    capacity: number | null;
    stats: {
      totalTickets: number;
      soldTickets: number;
    };
  }>;
  priceTiers: Array<{
    id: string;
    zoneId: string | null;
    zoneName: string | null;
    seatType: string | null;
    label: string;
    price: number;
    fee: number;
    currency: string;
  }>;
};

type ZonePriceConfig = {
  zoneId: string;
  zoneName: string;
  zoneColor: string;
  seatCount: number;
  price: string;
  fee: string;
  enabled: boolean;
};

const AdminEventDetail = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [zonePrices, setZonePrices] = useState<ZonePriceConfig[]>([]);
  const [savingPrices, setSavingPrices] = useState(false);
  const [showPriceDialog, setShowPriceDialog] = useState(false);
  
  // Session management state
  const [showSessionDialog, setShowSessionDialog] = useState(false);
  const [editingSession, setEditingSession] = useState<any>(null);
  const [sessionForm, setSessionForm] = useState({
    title: "",
    startsAt: "",
    endsAt: "",
    status: "SCHEDULED",
    capacity: "",
  });
  const [savingSession, setSavingSession] = useState(false);

  // Fetch event detail
  const { data: event, isLoading: eventLoading, refetch: refetchEvent } = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => api.getEvent(eventId!),
    enabled: Boolean(eventId),
  });

  // Initialize zone prices from venue zones (now included in event response)
  useMemo(() => {
    if (event?.venue?.zones && zonePrices.length === 0) {
      const initialPrices = event.venue.zones.map((zone: any) => {
        // Check if there's an existing price tier for this zone
        const existingTier = event?.priceTiers?.find((t: any) => t.zoneId === zone.id);
        return {
          zoneId: zone.id,
          zoneName: zone.name,
          zoneColor: zone.color ?? "#64748b",
          seatCount: zone.seatCount ?? 0,
          price: existingTier?.price?.toString() ?? "0",
          fee: existingTier?.fee?.toString() ?? "0",
          enabled: Boolean(existingTier) || true,
        };
      });
      setZonePrices(initialPrices);
    }
  }, [event, zonePrices.length]);

  const updateZonePrice = (zoneId: string, field: keyof ZonePriceConfig, value: string | boolean) => {
    setZonePrices((current) =>
      current.map((zp) => (zp.zoneId === zoneId ? { ...zp, [field]: value } : zp))
    );
  };

  const handleSavePrices = async () => {
    if (!eventId) return;

    try {
      setSavingPrices(true);
      const enabledZones = zonePrices.filter((zp) => zp.enabled && Number(zp.price) > 0);
      
      await api.updateEventPriceTiers(eventId, {
        tiers: enabledZones.map((zp) => ({
          zoneId: zp.zoneId,
          label: zp.zoneName,
          price: Number(zp.price),
          fee: Number(zp.fee) || 0,
          currency: "MXN",
        })),
      });

      toast({ title: "Precios guardados", description: "Los precios por zona se actualizaron correctamente" });
      queryClient.invalidateQueries({ queryKey: ["event", eventId] });
      setShowPriceDialog(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudieron guardar los precios";
      toast({ variant: "destructive", title: "Error", description: message });
    } finally {
      setSavingPrices(false);
    }
  };

  // Session management functions
  const openNewSessionDialog = () => {
    setEditingSession(null);
    setSessionForm({
      title: "",
      startsAt: "",
      endsAt: "",
      status: "SCHEDULED",
      capacity: "",
    });
    setShowSessionDialog(true);
  };

  const openEditSessionDialog = (session: any) => {
    setEditingSession(session);
    // Format dates for datetime-local input
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toISOString().slice(0, 16);
    };
    setSessionForm({
      title: session.title || "",
      startsAt: formatDate(session.startsAt),
      endsAt: session.endsAt ? formatDate(session.endsAt) : "",
      status: session.status,
      capacity: session.capacity?.toString() || "",
    });
    setShowSessionDialog(true);
  };

  const handleSaveSession = async () => {
    if (!eventId || !sessionForm.startsAt) return;

    try {
      setSavingSession(true);
      
      const payload = {
        title: sessionForm.title || undefined,
        startsAt: new Date(sessionForm.startsAt).toISOString(),
        endsAt: sessionForm.endsAt ? new Date(sessionForm.endsAt).toISOString() : undefined,
        status: sessionForm.status,
        capacity: sessionForm.capacity ? Number(sessionForm.capacity) : undefined,
      };

      if (editingSession) {
        await api.updateSession(eventId, editingSession.id, payload);
        toast({ title: "Sesión actualizada", description: "Los cambios se guardaron correctamente" });
      } else {
        await api.createSession(eventId, payload);
        toast({ title: "Sesión creada", description: "La nueva sesión fue agregada al evento" });
      }

      refetchEvent();
      setShowSessionDialog(false);
    } catch (error: any) {
      const message = error?.message || "No se pudo guardar la sesión";
      toast({ variant: "destructive", title: "Error", description: message });
    } finally {
      setSavingSession(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!eventId) return;
    if (!confirm("¿Estás seguro de eliminar esta sesión?")) return;

    try {
      await api.deleteSession(eventId, sessionId);
      toast({ title: "Sesión eliminada" });
      refetchEvent();
    } catch (error: any) {
      const message = error?.message || "No se pudo eliminar la sesión";
      toast({ variant: "destructive", title: "Error", description: message });
    }
  };

  const totalCapacity = useMemo(() => {
    return zonePrices.reduce((sum, zp) => sum + zp.seatCount, 0);
  }, [zonePrices]);

  const totalRevenuePotential = useMemo(() => {
    return zonePrices
      .filter((zp) => zp.enabled)
      .reduce((sum, zp) => sum + zp.seatCount * Number(zp.price), 0);
  }, [zonePrices]);

  if (eventLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="py-12 text-center">
        <p className="text-slate-400">Evento no encontrado</p>
        <Link to="/admin/events">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a eventos
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-2 py-4 text-white lg:px-0">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-[32px] border border-white/10 bg-white/5 px-6 py-6 backdrop-blur-2xl md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin/events">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">{event.name}</h1>
              <Badge
                variant={event.status === "PUBLISHED" ? "default" : "secondary"}
                className={event.status === "PUBLISHED" ? "bg-emerald-500/20 text-emerald-300" : ""}
              >
                {event.status === "PUBLISHED" ? "Publicado" : "Borrador"}
              </Badge>
            </div>
            {event.venue && (
              <p className="mt-1 flex items-center gap-2 text-sm text-slate-400">
                <MapPin className="h-3 w-3" />
                {event.venue.name}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {event.venueId && (
            <>
              <Link to={`/canvas?venueId=${event.venueId}`}>
                <Button variant="outline" className="border-white/20">
                  <Map className="mr-2 h-4 w-4" />
                  Ver Venue
                </Button>
              </Link>
              <Link to={`/canvas?eventId=${eventId}`}>
                <Button variant="outline" className="border-cyan-400/30 bg-gradient-to-br from-cyan-500/20 via-cyan-400/15 to-cyan-500/10 text-cyan-300 shadow-[0_8px_32px_rgba(6,182,212,0.15),inset_0_1px_1px_rgba(255,255,255,0.1)] backdrop-blur-xl">
                  <Map className="mr-2 h-4 w-4" />
                  Editar Layout
                </Button>
              </Link>
            </>
          )}
          <Link to={`/admin/events/${eventId}/edit`}>
            <Button>
              <Edit className="mr-2 h-4 w-4" />
              Editar Evento
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-white/10 bg-white/5">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-xl bg-cyan-500/20 p-3">
              <Calendar className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Sesiones</p>
              <p className="text-2xl font-semibold">{event.sessions?.length ?? 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-xl bg-violet-500/20 p-3">
              <Armchair className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Capacidad</p>
              <p className="text-2xl font-semibold">{totalCapacity}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-xl bg-emerald-500/20 p-3">
              <Ticket className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Zonas</p>
              <p className="text-2xl font-semibold">{zonePrices.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-xl bg-amber-500/20 p-3">
              <DollarSign className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Ingreso Potencial</p>
              <p className="text-2xl font-semibold">
                ${totalRevenuePotential.toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white/5">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="zones">Zonas y Precios</TabsTrigger>
          <TabsTrigger value="sessions">Sesiones</TabsTrigger>
          <TabsTrigger value="tickets">Boletos</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Event Info */}
            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle className="text-lg">Información del Evento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-slate-400">Descripción</Label>
                  <p className="mt-1">{event.description || "Sin descripción"}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-400">Estado</Label>
                    <p className="mt-1 font-medium">{event.status}</p>
                  </div>
                  <div>
                    <Label className="text-slate-400">Slug</Label>
                    <p className="mt-1 font-mono text-sm">{event.slug}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Venue Info */}
            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle className="text-lg">Venue Asociado</CardTitle>
              </CardHeader>
              <CardContent>
                {event.venue ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-blue-500/20 p-3">
                        <MapPin className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="font-semibold">{event.venue.name}</p>
                        <p className="text-sm text-slate-400">/{event.venue.slug}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link to={`/canvas?venueId=${event.venue.id}`}>
                        <Button variant="outline" size="sm" className="border-white/20">
                          <Eye className="mr-2 h-4 w-4" />
                          Ver Mapa
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-400">No hay venue asociado</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="zones" className="mt-6">
          <Card className="border-white/10 bg-white/5">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Configuración de Precios por Zona</CardTitle>
                <CardDescription>
                  Define el precio de cada zona del venue para este evento
                </CardDescription>
              </div>
              <Button onClick={handleSavePrices} disabled={savingPrices}>
                {savingPrices ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Guardar Precios
              </Button>
            </CardHeader>
            <CardContent>
              {eventLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
                </div>
              ) : zonePrices.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  <Armchair className="mx-auto mb-4 h-12 w-12 text-slate-500" />
                  <p>El venue no tiene zonas configuradas</p>
                  <p className="mt-2 text-sm">
                    Ve al editor de mapas y crea zonas para poder configurar precios
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Header */}
                  <div className="grid grid-cols-12 gap-4 border-b border-white/10 pb-2 text-sm font-medium text-slate-400">
                    <div className="col-span-4">Zona</div>
                    <div className="col-span-2 text-center">Asientos</div>
                    <div className="col-span-2">Precio</div>
                    <div className="col-span-2">Cargo</div>
                    <div className="col-span-2 text-right">Total</div>
                  </div>

                  {/* Zone rows */}
                  {zonePrices.map((zp) => (
                    <div
                      key={zp.zoneId}
                      className={`grid grid-cols-12 items-center gap-4 rounded-lg p-3 transition-colors ${
                        zp.enabled ? "bg-white/5" : "bg-white/[0.02] opacity-50"
                      }`}
                    >
                      <div className="col-span-4 flex items-center gap-3">
                        <div
                          className="h-4 w-4 rounded-full"
                          style={{ backgroundColor: zp.zoneColor }}
                        />
                        <span className="font-medium">{zp.zoneName}</span>
                      </div>
                      <div className="col-span-2 text-center">
                        <Badge variant="secondary">{zp.seatCount} asientos</Badge>
                      </div>
                      <div className="col-span-2">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                            $
                          </span>
                          <Input
                            type="number"
                            value={zp.price}
                            onChange={(e) => updateZonePrice(zp.zoneId, "price", e.target.value)}
                            className="pl-7"
                            min="0"
                          />
                        </div>
                      </div>
                      <div className="col-span-2">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                            $
                          </span>
                          <Input
                            type="number"
                            value={zp.fee}
                            onChange={(e) => updateZonePrice(zp.zoneId, "fee", e.target.value)}
                            className="pl-7"
                            min="0"
                          />
                        </div>
                      </div>
                      <div className="col-span-2 text-right font-semibold">
                        ${(zp.seatCount * Number(zp.price)).toLocaleString()}
                      </div>
                    </div>
                  ))}

                  {/* Total */}
                  <div className="mt-4 flex justify-between border-t border-white/10 pt-4">
                    <span className="text-lg font-medium">Ingreso Potencial Total</span>
                    <span className="text-2xl font-bold text-emerald-400">
                      ${totalRevenuePotential.toLocaleString()} MXN
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" className="mt-6">
          <Card className="border-white/10 bg-white/5">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Sesiones / Funciones</CardTitle>
                <CardDescription>Fechas y horarios del evento</CardDescription>
              </div>
              <Button onClick={openNewSessionDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva Sesión
              </Button>
            </CardHeader>
            <CardContent>
              {event.sessions?.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  <Calendar className="mx-auto mb-4 h-12 w-12 text-slate-500" />
                  <p>No hay sesiones configuradas</p>
                  <Button variant="outline" className="mt-4" onClick={openNewSessionDialog}>
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar primera sesión
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {event.sessions?.map((session: any) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between rounded-lg bg-white/5 p-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className="rounded-lg bg-cyan-500/20 p-2">
                          <Calendar className="h-4 w-4 text-cyan-400" />
                        </div>
                        <div>
                          <p className="font-medium">{session.title || "Sin título"}</p>
                          <p className="text-sm text-slate-400">
                            {new Date(session.startsAt).toLocaleDateString("es-MX", {
                              weekday: "long",
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge
                          variant={session.status === "SALES_OPEN" ? "default" : "secondary"}
                          className={
                            session.status === "SALES_OPEN"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : session.status === "CANCELLED"
                              ? "bg-red-500/20 text-red-300"
                              : ""
                          }
                        >
                          {session.status === "SALES_OPEN" ? "En venta" : 
                           session.status === "SCHEDULED" ? "Programada" :
                           session.status === "SOLD_OUT" ? "Agotada" :
                           session.status === "CANCELLED" ? "Cancelada" : session.status}
                        </Badge>
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {session.stats?.soldTickets ?? 0}/{session.stats?.totalTickets ?? session.capacity ?? 0}
                          </p>
                          <p className="text-xs text-slate-400">vendidos</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => openEditSessionDialog(session)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-red-400 hover:text-red-300"
                          onClick={() => handleDeleteSession(session.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tickets" className="mt-6">
          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-lg">Boletos Vendidos</CardTitle>
              <CardDescription>Historial de ventas por sesión</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="py-8 text-center text-slate-400">
                <Ticket className="mx-auto mb-4 h-12 w-12 text-slate-500" />
                <p>Los boletos vendidos aparecerán aquí</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Session Dialog */}
      <Dialog open={showSessionDialog} onOpenChange={setShowSessionDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingSession ? "Editar Sesión" : "Nueva Sesión"}
            </DialogTitle>
            <DialogDescription>
              {editingSession 
                ? "Modifica los datos de la sesión" 
                : "Agrega una nueva fecha/horario para el evento"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Título (opcional)</Label>
              <Input
                value={sessionForm.title}
                onChange={(e) => setSessionForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ej: Función de estreno, Matinée, etc."
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha y hora de inicio *</Label>
                <Input
                  type="datetime-local"
                  value={sessionForm.startsAt}
                  onChange={(e) => setSessionForm(prev => ({ ...prev, startsAt: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha y hora de fin</Label>
                <Input
                  type="datetime-local"
                  value={sessionForm.endsAt}
                  onChange={(e) => setSessionForm(prev => ({ ...prev, endsAt: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select 
                  value={sessionForm.status} 
                  onValueChange={(value) => setSessionForm(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SCHEDULED">Programada</SelectItem>
                    <SelectItem value="SALES_OPEN">En venta</SelectItem>
                    <SelectItem value="SOLD_OUT">Agotada</SelectItem>
                    <SelectItem value="CANCELLED">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Capacidad</Label>
                <Input
                  type="number"
                  value={sessionForm.capacity}
                  onChange={(e) => setSessionForm(prev => ({ ...prev, capacity: e.target.value }))}
                  placeholder="Heredar del venue"
                  min="1"
                />
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSessionDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveSession} 
              disabled={savingSession || !sessionForm.startsAt}
            >
              {savingSession && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingSession ? "Guardar cambios" : "Crear sesión"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminEventDetail;
