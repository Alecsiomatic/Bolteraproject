import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Ticket,
  Calendar,
  ShoppingBag,
  TrendingUp,
  Clock,
  MapPin,
  ChevronRight,
  QrCode,
  CalendarCheck,
  PartyPopper,
  Sparkles,
  User,
} from "lucide-react";
import { format, formatDistanceToNow, isPast, isToday } from "date-fns";
import { es } from "date-fns/locale";
import { API_BASE_URL } from "@/lib/api-base";

interface DashboardStats {
  totalTickets: number;
  upcomingEvents: number;
  totalOrders: number;
  totalSpent: number;
}

interface UpcomingTicket {
  id: string;
  eventName: string;
  eventImage: string | null;
  sessionDate: string;
  venueName: string;
  venueCity: string;
  seatLabel: string | null;
  zoneName: string | null;
  status: string;
}

interface RecentOrder {
  id: string;
  orderNumber: string;
  eventName: string;
  total: number;
  status: string;
  createdAt: string;
  ticketCount: number;
}

export default function UserDashboard() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [upcomingTickets, setUpcomingTickets] = useState<UpcomingTicket[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetchDashboardData();
    }
  }, [token]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const statsRes = await fetch(`${API_BASE_URL}/api/users/me/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats);
        setUpcomingTickets(data.upcomingTickets || []);
        setRecentOrders(data.recentOrders || []);
      }
    } catch (error) {
      console.error("Error fetching dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PAID":
        return "border-emerald-400/50 bg-emerald-500/20 text-emerald-300";
      case "PENDING":
        return "border-amber-400/50 bg-amber-500/20 text-amber-300";
      case "CANCELLED":
        return "border-rose-400/50 bg-rose-500/20 text-rose-300";
      default:
        return "border-white/60/50 bg-white/50/20 text-white/70";
    }
  };

  const getTimeUntilEvent = (date: string) => {
    const eventDate = new Date(date);
    if (isToday(eventDate)) {
      return { text: "¡Hoy!", urgent: true };
    }
    if (isPast(eventDate)) {
      return { text: "Pasado", urgent: false };
    }
    const daysUntil = Math.ceil((eventDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntil <= 3) {
      return { text: `En ${daysUntil} día${daysUntil > 1 ? 's' : ''}`, urgent: true };
    }
    return { text: formatDistanceToNow(eventDate, { locale: es, addSuffix: true }), urgent: false };
  };

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl sm:rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
              <Skeleton className="mb-3 sm:mb-4 h-3 sm:h-4 w-20 sm:w-24 bg-white/10" />
              <Skeleton className="h-6 sm:h-8 w-12 sm:w-16 bg-white/10" />
            </div>
          ))}
        </div>
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          <div className="rounded-2xl sm:rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
            <Skeleton className="mb-3 sm:mb-4 h-5 sm:h-6 w-32 sm:w-40 bg-white/10" />
            <div className="space-y-3 sm:space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 sm:h-20 w-full bg-white/10" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-white/10 bg-gradient-to-br from-gold-500/20 via-amber-500/20 to-yellow-600/20 p-4 sm:p-6">
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 sm:h-40 w-32 sm:w-40 rounded-full bg-gold-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-32 sm:h-40 w-32 sm:w-40 rounded-full bg-amber-400/20 blur-3xl" />
        <div className="relative">
          <div className="mb-2 sm:mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-gold-400 to-amber-500">
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-[#0a0a0a]" />
            </div>
            <span className="text-xs sm:text-sm uppercase tracking-wider text-white/70">Panel de Usuario</span>
          </div>
          <h1 className="mb-1.5 sm:mb-2 text-xl sm:text-2xl font-bold text-white">
            ¡Bienvenido, {user?.name?.split(" ")[0]}!
          </h1>
          <p className="mb-3 sm:mb-4 text-sm sm:text-base text-white/70">
            {upcomingTickets.length > 0
              ? `Tienes ${upcomingTickets.length} evento${upcomingTickets.length > 1 ? 's' : ''} próximo${upcomingTickets.length > 1 ? 's' : ''}`
              : "Explora nuevos eventos y vive experiencias inolvidables"}
          </p>
          <Button
            size="sm"
            onClick={() => navigate("/events")}
            className="bg-gradient-to-br from-yellow-400/90 via-amber-400/80 to-yellow-500/90 text-black border border-yellow-300/40 shadow-[0_8px_32px_rgba(255,200,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.4)] hover:shadow-[0_12px_40px_rgba(255,200,0,0.45)] backdrop-blur-xl text-xs sm:text-sm"
          >
            <Calendar className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Explorar Eventos
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <div className="group rounded-2xl sm:rounded-3xl border border-white/10 bg-white/5 p-3 sm:p-6 transition-all hover:border-gold-400/50 hover:bg-white/10">
          <div className="mb-2 sm:mb-4 flex items-center justify-between">
            <span className="text-xs sm:text-sm text-white/60">Mis Boletos</span>
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-gold-400/20 to-gold-600/20">
              <Ticket className="h-4 w-4 sm:h-5 sm:w-5 text-gold-400" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white">{stats?.totalTickets || 0}</p>
          <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-white/60">Boletos comprados</p>
        </div>

        <div className="group rounded-2xl sm:rounded-3xl border border-white/10 bg-white/5 p-3 sm:p-6 transition-all hover:border-amber-400/50 hover:bg-white/10">
          <div className="mb-2 sm:mb-4 flex items-center justify-between">
            <span className="text-xs sm:text-sm text-white/60">Próximos</span>
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-400/20 to-amber-600/20">
              <CalendarCheck className="h-4 w-4 sm:h-5 sm:w-5 text-amber-400" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white">{stats?.upcomingEvents || 0}</p>
          <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-white/60">Eventos por asistir</p>
        </div>

        <div className="group rounded-2xl sm:rounded-3xl border border-white/10 bg-white/5 p-3 sm:p-6 transition-all hover:border-emerald-400/50 hover:bg-white/10">
          <div className="mb-2 sm:mb-4 flex items-center justify-between">
            <span className="text-xs sm:text-sm text-white/60">Mis Compras</span>
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-400/20 to-emerald-600/20">
              <ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white">{stats?.totalOrders || 0}</p>
          <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-white/60">Órdenes realizadas</p>
        </div>

        <div className="group rounded-2xl sm:rounded-3xl border border-white/10 bg-white/5 p-3 sm:p-6 transition-all hover:border-amber-400/50 hover:bg-white/10">
          <div className="mb-2 sm:mb-4 flex items-center justify-between">
            <span className="text-xs sm:text-sm text-white/60">Total Gastado</span>
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-400/20 to-amber-600/20">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-amber-400" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white">
            ${(stats?.totalSpent || 0).toLocaleString("es-MX")}
          </p>
          <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-white/60">En experiencias</p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        {/* Upcoming Events */}
        <div className="rounded-2xl sm:rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
          <div className="mb-4 sm:mb-6 flex items-center justify-between">
            <div>
              <h3 className="flex items-center gap-1.5 sm:gap-2 text-base sm:text-lg font-semibold text-white">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-amber-400" />
                Próximos Eventos
              </h3>
              <p className="text-xs sm:text-sm text-white/60">Tus boletos para eventos próximos</p>
            </div>
            <Link
              to="/mi-cuenta/boletos"
              className="flex items-center gap-1 text-xs sm:text-sm text-gold-400 hover:text-gold-300"
            >
              Ver todos <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
            </Link>
          </div>

          {upcomingTickets.length === 0 ? (
            <div className="py-6 sm:py-8 text-center">
              <div className="mx-auto mb-3 sm:mb-4 flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-white/5">
                <PartyPopper className="h-6 w-6 sm:h-8 sm:w-8 text-white/50" />
              </div>
              <p className="mb-3 sm:mb-4 text-sm sm:text-base text-white/60">No tienes eventos próximos</p>
              <Button asChild variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10 text-xs sm:text-sm">
                <Link to="/events">Explorar Eventos</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {upcomingTickets.slice(0, 3).map((ticket) => {
                const timeInfo = getTimeUntilEvent(ticket.sessionDate);
                return (
                  <div
                    key={ticket.id}
                    className="flex cursor-pointer gap-3 sm:gap-4 rounded-xl sm:rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-4 transition-all hover:border-white/20 hover:bg-white/10"
                    onClick={() => navigate("/mi-cuenta/boletos")}
                  >
                    <div className="flex h-10 w-10 sm:h-14 sm:w-14 flex-shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-gradient-to-br from-amber-500/30 to-gold-500/30">
                      <Ticket className="h-5 w-5 sm:h-7 sm:w-7 text-amber-300" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-sm sm:text-base font-medium text-white">{ticket.eventName}</h4>
                      <div className="mt-0.5 sm:mt-1 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-white/60">
                        <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                        <span>{format(new Date(ticket.sessionDate), "d MMM, HH:mm", { locale: es })}</span>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-white/60">
                        <MapPin className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                        <span className="truncate">{ticket.venueName}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end justify-between">
                      <span
                        className={`rounded-full border px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs ${
                          timeInfo.urgent
                            ? "border-gold-400/50 bg-gold-500/20 text-gold-300"
                            : "border-white/60/30 bg-white/50/20 text-white/60"
                        }`}
                      >
                        {timeInfo.text}
                      </span>
                      <button className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white">
                        <QrCode className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Orders */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
                <ShoppingBag className="h-5 w-5 text-emerald-400" />
                Compras Recientes
              </h3>
              <p className="text-sm text-white/60">Historial de tus compras</p>
            </div>
            <Link
              to="/mi-cuenta/ordenes"
              className="flex items-center gap-1 text-sm text-gold-400 hover:text-gold-300"
            >
              Ver todas <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <div className="py-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
                <ShoppingBag className="h-8 w-8 text-white/50" />
              </div>
              <p className="mb-4 text-white/60">Aún no has realizado compras</p>
              <Button asChild variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10">
                <Link to="/events">Comprar Boletos</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {recentOrders.slice(0, 4).map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between rounded-xl sm:rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-4 transition-all hover:border-white/20"
                >
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-xs sm:text-sm font-medium text-white">{order.eventName}</h4>
                    <div className="mt-0.5 sm:mt-1 flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span className="rounded-full border border-white/20 bg-white/5 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs text-white/70">
                        {order.ticketCount} boleto{order.ticketCount > 1 ? 's' : ''}
                      </span>
                      <span className="text-[10px] sm:text-xs text-white/50">
                        {format(new Date(order.createdAt), "d MMM yyyy", { locale: es })}
                      </span>
                    </div>
                  </div>
                  <div className="ml-2 text-right flex-shrink-0">
                    <p className="text-sm sm:text-base font-semibold text-white">${order.total.toLocaleString("es-MX")}</p>
                    <span className={`inline-block rounded-full border px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs ${getStatusBadge(order.status)}`}>
                      {order.status === "PAID" ? "Pagado" : order.status === "PENDING" ? "Pendiente" : order.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-2xl sm:rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
        <h3 className="mb-1 sm:mb-2 text-base sm:text-lg font-semibold text-white">Acciones Rápidas</h3>
        <p className="mb-4 sm:mb-6 text-xs sm:text-sm text-white/60">Accede rápidamente a las funciones más utilizadas</p>

        <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-4">
          <Link
            to="/events"
            className="flex flex-col items-center gap-2 sm:gap-3 rounded-xl sm:rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-6 transition-all hover:border-amber-400/50 hover:bg-white/10"
          >
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg sm:rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-600/20">
              <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-amber-400" />
            </div>
            <span className="text-xs sm:text-sm text-white text-center">Explorar Eventos</span>
          </Link>

          <Link
            to="/mi-cuenta/boletos"
            className="flex flex-col items-center gap-2 sm:gap-3 rounded-xl sm:rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-6 transition-all hover:border-gold-400/50 hover:bg-white/10"
          >
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg sm:rounded-xl bg-gradient-to-br from-gold-400/20 to-gold-600/20">
              <QrCode className="h-5 w-5 sm:h-6 sm:w-6 text-gold-400" />
            </div>
            <span className="text-xs sm:text-sm text-white text-center">Ver Mis QR</span>
          </Link>

          <Link
            to="/mi-cuenta/ordenes"
            className="flex flex-col items-center gap-2 sm:gap-3 rounded-xl sm:rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-6 transition-all hover:border-emerald-400/50 hover:bg-white/10"
          >
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg sm:rounded-xl bg-gradient-to-br from-emerald-400/20 to-emerald-600/20">
              <ShoppingBag className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-400" />
            </div>
            <span className="text-xs sm:text-sm text-white text-center">Mis Compras</span>
          </Link>

          <Link
            to="/mi-cuenta/perfil"
            className="flex flex-col items-center gap-2 sm:gap-3 rounded-xl sm:rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-6 transition-all hover:border-amber-400/50 hover:bg-white/10"
          >
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg sm:rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-600/20">
              <User className="h-5 w-5 sm:h-6 sm:w-6 text-amber-400" />
            </div>
            <span className="text-xs sm:text-sm text-white text-center">Mi Perfil</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
