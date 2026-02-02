import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar,
  MapPin,
  Users,
  Ticket,
  TrendingUp,
  DollarSign,
  RefreshCw,
  Clock,
  ShoppingCart,
  Eye,
  AlertCircle,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Link } from "react-router-dom";
import { useAppConfig, formatPrice } from "@/hooks/useAppConfig";
import { API_BASE_URL } from "@/lib/api-base";
import { normalizeImageUrl } from "@/lib/utils/imageUrl";

interface DashboardStats {
  activeEvents: number;
  upcomingEvents: number;
  totalVenues: number;
  venuesWithLayouts: number;
  totalTicketsSold: number;
  ticketsThisMonth: number;
  ticketsGrowth: number;
  totalRevenue: number;
  revenueThisMonth: number;
  revenueGrowth: number;
  activeReservations: number;
  totalUsers: number;
  newUsersThisMonth: number;
  checkinsToday: number;
  pendingOrders: number;
}

interface SalesChartData {
  date: string;
  sales: number;
  revenue: number;
}

interface TopEvent {
  id: string;
  name: string;
  thumbnailImage: string | null;
  ticketsSold: number;
  revenue: number;
  nextSession: string | null;
  venue: string | null;
}

interface RecentOrder {
  id: string;
  orderNumber: string;
  buyerName: string;
  buyerEmail: string;
  total: number;
  ticketCount: number;
  eventName: string;
  createdAt: string;
  status: string;
}

const COLORS = ["#06b6d4", "#8b5cf6", "#ec4899", "#f59e0b", "#22c55e", "#ef4444"];

function StatsSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-20 mb-2" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

