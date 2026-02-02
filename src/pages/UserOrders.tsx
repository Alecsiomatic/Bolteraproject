import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ShoppingBag,
  Search,
  Calendar,
  Ticket,
  ChevronRight,
  Eye,
  Filter,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { API_BASE_URL } from "@/lib/api-base";

interface Order {
  id: string;
  orderNumber: string;
  eventName: string;
  eventId: string;
  sessionDate: string;
  total: number;
  status: string;
  ticketCount: number;
  createdAt: string;
  paidAt: string | null;
}

export default function UserOrders() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (token) {
      fetchOrders();
    }
  }, [token]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/me/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
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
      case "REFUNDED":
        return "border-white/60/50 bg-white/50/20 text-white/70";
      default:
        return "border-white/60/50 bg-white/50/20 text-white/70";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "PAID": return "Pagado";
      case "PENDING": return "Pendiente";
      case "CANCELLED": return "Cancelado";
      case "REFUNDED": return "Reembolsado";
      default: return status;
    }
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.eventName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div>
          <Skeleton className="mb-2 h-6 sm:h-8 w-40 sm:w-48 bg-white/10" />
          <Skeleton className="h-4 w-52 sm:w-64 bg-white/10" />
        </div>
        <div className="rounded-2xl sm:rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="mb-3 sm:mb-4 h-14 sm:h-16 w-full bg-white/10" />
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
          <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-400/20 to-emerald-600/20">
            <ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400" />
          </div>
          Mis Compras
        </h1>
        <p className="mt-1 text-sm sm:text-base text-white/60">Historial de todas tus compras y órdenes</p>
      </div>

      {/* Filters */}
      <div className="rounded-2xl sm:rounded-3xl border border-white/10 bg-white/5 p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" />
            <Input
              placeholder="Buscar por evento u orden..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border-white/10 bg-white/5 pl-9 text-white placeholder:text-white/50 h-10 sm:h-11 text-sm sm:text-base"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full border-white/10 bg-white/5 text-white sm:w-48 h-10 sm:h-11 text-sm sm:text-base">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Filtrar" />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-[#0a0f1a]">
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="PAID">Pagados</SelectItem>
              <SelectItem value="PENDING">Pendientes</SelectItem>
              <SelectItem value="CANCELLED">Cancelados</SelectItem>
              <SelectItem value="REFUNDED">Reembolsados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Orders List */}
      <div className="rounded-2xl sm:rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
        <div className="mb-4 sm:mb-6">
          <h3 className="text-base sm:text-lg font-semibold text-white">Órdenes ({filteredOrders.length})</h3>
          <p className="text-xs sm:text-sm text-white/60">
            {filteredOrders.length === 0
              ? "No se encontraron órdenes"
              : `Mostrando ${filteredOrders.length} orden${filteredOrders.length > 1 ? 'es' : ''}`}
          </p>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="py-8 sm:py-12 text-center">
            <div className="mx-auto mb-3 sm:mb-4 flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-white/5">
              <ShoppingBag className="h-6 w-6 sm:h-8 sm:w-8 text-white/50" />
            </div>
            <h3 className="mb-2 text-sm sm:text-base font-medium text-white">No tienes compras</h3>
            <p className="mb-3 sm:mb-4 text-xs sm:text-sm text-white/60">Cuando compres boletos, aparecerán aquí</p>
            <Button asChild size="sm" className="bg-gradient-to-br from-yellow-400/90 via-amber-400/80 to-yellow-500/90 text-black border border-yellow-300/40 shadow-[0_8px_32px_rgba(255,200,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.4)] hover:shadow-[0_12px_40px_rgba(255,200,0,0.45)] backdrop-blur-xl text-xs sm:text-sm">
              <Link to="/events">Explorar Eventos</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Desktop Table */}
            <div className="hidden md:block">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/60">Orden</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/60">Evento</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/60">Boletos</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/60">Total</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/60">Estado</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/60">Fecha</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/60"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredOrders.map((order) => (
                      <tr key={order.id} className="transition-colors hover:bg-white/5">
                        <td className="px-4 py-4 font-mono text-sm text-white">
                          #{order.orderNumber}
                        </td>
                        <td className="px-4 py-4">
                          <div>
                            <p className="font-medium text-white">{order.eventName}</p>
                            {order.sessionDate && (
                              <p className="text-xs text-white/60">
                                {format(new Date(order.sessionDate), "d MMM yyyy, HH:mm", { locale: es })}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/5 px-2 py-1 text-xs text-white/70">
                            <Ticket className="h-3 w-3" />
                            {order.ticketCount}
                          </span>
                        </td>
                        <td className="px-4 py-4 font-semibold text-white">
                          ${order.total.toLocaleString("es-MX")}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-block rounded-full border px-2 py-1 text-xs ${getStatusBadge(order.status)}`}>
                            {getStatusText(order.status)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-white/60">
                          {format(new Date(order.createdAt), "d MMM yyyy", { locale: es })}
                        </td>
                        <td className="px-4 py-4">
                          <Link
                            to={`/order/${order.orderNumber}`}
                            className="flex items-center gap-1 text-sm text-gold-400 hover:text-gold-300"
                          >
                            <Eye className="h-4 w-4" />
                            Ver
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Cards */}
            <div className="space-y-3 sm:space-y-4 md:hidden">
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-xl sm:rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-4 transition-all hover:border-white/20"
                >
                  <div className="mb-2 sm:mb-3 flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs sm:text-sm text-white/60">#{order.orderNumber}</p>
                      <h4 className="text-sm sm:text-base font-medium text-white truncate">{order.eventName}</h4>
                    </div>
                    <span className={`inline-block rounded-full border px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs ${getStatusBadge(order.status)}`}>
                      {getStatusText(order.status)}
                    </span>
                  </div>
                  <div className="mb-2 sm:mb-3 flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-white/60">
                    {order.sessionDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
                        {format(new Date(order.sessionDate), "d MMM", { locale: es })}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Ticket className="h-3 w-3 sm:h-4 sm:w-4" />
                      {order.ticketCount} boleto{order.ticketCount > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-base sm:text-lg font-bold text-white">
                      ${order.total.toLocaleString("es-MX")}
                    </span>
                    <Link
                      to={`/order/${order.orderNumber}`}
                      className="flex items-center gap-1 rounded-lg sm:rounded-xl border border-white/20 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-white transition-colors hover:bg-white/10"
                    >
                      Ver Detalles
                      <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
