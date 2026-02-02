import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar,
  Clock,
  MapPin,
  Ticket,
  ChevronRight,
  QrCode,
  CalendarCheck,
} from "lucide-react";
import { format, isToday, isTomorrow } from "date-fns";
import { es } from "date-fns/locale";
import { API_BASE_URL } from "@/lib/api-base";

interface UpcomingEvent {
  id: string;
  eventId: string;
  eventName: string;
  eventImage: string | null;
  sessionId: string;
  sessionDate: string;
  sessionTitle: string | null;
  venueName: string;
  venueCity: string;
  ticketCount: number;
  tickets: Array<{
    id: string;
    seatLabel: string | null;
    zoneName: string | null;
    status: string;
  }>;
}

export default function UserUpcoming() {
  const { token } = useAuth();
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetchUpcomingEvents();
    }
  }, [token]);

  const fetchUpcomingEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/me/upcoming`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch (error) {
      console.error("Error fetching upcoming events:", error);
    } finally {
      setLoading(false);
    }
  };

  const getTimeLabel = (date: string) => {
    const eventDate = new Date(date);
    if (isToday(eventDate)) {
      return { text: "¡Hoy!", color: "border-rose-400/50 bg-rose-500/20 text-rose-300" };
    }
    if (isTomorrow(eventDate)) {
      return { text: "Mañana", color: "border-amber-400/50 bg-amber-500/20 text-amber-300" };
    }
    const daysUntil = Math.ceil((eventDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntil <= 7) {
      return { text: `En ${daysUntil} días`, color: "border-cyan-400/50 bg-cyan-500/20 text-cyan-300" };
    }
    return { text: format(eventDate, "d MMM", { locale: es }), color: "border-violet-400/50 bg-violet-500/20 text-violet-300" };
  };

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div>
          <Skeleton className="mb-2 h-6 sm:h-8 w-40 sm:w-48 bg-white/10" />
          <Skeleton className="h-4 w-52 sm:w-64 bg-white/10" />
        </div>
        <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl sm:rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
              <Skeleton className="h-28 sm:h-32 w-full bg-white/10" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-xl sm:text-2xl font-bold text-white">
          <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-violet-400/20 to-violet-600/20">
            <CalendarCheck className="h-4 w-4 sm:h-5 sm:w-5 text-violet-400" />
          </div>
          Próximos Eventos
        </h1>
        <p className="mt-1 text-sm sm:text-base text-slate-400">Eventos a los que asistirás próximamente</p>
      </div>

      {events.length === 0 ? (
        <div className="rounded-2xl sm:rounded-3xl border border-white/10 bg-white/5 p-8 sm:p-12 text-center">
          <div className="mx-auto mb-3 sm:mb-4 flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-white/5">
            <Calendar className="h-8 w-8 sm:h-10 sm:w-10 text-slate-500" />
          </div>
          <h3 className="mb-2 text-base sm:text-lg font-medium text-white">No tienes eventos próximos</h3>
          <p className="mb-4 sm:mb-6 text-sm sm:text-base text-slate-400">
            Cuando compres boletos para eventos futuros, aparecerán aquí
          </p>
          <Button asChild className="bg-gradient-to-br from-cyan-500/80 via-cyan-400/70 to-violet-500/80 text-white border border-cyan-400/30 shadow-[0_8px_32px_rgba(6,182,212,0.3),inset_0_1px_1px_rgba(255,255,255,0.2)] hover:shadow-[0_12px_40px_rgba(6,182,212,0.4)] backdrop-blur-xl text-sm sm:text-base">
            <Link to="/events">
              Explorar Eventos
              <ChevronRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2">
          {events.map((event) => {
            const timeLabel = getTimeLabel(event.sessionDate);
            return (
              <div
                key={event.id}
                className="group overflow-hidden rounded-2xl sm:rounded-3xl border border-white/10 bg-white/5 transition-all hover:border-white/20 hover:bg-white/10"
              >
                {/* Event Header with Gradient */}
                <div className="relative h-28 sm:h-32 bg-gradient-to-br from-violet-500/30 via-cyan-500/20 to-purple-600/30">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Ticket className="h-10 w-10 sm:h-12 sm:w-12 text-white/30" />
                  </div>
                  {/* Time Badge */}
                  <span className={`absolute right-2 top-2 sm:right-3 sm:top-3 rounded-full border px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium ${timeLabel.color}`}>
                    {timeLabel.text}
                  </span>
                </div>

                <div className="p-3 sm:p-5">
                  <h3 className="mb-2 sm:mb-3 line-clamp-1 text-base sm:text-lg font-bold text-white">{event.eventName}</h3>
                  
                  <div className="mb-3 sm:mb-4 space-y-1.5 sm:space-y-2">
                    <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-slate-400">
                      <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-violet-400" />
                      <span>
                        {format(new Date(event.sessionDate), "EEE d 'de' MMM", { locale: es })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-slate-400">
                      <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-cyan-400" />
                      <span>
                        {format(new Date(event.sessionDate), "HH:mm 'hrs'", { locale: es })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-slate-400">
                      <MapPin className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-400" />
                      <span className="truncate">
                        {event.venueName}{event.venueCity ? `, ${event.venueCity}` : ''}
                      </span>
                    </div>
                  </div>

                  {/* Tickets Info */}
                  <div className="mb-3 sm:mb-4 rounded-xl sm:rounded-2xl border border-white/10 bg-white/5 p-2 sm:p-3">
                    <div className="mb-1 sm:mb-2 flex items-center justify-between">
                      <span className="text-xs sm:text-sm font-medium text-white">
                        {event.ticketCount} boleto{event.ticketCount > 1 ? 's' : ''}
                      </span>
                      <span className="rounded-full border border-white/20 bg-white/5 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs text-slate-300">
                        <Ticket className="mr-0.5 sm:mr-1 inline h-2.5 w-2.5 sm:h-3 sm:w-3" />
                        {event.tickets[0]?.zoneName || "General"}
                      </span>
                    </div>
                    {event.tickets[0]?.seatLabel && (
                      <p className="text-[10px] sm:text-xs text-slate-400">
                        Asiento{event.ticketCount > 1 ? 's' : ''}: {event.tickets.map(t => t.seatLabel).filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      asChild
                      size="sm"
                      className="flex-1 bg-gradient-to-br from-cyan-500/80 via-cyan-400/70 to-violet-500/80 text-white border border-cyan-400/30 shadow-[0_8px_32px_rgba(6,182,212,0.3),inset_0_1px_1px_rgba(255,255,255,0.2)] hover:shadow-[0_12px_40px_rgba(6,182,212,0.4)] backdrop-blur-xl text-xs sm:text-sm"
                    >
                      <Link to="/mi-cuenta/boletos">
                        <QrCode className="mr-1.5 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                        Ver QR
                      </Link>
                    </Button>
                    <Link
                      to={`/events/${event.eventId}`}
                      className="flex items-center justify-center rounded-xl border border-white/20 px-3 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
