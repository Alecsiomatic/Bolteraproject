import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Heart,
  Calendar,
  MapPin,
  Ticket,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { API_BASE_URL } from "@/lib/api-base";

interface FavoriteEvent {
  id: string;
  eventId: string;
  eventName: string;
  eventImage: string | null;
  nextSessionDate: string | null;
  venueName: string;
  venueCity: string;
  minPrice: number;
  status: string;
}

export default function UserFavorites() {
  const { token } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetchFavorites();
    }
  }, [token]);

  const fetchFavorites = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/me/favorites`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setFavorites(data.favorites || []);
      }
    } catch (error) {
      console.error("Error fetching favorites:", error);
    } finally {
      setLoading(false);
    }
  };

  const removeFavorite = async (eventId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/me/favorites/${eventId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setFavorites(favorites.filter((f) => f.eventId !== eventId));
      }
    } catch (error) {
      console.error("Error removing favorite:", error);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div>
          <Skeleton className="mb-2 h-6 sm:h-8 w-40 sm:w-48 bg-white/10" />
          <Skeleton className="h-4 w-52 sm:w-64 bg-white/10" />
        </div>
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl sm:rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
              <Skeleton className="h-32 sm:h-40 w-full bg-white/10" />
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
          <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-rose-400/20 to-rose-600/20">
            <Heart className="h-4 w-4 sm:h-5 sm:w-5 text-rose-400" />
          </div>
          Mis Favoritos
        </h1>
        <p className="mt-1 text-sm sm:text-base text-slate-400">Eventos que has guardado para ver después</p>
      </div>

      {favorites.length === 0 ? (
        <div className="rounded-2xl sm:rounded-3xl border border-white/10 bg-white/5 p-8 sm:p-12 text-center">
          <div className="mx-auto mb-3 sm:mb-4 flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-white/5">
            <Heart className="h-8 w-8 sm:h-10 sm:w-10 text-slate-500" />
          </div>
          <h3 className="mb-2 text-base sm:text-lg font-medium text-white">No tienes favoritos</h3>
          <p className="mb-4 sm:mb-6 text-sm sm:text-base text-slate-400">
            Guarda eventos que te interesen para verlos más tarde
          </p>
          <Button asChild className="bg-gradient-to-br from-cyan-500/80 via-cyan-400/70 to-violet-500/80 text-white border border-cyan-400/30 shadow-[0_8px_32px_rgba(6,182,212,0.3),inset_0_1px_1px_rgba(255,255,255,0.2)] hover:shadow-[0_12px_40px_rgba(6,182,212,0.4)] backdrop-blur-xl text-sm sm:text-base">
            <Link to="/events">
              Explorar Eventos
              <ChevronRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {favorites.map((event) => (
            <div
              key={event.id}
              className="group overflow-hidden rounded-2xl sm:rounded-3xl border border-white/10 bg-white/5 transition-all hover:border-white/20 hover:bg-white/10"
            >
              {/* Event Image or Gradient */}
              <div className="relative h-32 sm:h-40 bg-gradient-to-br from-rose-500/30 via-violet-500/20 to-cyan-500/30">
                <div className="absolute inset-0 flex items-center justify-center">
                  <Ticket className="h-10 w-10 sm:h-12 sm:w-12 text-white/30" />
                </div>
                {/* Remove Button */}
                <button
                  onClick={() => removeFavorite(event.eventId)}
                  className="absolute right-2 top-2 sm:right-3 sm:top-3 flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full border border-white/20 bg-black/50 text-slate-300 backdrop-blur-sm transition-colors hover:bg-rose-500/20 hover:text-rose-400"
                >
                  <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                </button>
                {/* Status Badge */}
                {event.status === "PUBLISHED" && (
                  <span className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 rounded-full border border-emerald-400/50 bg-emerald-500/20 px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs text-emerald-300">
                    Disponible
                  </span>
                )}
              </div>

              <div className="p-3 sm:p-5">
                <h3 className="mb-2 sm:mb-3 line-clamp-2 text-base sm:text-lg font-bold text-white">{event.eventName}</h3>
                
                <div className="mb-3 sm:mb-4 space-y-1.5 sm:space-y-2">
                  {event.nextSessionDate && (
                    <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-slate-400">
                      <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-violet-400" />
                      <span>
                        {format(new Date(event.nextSessionDate), "d MMM yyyy", { locale: es })}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-slate-400">
                    <MapPin className="h-3 w-3 sm:h-4 sm:w-4 text-cyan-400" />
                    <span className="truncate">
                      {event.venueName}{event.venueCity ? `, ${event.venueCity}` : ''}
                    </span>
                  </div>
                </div>

                {/* Price and Action */}
                <div className="flex items-center justify-between">
                  {event.minPrice > 0 && (
                    <div>
                      <p className="text-[10px] sm:text-xs text-slate-400">Desde</p>
                      <p className="text-base sm:text-lg font-bold text-white">
                        ${event.minPrice.toLocaleString("es-MX")}
                      </p>
                    </div>
                  )}
                  <Button
                    asChild
                    size="sm"
                    className="bg-gradient-to-br from-cyan-500/80 via-cyan-400/70 to-violet-500/80 text-white border border-cyan-400/30 shadow-[0_8px_32px_rgba(6,182,212,0.3),inset_0_1px_1px_rgba(255,255,255,0.2)] hover:shadow-[0_12px_40px_rgba(6,182,212,0.4)] backdrop-blur-xl text-xs sm:text-sm"
                  >
                    <Link to={`/events/${event.eventId}`}>
                      Ver Evento
                      <ChevronRight className="ml-1 h-3 w-3 sm:h-4 sm:w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