const AdminDashboard = () => {
  const { token } = useAuth();
  const { config } = useAppConfig();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [salesChart, setSalesChart] = useState<SalesChartData[]>([]);
  const [topEvents, setTopEvents] = useState<TopEvent[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    if (!token) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      // Fetch all data in parallel
      const [statsRes, chartRes, topRes, ordersRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/admin/stats`, { headers }),
        fetch(`${API_BASE_URL}/api/admin/stats/sales-chart?days=30`, { headers }),
        fetch(`${API_BASE_URL}/api/admin/stats/top-events?limit=5`, { headers }),
        fetch(`${API_BASE_URL}/api/admin/stats/recent-orders?limit=10`, { headers }),
      ]);
      
      if (!statsRes.ok) throw new Error("Error cargando estadísticas");
      
      const [statsData, chartData, topData, ordersData] = await Promise.all([
        statsRes.json(),
        chartRes.ok ? chartRes.json() : { chart: [] },
        topRes.ok ? topRes.json() : { events: [] },
        ordersRes.ok ? ordersRes.json() : { orders: [] },
      ]);
      
      // Ensure all stats properties have default values
      setStats({
        activeEvents: statsData.activeEvents ?? 0,
        upcomingEvents: statsData.upcomingEvents ?? 0,
        totalVenues: statsData.totalVenues ?? 0,
        venuesWithLayouts: statsData.venuesWithLayouts ?? 0,
        totalTicketsSold: statsData.totalTicketsSold ?? 0,
        ticketsThisMonth: statsData.ticketsThisMonth ?? 0,
        ticketsGrowth: statsData.ticketsGrowth ?? 0,
        totalRevenue: statsData.totalRevenue ?? 0,
        revenueThisMonth: statsData.revenueThisMonth ?? 0,
        revenueGrowth: statsData.revenueGrowth ?? 0,
        activeReservations: statsData.activeReservations ?? 0,
        totalUsers: statsData.totalUsers ?? 0,
        newUsersThisMonth: statsData.newUsersThisMonth ?? 0,
        checkinsToday: statsData.checkinsToday ?? 0,
        pendingOrders: statsData.pendingOrders ?? 0,
      });
      setSalesChart(chartData.chart || []);
      setTopEvents(topData.events || []);
      setRecentOrders(ordersData.orders || []);
      setLastSync(new Date());
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchDashboardData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [token]);

  const formatCurrency = (amount: number) => {
    return formatPrice(amount, config.currency, config.currencyLocale);
  };

  const formatGrowth = (growth: number) => {
    const sign = growth >= 0 ? "+" : "";
    return `${sign}${growth.toFixed(1)}%`;
  };

  if (error && !stats) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
        <h2 className="text-lg font-semibold text-white mb-2">Error al cargar datos</h2>
        <p className="text-white/60 mb-4">{error}</p>
        <Button onClick={fetchDashboardData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 px-2 py-4 text-white lg:px-0">
      {/* Header */}
      <div className="rounded-[32px] border border-white/10 bg-gradient-to-r from-gold-500/10 via-transparent to-amber-500/20 px-8 py-8 backdrop-blur-2xl">
        <p className="text-xs uppercase tracking-[0.4em] text-white/70">Estado general</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-semibold text-white">Dashboard operativo</h1>
            <p className="text-white/70">Resumen en vivo de eventos, venues y ventas.</p>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchDashboardData}
              disabled={loading}
              className="border-white/10"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
            <div className="rounded-full border border-white/10 px-4 py-2 text-sm text-gold-200">
              Última sincronización: {formatDistanceToNow(lastSync, { addSuffix: true, locale: es })}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      {loading && !stats ? (
        <StatsSkeleton />
      ) : stats ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="transition-all hover:-translate-y-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-200">Eventos Activos</CardTitle>
              <Calendar className="h-4 w-4 text-gold-300" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{stats.activeEvents}</div>
              <p className="text-xs text-white/60">
                {stats.upcomingEvents} próximos
              </p>
            </CardContent>
          </Card>

          <Card className="transition-all hover:-translate-y-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-200">Venues Registrados</CardTitle>
              <MapPin className="h-4 w-4 text-yellow-300" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{stats.totalVenues}</div>
              <p className="text-xs text-white/60">
                {stats.venuesWithLayouts} con mapas
              </p>
            </CardContent>
          </Card>

          <Card className="transition-all hover:-translate-y-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-200">Boletos Vendidos</CardTitle>
              <Ticket className="h-4 w-4 text-pink-300" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{stats.totalTicketsSold.toLocaleString()}</div>
              <p className={`text-xs ${stats.ticketsGrowth >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                {formatGrowth(stats.ticketsGrowth)} este mes
              </p>
            </CardContent>
          </Card>

          <Card className="transition-all hover:-translate-y-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-200">Ingresos Totales</CardTitle>
              <DollarSign className="h-4 w-4 text-amber-300" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{formatCurrency(stats.totalRevenue)}</div>
              <p className={`text-xs ${stats.revenueGrowth >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                {formatGrowth(stats.revenueGrowth)} vs mes anterior
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Secondary Stats */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-gold-500/10 border-gold-500/20">
            <CardContent className="flex items-center gap-4 p-4">
              <ShoppingCart className="h-8 w-8 text-gold-400" />
              <div>
                <p className="text-2xl font-bold text-gold-300">{stats.activeReservations}</p>
                <p className="text-xs text-white/60">Reservas activas</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-yellow-500/10 border-yellow-500/20">
            <CardContent className="flex items-center gap-4 p-4">
              <Users className="h-8 w-8 text-yellow-400" />
              <div>
                <p className="text-2xl font-bold text-yellow-300">{stats.totalUsers}</p>
                <p className="text-xs text-white/60">Usuarios (+{stats.newUsersThisMonth} mes)</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-emerald-500/10 border-emerald-500/20">
            <CardContent className="flex items-center gap-4 p-4">
              <Eye className="h-8 w-8 text-emerald-400" />
              <div>
                <p className="text-2xl font-bold text-emerald-300">{stats.checkinsToday}</p>
                <p className="text-xs text-white/60">Check-ins hoy</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-amber-500/10 border-amber-500/20">
            <CardContent className="flex items-center gap-4 p-4">
              <Clock className="h-8 w-8 text-amber-400" />
              <div>
                <p className="text-2xl font-bold text-amber-300">{stats.pendingOrders}</p>
                <p className="text-xs text-white/60">Órdenes pendientes</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts */}
      <Tabs defaultValue="sales" className="space-y-4">
        <TabsList className="bg-white/5">
          <TabsTrigger value="sales">Ventas</TabsTrigger>
          <TabsTrigger value="revenue">Ingresos</TabsTrigger>
        </TabsList>

        <TabsContent value="sales">
          <Card>
            <CardHeader>
              <CardTitle className="text-white">Ventas de boletos - Últimos 30 días</CardTitle>
              <CardDescription>Número de boletos vendidos por día</CardDescription>
            </CardHeader>
            <CardContent>
              {salesChart.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={salesChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                      dataKey="date"
                      stroke="#94a3b8"
                      tickFormatter={(value) => format(new Date(value), "dd/MM")}
                      fontSize={12}
                    />
                    <YAxis stroke="#94a3b8" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1e293b",
                        border: "1px solid #334155",
                        borderRadius: "8px",
                      }}
                      labelFormatter={(value) =>
                        format(new Date(value), "EEEE d 'de' MMMM", { locale: es })
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="sales"
                      stroke="#06b6d4"
                      strokeWidth={2}
                      dot={false}
                      name="Boletos"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-white/60">
                  No hay datos de ventas disponibles
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenue">
          <Card>
            <CardHeader>
              <CardTitle className="text-white">Ingresos - Últimos 30 días</CardTitle>
              <CardDescription>Ingresos diarios en MXN</CardDescription>
            </CardHeader>
            <CardContent>
              {salesChart.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={salesChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                      dataKey="date"
                      stroke="#94a3b8"
                      tickFormatter={(value) => format(new Date(value), "dd/MM")}
                      fontSize={12}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={12}
                      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1e293b",
                        border: "1px solid #334155",
                        borderRadius: "8px",
                      }}
                      labelFormatter={(value) =>
                        format(new Date(value), "EEEE d 'de' MMMM", { locale: es })
                      }
                      formatter={(value: number) => [formatCurrency(value), "Ingresos"]}
                    />
                    <Bar dataKey="revenue" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-white/60">
                  No hay datos de ingresos disponibles
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Events */}
        <Card>
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-gold-400" />
              Eventos más vendidos
            </CardTitle>
            <CardDescription>Ranking por boletos vendidos</CardDescription>
          </CardHeader>
          <CardContent>
            {topEvents.length > 0 ? (
              <div className="space-y-4">
                {topEvents.map((event, index) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold"
                      style={{ backgroundColor: `${COLORS[index % COLORS.length]}20`, color: COLORS[index % COLORS.length] }}
                    >
                      {index + 1}
                    </div>
                    {event.thumbnailImage && (
                      <img
                        src={normalizeImageUrl(event.thumbnailImage) || ''}
                        alt={event.name}
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <Link
                        to={`/admin/events/${event.id}`}
                        className="font-semibold hover:text-gold-400 truncate block"
                      >
                        {event.name}
                      </Link>
                      <p className="text-xs text-white/60 truncate">
                        {event.venue || "Sin venue"}
                        {event.nextSession && (
                          <span>
                            {" "}
                            • {format(new Date(event.nextSession), "dd/MM/yyyy")}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gold-300">{event.ticketsSold}</p>
                      <p className="text-xs text-white/60">{formatCurrency(event.revenue)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-white/60">
                No hay eventos con ventas
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-yellow-400" />
              Órdenes recientes
            </CardTitle>
            <CardDescription>Últimas compras realizadas</CardDescription>
          </CardHeader>
          <CardContent>
            {recentOrders.length > 0 ? (
              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/20">
                      <Ticket className="h-4 w-4 text-emerald-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium text-white">
                          #{order.orderNumber}
                        </span>
                        <Badge
                          variant="secondary"
                          className={
                            order.status === "PAID"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : order.status === "PENDING"
                              ? "bg-amber-500/20 text-amber-300"
                              : "bg-white/50/20 text-white/70"
                          }
                        >
                          {order.status === "PAID" ? "Pagado" : order.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-white/70 truncate">{order.buyerName}</p>
                      <p className="text-xs text-white/60 truncate">
                        {order.eventName} • {order.ticketCount} boleto(s)
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-emerald-300">
                        {formatCurrency(order.total)}
                      </p>
                      <p className="text-xs text-white/50">
                        {formatDistanceToNow(new Date(order.createdAt), {
                          addSuffix: true,
                          locale: es,
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-white/60">
                No hay órdenes recientes
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
