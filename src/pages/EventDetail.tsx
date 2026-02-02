import { useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import PublicNavbar from "@/components/PublicNavbar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  MapPin,
  Ticket,
  Loader2,
  ArrowLeft,
  Clock,
  Users,
  ShoppingCart,
  Info,
  CalendarPlus,
  Download,
  Music,
  ListMusic,
  UserCircle,
  ChevronRight,
  Play,
  Heart,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/api-base";
import { normalizeImageUrl } from "@/lib/utils/imageUrl";

type Session = {
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
};

type Zone = {
  id: string;
  name: string;
  color: string;
  seatCount: number;
};

type PriceTier = {
  id: string;
  zoneId: string | null;
  zoneName: string | null;
  zoneColor: string | null;
  sectionId: string | null;
  sectionName: string | null;
  label: string;
  price: number;
  fee: number;
  currency: string;
};

const EventDetail = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, token } = useAuth();
  const [selectedSession, setSelectedSession] = useState<string>("");

  const { data: event, isLoading } = useQuery({
    queryKey: ["public-event", eventId],
    queryFn: () => api.getEvent(eventId!),
    enabled: Boolean(eventId),
  });

  // Check if event is in favorites
  const { data: favoritesData } = useQuery({
    queryKey: ["user-favorites"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/users/me/favorites`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { favorites: [] };
      return res.json();
    },
    enabled: !!token,
  });

  const isFavorite = useMemo(() => {
    return favoritesData?.favorites?.some((f: any) => f.eventId === eventId) ?? false;
  }, [favoritesData, eventId]);

  // Add to favorites mutation
  const addFavoriteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/users/me/favorites/${eventId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Error al agregar a favoritos");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-favorites"] });
      toast.success("Agregado a favoritos");
    },
    onError: () => {
      toast.error("Error al agregar a favoritos");
    },
  });

  // Remove from favorites mutation
  const removeFavoriteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/users/me/favorites/${eventId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Error al eliminar de favoritos");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-favorites"] });
      toast.success("Eliminado de favoritos");
    },
    onError: () => {
      toast.error("Error al eliminar de favoritos");
    },
  });

  const handleToggleFavorite = () => {
    if (!user) {
      navigate("/login", { state: { from: `/events/${eventId}` } });
      return;
    }
    if (isFavorite) {
      removeFavoriteMutation.mutate();
    } else {
      addFavoriteMutation.mutate();
    }
  };

  // Get available sessions (not cancelled, with capacity)
  const availableSessions = useMemo(() => {
    return (event?.sessions ?? []).filter(
      (s: Session) => s.status !== "CANCELLED" && s.status !== "SOLD_OUT"
    );
  }, [event?.sessions]);

  // Auto-select first session if none selected
  useMemo(() => {
    if (availableSessions.length > 0 && !selectedSession) {
      setSelectedSession(availableSessions[0].id);
    }
  }, [availableSessions, selectedSession]);

  // Get prices grouped by zone/section/label - showing all price tiers
  const pricesByZone = useMemo(() => {
    const tiers = event?.priceTiers ?? [];
    
    // Group tiers by a unique key (zoneId, sectionId, or label)
    const uniquePrices = new Map<string, {
      id: string;
      name: string;
      color: string;
      price: number;
      fee: number;
      currency: string;
    }>();

    tiers.forEach((tier: PriceTier) => {
      // Determine the name and key for this tier
      const key = tier.zoneId || tier.sectionId || tier.label || tier.id;
      const name = tier.zoneName || tier.sectionName || tier.label || "General";
      const color = tier.zoneColor || "#64748b";
      
      // Only add if we don't have this price tier yet, or if this one has a lower price
      if (!uniquePrices.has(key) || uniquePrices.get(key)!.price > tier.price) {
        uniquePrices.set(key, {
          id: key,
          name,
          color,
          price: tier.price,
          fee: tier.fee ?? 0,
          currency: tier.currency ?? "MXN",
        });
      }
    });

    // Convert to array and filter out zero prices
    return Array.from(uniquePrices.values())
      .filter((z) => z.price > 0)
      .sort((a, b) => b.price - a.price); // Sort by price descending (VIP first)
  }, [event]);

  const minPrice = useMemo(() => {
    const tiers = event?.priceTiers ?? [];
    if (tiers.length === 0) return 0;
    const prices = tiers.map((t: PriceTier) => t.price).filter((p) => p > 0);
    return prices.length > 0 ? Math.min(...prices) : 0;
  }, [event]);

  const maxPrice = useMemo(() => {
    const tiers = event?.priceTiers ?? [];
    if (tiers.length === 0) return 0;
    const prices = tiers.map((t: PriceTier) => t.price).filter((p) => p > 0);
    return prices.length > 0 ? Math.max(...prices) : 0;
  }, [event]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleBuyTickets = () => {
    if (!selectedSession) return;
    navigate(`/events/${eventId}/purchase?session=${selectedSession}`);
  };

  // Calendar functions
  const getSelectedSessionData = () => {
    return availableSessions.find((s: Session) => s.id === selectedSession);
  };

  const formatCalendarDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const generateGoogleCalendarUrl = () => {
    const session = getSelectedSessionData();
    if (!session) return '';

    const startDate = new Date(session.startsAt);
    const endDate = session.endsAt ? new Date(session.endsAt) : new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
    
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: event?.name || 'Evento',
      dates: `${formatCalendarDate(startDate)}/${formatCalendarDate(endDate)}`,
      details: `${event?.description || ''}\n\nComprado en Boletera`,
      location: event?.venue?.name || '',
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  const generateICalFile = () => {
    const session = getSelectedSessionData();
    if (!session) return;

    const startDate = new Date(session.startsAt);
    const endDate = session.endsAt ? new Date(session.endsAt) : new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
    
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Boletera//Event//ES',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `DTSTART:${formatCalendarDate(startDate)}`,
      `DTEND:${formatCalendarDate(endDate)}`,
      `SUMMARY:${event?.name || 'Evento'}`,
      `DESCRIPTION:${(event?.description || '').replace(/\n/g, '\\n')}`,
      `LOCATION:${event?.venue?.name || ''}`,
      `UID:${session.id}@boletera.com`,
      `DTSTAMP:${formatCalendarDate(new Date())}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(event?.name || 'evento').toLowerCase().replace(/\s+/g, '-')}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleAddToGoogleCalendar = () => {
    const url = generateGoogleCalendarUrl();
    if (url) {
      window.open(url, '_blank');
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#050505] via-[#0a0a0a] to-[#050505]">
        <Loader2 className="h-8 w-8 animate-spin text-gold-400" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#050505] via-[#0a0a0a] to-[#050505]">
        <Ticket className="mb-4 h-16 w-16 text-slate-600" />
        <h2 className="text-xl font-semibold text-white">Evento no encontrado</h2>
        <Link to="/events" className="mt-4">
          <Button variant="outline">Ver otros eventos</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#050505] via-[#0a0a0a] to-[#050505]">
      {/* Navbar consistente */}
      <PublicNavbar />

      {/* Hero Banner - Full image display with no cropping */}
      <div className="relative h-[45vh] sm:h-[50vh] md:h-[55vh] lg:h-[60vh] min-h-[280px] overflow-hidden bg-[#050505]">
        {(event.coverImage || event.thumbnailImage) ? (
          <>
            {/* Background blur for letterbox effect */}
            <div 
              className="absolute inset-0 scale-110 blur-2xl opacity-40"
              style={{ 
                backgroundImage: `url(${normalizeImageUrl(event.coverImage || event.thumbnailImage)})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
            />
            {/* Main image - full visible, no cropping */}
            <img 
              src={normalizeImageUrl(event.coverImage || event.thumbnailImage) || ''} 
              alt={event.name}
              className="absolute inset-0 h-full w-full object-contain"
            />
            {/* Very subtle gradient only at bottom edge for smooth transition */}
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#050505] to-transparent" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-gold-500/20 to-amber-500/20" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Ticket className="h-24 w-24 sm:h-32 sm:w-32 md:h-40 md:w-40 text-white/10" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] to-transparent" />
          </>
        )}
        
        {/* Featured badge with glass effect */}
        {event.isFeatured && (
          <Badge className="absolute left-4 sm:left-6 top-20 sm:top-24 bg-amber-500/80 backdrop-blur-md text-white border-0 text-sm sm:text-base px-4 py-2 shadow-lg shadow-amber-500/20">
            ⭐ Destacado
          </Badge>
        )}

        {/* Favorite button with glass effect */}
        {user && (
          <button
            onClick={isFavorite ? () => removeFavoriteMutation.mutate() : () => addFavoriteMutation.mutate()}
            className="absolute right-4 sm:right-6 top-20 sm:top-24 w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-black/60 transition-all group"
          >
            <Heart className={`w-5 h-5 transition-colors ${isFavorite ? 'fill-red-500 text-red-500' : 'text-white/70 group-hover:text-red-400'}`} />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="container mx-auto px-3 sm:px-4 -mt-24 sm:-mt-28 md:-mt-32 relative z-10">
        <div className="grid gap-4 sm:gap-6 lg:gap-8 lg:grid-cols-3">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {/* Main glass card */}
            <div className="rounded-2xl sm:rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5 sm:p-8 shadow-2xl shadow-black/20">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <Badge className="bg-gold-500/20 text-gold-300 border-gold-500/30 backdrop-blur-sm">
                  {event.status === "PUBLISHED" ? "En venta" : "Próximamente"}
                </Badge>
                {event.category && (
                  <Badge variant="outline" className="border-white/20 text-white/70 backdrop-blur-sm">
                    {event.category.name}
                  </Badge>
                )}
              </div>
              
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-2">{event.name}</h1>
              
              {event.artistName && (
                <p className="text-base sm:text-lg md:text-xl text-gold-400 mb-3 sm:mb-4 font-medium">{event.artistName}</p>
              )}
              
              {event.shortDescription && (
                <p className="text-sm sm:text-base md:text-lg text-white/70 mb-3 sm:mb-4 leading-relaxed">{event.shortDescription}</p>
              )}
              
              {event.description && (
                <div className="mt-6 pt-6 border-t border-white/10">
                  <h3 className="text-lg font-semibold text-white mb-3">Descripción del evento</h3>
                  <p className="text-white/70 leading-relaxed whitespace-pre-line">{event.description}</p>
                </div>
              )}
            </div>

            {/* Venue Info - Glass card */}
            {event.venue && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-4 sm:p-5 shadow-lg">
                <div className="flex items-center gap-4">
                  <div className="rounded-xl bg-amber-500/20 backdrop-blur-sm p-3 border border-amber-500/20">
                    <MapPin className="h-6 w-6 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{event.venue.name}</h3>
                    <p className="text-sm text-white/60">Venue del evento</p>
                  </div>
                </div>
              </div>
            )}

            {/* Artist Info - Link to Artist Page */}
            {event.artist && (
              <Link to={`/artista/${event.artist.slug}`}>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-4 sm:p-5 hover:bg-white/[0.06] hover:border-[#ffc800]/30 transition-all duration-300 group cursor-pointer shadow-lg">
                  <div className="flex items-center gap-4">
                    {event.artist.profileImage ? (
                      <img
                        src={event.artist.profileImage}
                        alt={event.artist.name}
                        className="h-16 w-16 rounded-xl object-cover ring-2 ring-white/10"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#ffc800]/20 backdrop-blur-sm border border-[#ffc800]/20">
                        <UserCircle className="h-8 w-8 text-[#ffc800]" />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-xs text-[#ffc800] font-medium mb-1">Artista</p>
                      <h3 className="font-semibold text-white text-lg group-hover:text-[#ffc800] transition-colors">
                        {event.artist.name}
                      </h3>
                      <p className="text-sm text-white/60">Ver perfil del artista</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-white/30 group-hover:text-[#ffc800] group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              </Link>
            )}

            {/* Playlist Info - Link to play music */}
            {event.playlist && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-4 sm:p-5 hover:bg-white/[0.06] hover:border-[#ffc800]/30 transition-all duration-300 group cursor-pointer shadow-lg">
                <div className="flex items-center gap-4">
                  {event.playlist.coverUrl ? (
                    <img
                      src={event.playlist.coverUrl}
                      alt={event.playlist.name}
                      className="h-16 w-16 rounded-xl object-cover ring-2 ring-white/10"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#ffc800]/20 backdrop-blur-sm border border-[#ffc800]/20">
                      <ListMusic className="h-8 w-8 text-[#ffc800]" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-xs text-[#ffc800] font-medium mb-1">Playlist del evento</p>
                    <h3 className="font-semibold text-white text-lg group-hover:text-[#ffc800] transition-colors">
                      {event.playlist.name}
                    </h3>
                    <p className="text-sm text-white/60">Escucha la música</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#ffc800]/20 group-hover:bg-[#ffc800] transition-colors backdrop-blur-sm border border-[#ffc800]/20 group-hover:border-transparent">
                    <Play className="h-5 w-5 text-[#ffc800] group-hover:text-black transition-colors ml-0.5" />
                  </div>
                </div>
              </div>
            )}

            {/* Sessions/Dates - Glass card */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5 sm:p-6 shadow-lg">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-white mb-4">
                <Calendar className="h-5 w-5 text-gold-400" />
                Fechas disponibles
              </h3>
              <div className="space-y-3">
                {availableSessions.length === 0 ? (
                  <p className="py-4 text-center text-white/60">
                    No hay funciones disponibles en este momento
                  </p>
                ) : (
                  availableSessions.map((session: Session) => (
                    <div
                      key={session.id}
                      className={`flex items-center justify-between rounded-xl p-4 transition-all cursor-pointer border ${
                        selectedSession === session.id
                          ? "bg-gold-500/20 border-gold-500/50 shadow-lg shadow-gold-500/10"
                          : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10"
                      }`}
                      onClick={() => setSelectedSession(session.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`rounded-lg p-2 ${selectedSession === session.id ? 'bg-gold-500/30' : 'bg-gold-500/20'}`}>
                          <Calendar className="h-4 w-4 text-gold-400" />
                        </div>
                        <div>
                          <p className="font-medium text-white">
                            {session.title || formatDate(session.startsAt)}
                          </p>
                          <div className="flex items-center gap-3 text-sm text-white/60">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatTime(session.startsAt)}
                            </span>
                            {session.capacity && (
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {session.capacity - (session.stats?.soldTickets ?? 0)} disponibles
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant={session.status === "SALES_OPEN" ? "default" : "secondary"}
                        className={session.status === "SALES_OPEN" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : ""}
                      >
                        {session.status === "SALES_OPEN" ? "Disponible" : session.status}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Prices by Zone - Glass card */}
            {pricesByZone.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5 sm:p-6 shadow-lg">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-white mb-4">
                  <Ticket className="h-5 w-5 text-gold-400" />
                  Precios por zona
                </h3>
                <div className="space-y-3">
                  {pricesByZone.map((zone: any) => (
                    <div
                      key={zone.id}
                      className="flex items-center justify-between rounded-xl bg-white/[0.02] border border-white/5 p-4 hover:bg-white/[0.04] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="h-4 w-4 rounded-full ring-2 ring-white/20"
                          style={{ backgroundColor: zone.color || "#64748b" }}
                        />
                        <span className="font-medium text-white">{zone.name}</span>
                      </div>
                      <span className="text-lg font-bold text-gold-400">
                        ${zone.price.toLocaleString()} {zone.currency}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Purchase Card (Sticky) - Premium Glass */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-24">
              <div className="rounded-2xl sm:rounded-3xl border border-gold-500/30 bg-gradient-to-br from-gold-500/10 via-amber-500/5 to-transparent backdrop-blur-xl shadow-2xl shadow-gold-500/10 overflow-hidden">
                {/* Glow effect */}
                <div className="absolute -inset-1 bg-gradient-to-br from-gold-500/20 to-transparent blur-xl opacity-50 pointer-events-none" />
                
                <div className="relative p-5 sm:p-6">
                  <h3 className="text-lg sm:text-xl font-semibold text-white mb-4">Comprar boletos</h3>
                  
                  <div className="space-y-4">
                    {/* Price Range */}
                    {minPrice > 0 && (
                      <div className="text-center py-3 px-4 rounded-xl bg-gold-500/10 border border-gold-500/20">
                        <p className="text-xs sm:text-sm text-gold-300 font-medium">Desde</p>
                        <p className="text-2xl sm:text-3xl font-bold text-white">
                          ${minPrice.toLocaleString()} MXN
                        </p>
                        {minPrice !== maxPrice && (
                          <p className="text-xs sm:text-sm text-gold-200/80">
                            hasta ${maxPrice.toLocaleString()} MXN
                          </p>
                        )}
                      </div>
                    )}

                    <Separator className="bg-white/10" />

                    {/* Session Selection */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white/70">
                        Selecciona una fecha
                      </label>
                      <Select value={selectedSession} onValueChange={setSelectedSession}>
                        <SelectTrigger className="border-white/20 bg-black/30 backdrop-blur-sm hover:bg-black/40 transition-colors">
                          <SelectValue placeholder="Elige una función" />
                        </SelectTrigger>
                        <SelectContent className="bg-black/95 backdrop-blur-xl border-white/10">
                          {availableSessions.map((session: Session) => (
                            <SelectItem key={session.id} value={session.id}>
                              {formatDate(session.startsAt)} - {formatTime(session.startsAt)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Buy Button - Premium */}
                    <Button
                      className="w-full h-12 sm:h-14 text-base sm:text-lg font-semibold bg-gradient-to-r from-gold-500 to-amber-500 hover:from-gold-400 hover:to-amber-400 text-black shadow-lg shadow-gold-500/25 transition-all hover:shadow-xl hover:shadow-gold-500/30 hover:scale-[1.02]"
                      disabled={!selectedSession || availableSessions.length === 0}
                      onClick={handleBuyTickets}
                    >
                      <ShoppingCart className="mr-2 h-5 w-5" />
                      Seleccionar asientos
                    </Button>

                    {/* Add to Calendar */}
                    {selectedSession && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full border-white/20 bg-white/5 text-white/70 hover:text-white hover:bg-white/10 backdrop-blur-sm"
                          >
                            <CalendarPlus className="mr-2 h-4 w-4" />
                            Añadir a calendario
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="center" className="w-56 bg-black/95 backdrop-blur-xl border-white/10">
                          <DropdownMenuItem onClick={handleAddToGoogleCalendar} className="hover:bg-white/10">
                            <Calendar className="mr-2 h-4 w-4" />
                            Google Calendar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={generateICalFile} className="hover:bg-white/10">
                            <Download className="mr-2 h-4 w-4" />
                            Descargar .ics (Apple, Outlook)
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}

                    {/* Add to Favorites */}
                    <Button
                      variant="outline"
                      className={`w-full border-white/20 bg-white/5 backdrop-blur-sm transition-all ${
                        isFavorite 
                          ? "text-rose-400 border-rose-400/30 bg-rose-500/10 hover:bg-rose-500/20" 
                          : "text-white/70 hover:text-white hover:bg-white/10"
                      }`}
                      onClick={handleToggleFavorite}
                      disabled={addFavoriteMutation.isPending || removeFavoriteMutation.isPending}
                    >
                      <Heart 
                        className={`mr-2 h-4 w-4 ${isFavorite ? "fill-rose-400" : ""}`} 
                      />
                      {isFavorite ? "En favoritos" : "Agregar a favoritos"}
                    </Button>

                    {/* Info */}
                    <div className="flex items-start gap-2 rounded-xl bg-black/20 border border-white/5 p-3 text-xs text-white/60">
                      <Info className="h-4 w-4 mt-0.5 flex-shrink-0 text-gold-400/60" />
                      <p>
                        Los asientos se reservan por tiempo limitado. Completa tu compra para asegurarlos.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-16 border-t border-white/5 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-white/50">
          <p>© 2025 Boletera. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

export default EventDetail;
