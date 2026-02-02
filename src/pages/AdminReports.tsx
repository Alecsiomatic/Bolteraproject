/**
 * Panel de Reportes y Análisis
 * 
 * Reportes de ventas, check-ins, financieros, clientes, cupones y comparativas
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAppConfig, formatPrice } from "@/hooks/useAppConfig";
import { toast } from "sonner";
import { format, subDays, startOfMonth, endOfMonth, startOfYear } from "date-fns";
import { es } from "date-fns/locale";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Calendar,
  TrendingUp,
  TrendingDown,
  Ticket,
  DollarSign,
  Users,
  MapPin,
  ScanLine,
  BarChart3,
  PieChartIcon,
  Loader2,
  RefreshCw,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  PercentIcon,
  Tag,
  Crown,
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api-base";

interface SalesReport {
  totalRevenue: number;
  totalOrders: number;
  totalTickets: number;
  averageOrderValue: number;
  salesByDay: { date: string; revenue: number; orders: number; tickets: number }[];
  salesByEvent: { eventId: string; eventName: string; revenue: number; tickets: number }[];
  salesByPaymentMethod: { method: string; count: number; revenue: number }[];
  conversionRate: number;
}

interface CheckinReport {
  totalCheckins: number;
  checkinRate: number;
  checkinsByHour: { hour: number; count: number }[];
  checkinsByEvent: { eventId: string; eventName: string; total: number; checkedIn: number }[];
  noShowRate: number;
}

interface EventReport {
  eventId: string;
  eventName: string;
  sessions: {
    sessionId: string;
    date: string;
    capacity: number;
    sold: number;
    revenue: number;
    checkedIn: number;
  }[];
  byZone: { zoneId: string; zoneName: string; capacity: number; sold: number; revenue: number }[];
  byTier: { tierId: string; tierName: string; price: number; sold: number; revenue: number }[];
}

async function fetchSalesReport(params: { startDate: string; endDate: string; eventId?: string }): Promise<SalesReport> {
  const token = localStorage.getItem("auth_token");
  const queryParams = new URLSearchParams({
    startDate: params.startDate,
    endDate: params.endDate,
  });
  if (params.eventId && params.eventId !== "all") queryParams.set("eventId", params.eventId);

  const response = await fetch(`${API_BASE_URL}/api/admin/reports/sales?${queryParams}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Error al cargar reporte de ventas");
  return response.json();
}

async function fetchCheckinReport(params: { startDate: string; endDate: string; eventId?: string }): Promise<CheckinReport> {
  const token = localStorage.getItem("auth_token");
  const queryParams = new URLSearchParams({
    startDate: params.startDate,
    endDate: params.endDate,
  });
  if (params.eventId && params.eventId !== "all") queryParams.set("eventId", params.eventId);

  const response = await fetch(`${API_BASE_URL}/api/admin/reports/checkins?${queryParams}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Error al cargar reporte de check-ins");
  return response.json();
}

async function fetchEventReport(eventId: string): Promise<EventReport> {
  const token = localStorage.getItem("auth_token");
  const response = await fetch(`${API_BASE_URL}/api/admin/reports/events/${eventId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Error al cargar reporte del evento");
  return response.json();
}

// Nuevos reportes
interface FinancialReport {
  summary: {
    grossRevenue: number;
    feesCollected: number;
    discountsApplied: number;
    refundsAmount: number;
    refundsCount: number;
    cancelledCount: number;
    netRevenue: number;
  };
  paymentMethods: { method: string; count: number; amount: number }[];
  revenueByEvent: { id: string; name: string; orders: number; tickets: number; revenue: number }[];
}

interface CustomerReport {
  topBuyers: { email: string; name: string; orders: number; tickets: number; spent: number }[];
  customerStats: {
    newCustomers: number;
    returningCustomers: number;
    avgTicketsPerCustomer: number;
    avgSpentPerCustomer: number;
  };
}

interface ComparisonReport {
  events: {
    id: string; name: string; image: string; date: string; venue: string;
    ticketsSold: number; revenue: number; orders: number; avgOrderValue: number;
    checkedIn: number; checkinRate: number; vsAvgTickets: number; vsAvgRevenue: number;
  }[];
  averages: { avgTicketsPerEvent: number; avgRevenuePerEvent: number; totalEvents: number };
}

interface CouponReport {
  coupons: {
    id: string; code: string; discountType: string; discountValue: number;
    maxUses: number; timesUsed: number; totalDiscounted: number; revenueWithCoupon: number;
  }[];
  totalDiscounted: number;
}

async function fetchFinancialReport(params: { startDate: string; endDate: string }): Promise<FinancialReport> {
  const token = localStorage.getItem("auth_token");
  const queryParams = new URLSearchParams({ startDate: params.startDate, endDate: params.endDate });
  const response = await fetch(`${API_BASE_URL}/api/admin/reports/financial?${queryParams}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Error al cargar reporte financiero");
  return response.json();
}

async function fetchCustomerReport(params: { startDate: string; endDate: string }): Promise<CustomerReport> {
  const token = localStorage.getItem("auth_token");
  const queryParams = new URLSearchParams({ startDate: params.startDate, endDate: params.endDate });
  const response = await fetch(`${API_BASE_URL}/api/admin/reports/customers?${queryParams}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Error al cargar reporte de clientes");
  return response.json();
}

async function fetchComparisonReport(): Promise<ComparisonReport> {
  const token = localStorage.getItem("auth_token");
  const response = await fetch(`${API_BASE_URL}/api/admin/reports/comparison`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Error al cargar comparativa");
  return response.json();
}

async function fetchCouponReport(params: { startDate: string; endDate: string }): Promise<CouponReport> {
  const token = localStorage.getItem("auth_token");
  const queryParams = new URLSearchParams({ startDate: params.startDate, endDate: params.endDate });
  const response = await fetch(`${API_BASE_URL}/api/admin/reports/coupons?${queryParams}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Error al cargar reporte de cupones");
  return response.json();
}

async function fetchEvents() {
  const token = localStorage.getItem("auth_token");
  const response = await fetch(`${API_BASE_URL}/api/events?limit=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return [];
  const data = await response.json();
  return data.events || [];
}

async function exportReport(type: "csv" | "xlsx" | "pdf", reportType: string, params: any) {
  const token = localStorage.getItem("auth_token");
  const queryParams = new URLSearchParams({
    format: type,
    type: reportType,
    ...params,
  });

  const response = await fetch(`${API_BASE_URL}/api/admin/reports/export?${queryParams}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  
  if (!response.ok) throw new Error("Error al exportar reporte");
  
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `reporte-${reportType}-${format(new Date(), "yyyy-MM-dd")}.${type}`;
  a.click();
  window.URL.revokeObjectURL(url);
}

const COLORS = ["#06b6d4", "#8b5cf6", "#f43f5e", "#f59e0b", "#10b981", "#6366f1"];

export default function AdminReports() {
  const { config } = useAppConfig();
  
  const [activeTab, setActiveTab] = useState("sales");
  const [dateRange, setDateRange] = useState("month");
  const [eventFilter, setEventFilter] = useState("all");
  const [selectedEventForReport, setSelectedEventForReport] = useState("");
  
  // Calculate dates based on range
  const today = new Date();
  const getDateRange = () => {
    switch (dateRange) {
      case "week":
        return { start: format(subDays(today, 7), "yyyy-MM-dd"), end: format(today, "yyyy-MM-dd") };
      case "month":
        return { start: format(startOfMonth(today), "yyyy-MM-dd"), end: format(endOfMonth(today), "yyyy-MM-dd") };
      case "year":
        return { start: format(startOfYear(today), "yyyy-MM-dd"), end: format(today, "yyyy-MM-dd") };
      default:
        return { start: format(subDays(today, 30), "yyyy-MM-dd"), end: format(today, "yyyy-MM-dd") };
    }
  };

  const { start: startDate, end: endDate } = getDateRange();

  // Fetch events for filter
  const { data: events } = useQuery({
    queryKey: ["events-list"],
    queryFn: fetchEvents,
  });

  // Fetch sales report
  const { data: salesReport, isLoading: loadingSales, refetch: refetchSales } = useQuery({
    queryKey: ["sales-report", startDate, endDate, eventFilter],
    queryFn: () => fetchSalesReport({ startDate, endDate, eventId: eventFilter }),
    enabled: activeTab === "sales",
  });

  // Fetch check-in report
  const { data: checkinReport, isLoading: loadingCheckins, refetch: refetchCheckins } = useQuery({
    queryKey: ["checkin-report", startDate, endDate, eventFilter],
    queryFn: () => fetchCheckinReport({ startDate, endDate, eventId: eventFilter }),
    enabled: activeTab === "checkins",
  });

  // Fetch event report
  const { data: eventReport, isLoading: loadingEvent, refetch: refetchEvent } = useQuery({
    queryKey: ["event-report", selectedEventForReport],
    queryFn: () => fetchEventReport(selectedEventForReport),
    enabled: activeTab === "event" && !!selectedEventForReport,
  });

  // Fetch financial report
  const { data: financialReport, isLoading: loadingFinancial } = useQuery({
    queryKey: ["financial-report", startDate, endDate],
    queryFn: () => fetchFinancialReport({ startDate, endDate }),
    enabled: activeTab === "financial",
  });

  // Fetch customer report
  const { data: customerReport, isLoading: loadingCustomers } = useQuery({
    queryKey: ["customer-report", startDate, endDate],
    queryFn: () => fetchCustomerReport({ startDate, endDate }),
    enabled: activeTab === "customers",
  });

  // Fetch comparison report
  const { data: comparisonReport, isLoading: loadingComparison } = useQuery({
    queryKey: ["comparison-report"],
    queryFn: fetchComparisonReport,
    enabled: activeTab === "comparison",
  });

  // Fetch coupon report
  const { data: couponReport, isLoading: loadingCoupons } = useQuery({
    queryKey: ["coupon-report", startDate, endDate],
    queryFn: () => fetchCouponReport({ startDate, endDate }),
    enabled: activeTab === "coupons",
  });

  const handleExport = async (type: "csv" | "xlsx" | "pdf") => {
    try {
      await exportReport(type, activeTab, {
        startDate,
        endDate,
        eventId: activeTab === "event" ? selectedEventForReport : eventFilter,
      });
      toast.success("Reporte exportado correctamente");
    } catch (err) {
      toast.error("Error al exportar reporte");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Reportes</h1>
          <p className="text-white/60">Análisis detallado de ventas y operaciones</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-white/20" onClick={() => handleExport("csv")}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            CSV
          </Button>
          <Button variant="outline" className="border-white/20" onClick={() => handleExport("xlsx")}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Excel
          </Button>
          <Button variant="outline" className="border-white/20" onClick={() => handleExport("pdf")}>
            <FileText className="mr-2 h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-white/10 bg-white/5">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <Label className="text-white/60 text-xs">Período</Label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[150px] border-white/20 bg-white/5 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Última semana</SelectItem>
                  <SelectItem value="month">Este mes</SelectItem>
                  <SelectItem value="year">Este año</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-white/60 text-xs">Evento</Label>
              <Select value={eventFilter} onValueChange={setEventFilter}>
                <SelectTrigger className="w-[200px] border-white/20 bg-white/5 mt-1">
                  <SelectValue placeholder="Todos los eventos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los eventos</SelectItem>
                  {events?.map((event: any) => (
                    <SelectItem key={event.id} value={event.id}>{event.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="text-sm text-white/60 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {format(new Date(startDate), "dd MMM", { locale: es })} - {format(new Date(endDate), "dd MMM yyyy", { locale: es })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white/5 border border-white/10 flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="sales" className="data-[state=active]:bg-gold-500/20">
            <DollarSign className="mr-2 h-4 w-4" />
            Ventas
          </TabsTrigger>
          <TabsTrigger value="financial" className="data-[state=active]:bg-gold-500/20">
            <Wallet className="mr-2 h-4 w-4" />
            Financiero
          </TabsTrigger>
          <TabsTrigger value="checkins" className="data-[state=active]:bg-gold-500/20">
            <ScanLine className="mr-2 h-4 w-4" />
            Check-ins
          </TabsTrigger>
          <TabsTrigger value="customers" className="data-[state=active]:bg-gold-500/20">
            <Users className="mr-2 h-4 w-4" />
            Clientes
          </TabsTrigger>
          <TabsTrigger value="comparison" className="data-[state=active]:bg-gold-500/20">
            <BarChart3 className="mr-2 h-4 w-4" />
            Comparativa
          </TabsTrigger>
          <TabsTrigger value="coupons" className="data-[state=active]:bg-gold-500/20">
            <Tag className="mr-2 h-4 w-4" />
            Cupones
          </TabsTrigger>
          <TabsTrigger value="event" className="data-[state=active]:bg-gold-500/20">
            <PieChartIcon className="mr-2 h-4 w-4" />
            Por Evento
          </TabsTrigger>
        </TabsList>

        {/* Sales Report */}
        <TabsContent value="sales" className="space-y-6 mt-6">
          {loadingSales ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-gold-400" />
            </div>
          ) : salesReport ? (
            <>
              {/* KPIs */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card className="border-white/10 bg-white/5">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-emerald-500/20 p-3">
                        <DollarSign className="h-5 w-5 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-white">
                          {formatPrice(salesReport.totalRevenue, config.currency)}
                        </p>
                        <p className="text-sm text-white/60">Ingresos totales</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-white/10 bg-white/5">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-gold-500/20 p-3">
                        <Ticket className="h-5 w-5 text-gold-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-white">{salesReport.totalTickets}</p>
                        <p className="text-sm text-white/60">Boletos vendidos</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-white/10 bg-white/5">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-amber-500/20 p-3">
                        <Users className="h-5 w-5 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-white">{salesReport.totalOrders}</p>
                        <p className="text-sm text-white/60">Órdenes</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-white/10 bg-white/5">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-amber-500/20 p-3">
                        <TrendingUp className="h-5 w-5 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-white">
                          {formatPrice(salesReport.averageOrderValue, config.currency)}
                        </p>
                        <p className="text-sm text-white/60">Ticket promedio</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts */}
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Sales Over Time */}
                <Card className="border-white/10 bg-white/5">
                  <CardHeader>
                    <CardTitle className="text-white text-lg">Ventas por día</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={salesReport.salesByDay}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis
                            dataKey="date"
                            stroke="#94a3b8"
                            fontSize={12}
                            tickFormatter={(v) => format(new Date(v), "dd/MM")}
                          />
                          <YAxis stroke="#94a3b8" fontSize={12} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#1e293b",
                              border: "1px solid rgba(255,255,255,0.1)",
                              borderRadius: "8px",
                            }}
                            formatter={(value: number) => formatPrice(value, config.currency)}
                            labelFormatter={(v) => format(new Date(v), "PPP", { locale: es })}
                          />
                          <Area
                            type="monotone"
                            dataKey="revenue"
                            stroke="#06b6d4"
                            fill="#06b6d4"
                            fillOpacity={0.2}
                            name="Ingresos"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Sales by Event */}
                <Card className="border-white/10 bg-white/5">
                  <CardHeader>
                    <CardTitle className="text-white text-lg">Ventas por evento</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={salesReport.salesByEvent}
                            dataKey="revenue"
                            nameKey="eventName"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            label={({ eventName, percent }) =>
                              `${eventName.slice(0, 15)}... (${(percent * 100).toFixed(0)}%)`
                            }
                          >
                            {salesReport.salesByEvent.map((_, index) => (
                              <Cell key={index} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number) => formatPrice(value, config.currency)}
                            contentStyle={{
                              backgroundColor: "#1e293b",
                              border: "1px solid rgba(255,255,255,0.1)",
                              borderRadius: "8px",
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Payment Methods */}
                <Card className="border-white/10 bg-white/5 lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-white text-lg">Métodos de pago</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={salesReport.salesByPaymentMethod} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis type="number" stroke="#94a3b8" />
                          <YAxis dataKey="method" type="category" stroke="#94a3b8" width={100} />
                          <Tooltip
                            formatter={(value: number) => formatPrice(value, config.currency)}
                            contentStyle={{
                              backgroundColor: "#1e293b",
                              border: "1px solid rgba(255,255,255,0.1)",
                              borderRadius: "8px",
                            }}
                          />
                          <Bar dataKey="revenue" fill="#06b6d4" name="Ingresos" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card className="border-white/10 bg-white/5">
              <CardContent className="py-12 text-center text-white/60">
                No hay datos disponibles para el período seleccionado
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Check-in Report */}
        <TabsContent value="checkins" className="space-y-6 mt-6">
          {loadingCheckins ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-gold-400" />
            </div>
          ) : checkinReport ? (
            <>
              {/* KPIs */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-white/10 bg-white/5">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-emerald-500/20 p-3">
                        <ScanLine className="h-5 w-5 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-white">{checkinReport.totalCheckins}</p>
                        <p className="text-sm text-white/60">Check-ins totales</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-white/10 bg-white/5">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-gold-500/20 p-3">
                        <TrendingUp className="h-5 w-5 text-gold-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-white">{checkinReport.checkinRate}%</p>
                        <p className="text-sm text-white/60">Tasa de asistencia</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-white/10 bg-white/5">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-rose-500/20 p-3">
                        <Users className="h-5 w-5 text-rose-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-white">{checkinReport.noShowRate}%</p>
                        <p className="text-sm text-white/60">No-shows</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                {/* Check-ins by Hour */}
                <Card className="border-white/10 bg-white/5">
                  <CardHeader>
                    <CardTitle className="text-white text-lg">Check-ins por hora</CardTitle>
                    <CardDescription>Distribución horaria de entradas</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={checkinReport.checkinsByHour}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis
                            dataKey="hour"
                            stroke="#94a3b8"
                            tickFormatter={(h) => `${h}:00`}
                          />
                          <YAxis stroke="#94a3b8" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#1e293b",
                              border: "1px solid rgba(255,255,255,0.1)",
                              borderRadius: "8px",
                            }}
                            labelFormatter={(h) => `${h}:00 - ${h}:59`}
                          />
                          <Bar dataKey="count" fill="#10b981" name="Check-ins" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Check-ins by Event */}
                <Card className="border-white/10 bg-white/5">
                  <CardHeader>
                    <CardTitle className="text-white text-lg">Asistencia por evento</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4 max-h-[300px] overflow-y-auto">
                      {checkinReport.checkinsByEvent.map((event) => {
                        const rate = event.total > 0 ? (event.checkedIn / event.total) * 100 : 0;
                        return (
                          <div key={event.eventId} className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-white truncate max-w-[200px]">{event.eventName}</span>
                              <span className="text-white/60">
                                {event.checkedIn}/{event.total} ({rate.toFixed(0)}%)
                              </span>
                            </div>
                            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full transition-all"
                                style={{ width: `${rate}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card className="border-white/10 bg-white/5">
              <CardContent className="py-12 text-center text-white/60">
                No hay datos de check-in disponibles
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Event Report */}
        <TabsContent value="event" className="space-y-6 mt-6">
          <Card className="border-white/10 bg-white/5">
            <CardContent className="pt-6">
              <div className="flex gap-4 items-end">
                <div className="flex-1 max-w-md">
                  <Label className="text-white/60 text-xs">Seleccionar evento</Label>
                  <Select value={selectedEventForReport} onValueChange={setSelectedEventForReport}>
                    <SelectTrigger className="border-white/20 bg-white/5 mt-1">
                      <SelectValue placeholder="Selecciona un evento para ver su reporte" />
                    </SelectTrigger>
                    <SelectContent>
                      {events?.map((event: any) => (
                        <SelectItem key={event.id} value={event.id}>{event.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedEventForReport && (
                  <Button variant="outline" onClick={() => refetchEvent()} className="border-white/20">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Actualizar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {loadingEvent ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-gold-400" />
            </div>
          ) : eventReport ? (
            <>
              <Card className="border-white/10 bg-white/5">
                <CardHeader>
                  <CardTitle className="text-white">{eventReport.eventName}</CardTitle>
                  <CardDescription>Reporte detallado por sesión y zona</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Sessions Table */}
                    <div>
                      <h3 className="text-sm font-medium text-white mb-3">Sesiones</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-white/10 text-white/60">
                              <th className="text-left p-2">Fecha</th>
                              <th className="text-right p-2">Capacidad</th>
                              <th className="text-right p-2">Vendidos</th>
                              <th className="text-right p-2">Check-ins</th>
                              <th className="text-right p-2">Ingresos</th>
                              <th className="text-right p-2">Ocupación</th>
                            </tr>
                          </thead>
                          <tbody>
                            {eventReport.sessions.map((session) => (
                              <tr key={session.sessionId} className="border-b border-white/5">
                                <td className="p-2 text-white">
                                  {format(new Date(session.date), "PPP HH:mm", { locale: es })}
                                </td>
                                <td className="p-2 text-right text-white/60">{session.capacity}</td>
                                <td className="p-2 text-right text-white">{session.sold}</td>
                                <td className="p-2 text-right text-emerald-400">{session.checkedIn}</td>
                                <td className="p-2 text-right text-white">
                                  {formatPrice(session.revenue, config.currency)}
                                </td>
                                <td className="p-2 text-right">
                                  <Badge className={
                                    session.capacity > 0 && (session.sold / session.capacity) > 0.8
                                      ? "bg-emerald-500/20 text-emerald-400"
                                      : "bg-amber-500/20 text-amber-400"
                                  }>
                                    {session.capacity > 0
                                      ? `${((session.sold / session.capacity) * 100).toFixed(0)}%`
                                      : "N/A"}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <Separator className="bg-white/10" />

                    {/* By Zone */}
                    {eventReport.byZone.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-white mb-3">Por zona</h3>
                        <div className="h-[250px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={eventReport.byZone}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                              <XAxis dataKey="zoneName" stroke="#94a3b8" />
                              <YAxis stroke="#94a3b8" />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "#1e293b",
                                  border: "1px solid rgba(255,255,255,0.1)",
                                  borderRadius: "8px",
                                }}
                              />
                              <Bar dataKey="sold" fill="#06b6d4" name="Vendidos" />
                              <Bar dataKey="capacity" fill="#334155" name="Capacidad" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {/* By Tier */}
                    {eventReport.byTier.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-white mb-3">Por tipo de boleto</h3>
                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                          {eventReport.byTier.map((tier) => (
                            <Card key={tier.tierId} className="border-white/10 bg-white/5">
                              <CardContent className="p-4">
                                <p className="font-medium text-white">{tier.tierName}</p>
                                <p className="text-sm text-white/60 mb-2">
                                  {formatPrice(tier.price, config.currency)} por boleto
                                </p>
                                <div className="flex justify-between text-sm">
                                  <span className="text-white/60">Vendidos:</span>
                                  <span className="text-white">{tier.sold}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-white/60">Ingresos:</span>
                                  <span className="text-emerald-400">
                                    {formatPrice(tier.revenue, config.currency)}
                                  </span>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : selectedEventForReport ? (
            <Card className="border-white/10 bg-white/5">
              <CardContent className="py-12 text-center text-white/60">
                No hay datos disponibles para este evento
              </CardContent>
            </Card>
          ) : (
            <Card className="border-white/10 bg-white/5">
              <CardContent className="py-12 text-center text-white/60">
                <PieChartIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                Selecciona un evento para ver su reporte detallado
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Financial Report */}
        <TabsContent value="financial" className="space-y-6 mt-6">
          {loadingFinancial ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-gold-400" />
            </div>
          ) : financialReport ? (
            <>
              {/* Financial KPIs */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-white/10 bg-white/5">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-emerald-500/20 p-3">
                        <DollarSign className="h-5 w-5 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-emerald-400">
                          {formatPrice(financialReport.summary.grossRevenue, config.currency)}
                        </p>
                        <p className="text-sm text-white/60">Ingresos brutos</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-white/10 bg-white/5">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-gold-500/20 p-3">
                        <Wallet className="h-5 w-5 text-gold-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gold-400">
                          {formatPrice(financialReport.summary.feesCollected, config.currency)}
                        </p>
                        <p className="text-sm text-white/60">Fees cobrados</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-white/10 bg-white/5">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-rose-500/20 p-3">
                        <ArrowDownRight className="h-5 w-5 text-rose-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-rose-400">
                          {formatPrice(financialReport.summary.refundsAmount, config.currency)}
                        </p>
                        <p className="text-sm text-white/60">{financialReport.summary.refundsCount} reembolsos</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-white/10 bg-white/5">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-amber-500/20 p-3">
                        <ArrowUpRight className="h-5 w-5 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-amber-400">
                          {formatPrice(financialReport.summary.netRevenue, config.currency)}
                        </p>
                        <p className="text-sm text-white/60">Ingreso neto</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                {/* Payment Methods */}
                <Card className="border-white/10 bg-white/5">
                  <CardHeader>
                    <CardTitle className="text-white text-lg">Por método de pago</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={financialReport.paymentMethods}
                            dataKey="amount"
                            nameKey="method"
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            label={(entry) => entry.method}
                          >
                            {financialReport.paymentMethods.map((_, i) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number) => formatPrice(value, config.currency)}
                            contentStyle={{ backgroundColor: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Revenue by Event */}
                <Card className="border-white/10 bg-white/5">
                  <CardHeader>
                    <CardTitle className="text-white text-lg">Ingresos por evento</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-[250px] overflow-y-auto">
                      {financialReport.revenueByEvent.map((event, i) => (
                        <div key={event.id} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                              style={{ backgroundColor: `${COLORS[i % COLORS.length]}30`, color: COLORS[i % COLORS.length] }}>
                              {i + 1}
                            </div>
                            <div>
                              <p className="text-white text-sm font-medium truncate max-w-[150px]">{event.name}</p>
                              <p className="text-white/60 text-xs">{event.tickets} boletos</p>
                            </div>
                          </div>
                          <p className="text-emerald-400 font-medium">{formatPrice(event.revenue, config.currency)}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Discounts & Cancelled */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-amber-500/20 bg-amber-500/5">
                  <CardContent className="pt-6 text-center">
                    <Tag className="h-8 w-8 text-amber-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-amber-400">
                      {formatPrice(financialReport.summary.discountsApplied, config.currency)}
                    </p>
                    <p className="text-sm text-white/60">Descuentos aplicados</p>
                  </CardContent>
                </Card>
                <Card className="border-rose-500/20 bg-rose-500/5">
                  <CardContent className="pt-6 text-center">
                    <RefreshCw className="h-8 w-8 text-rose-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-rose-400">{financialReport.summary.refundsCount}</p>
                    <p className="text-sm text-white/60">Órdenes reembolsadas</p>
                  </CardContent>
                </Card>
                <Card className="border-white/50/20 bg-white/50/5">
                  <CardContent className="pt-6 text-center">
                    <TrendingDown className="h-8 w-8 text-white/60 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-white/60">{financialReport.summary.cancelledCount}</p>
                    <p className="text-sm text-white/60">Órdenes canceladas</p>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card className="border-white/10 bg-white/5">
              <CardContent className="py-12 text-center text-white/60">
                No hay datos financieros disponibles
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Customer Report */}
        <TabsContent value="customers" className="space-y-6 mt-6">
          {loadingCustomers ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-gold-400" />
            </div>
          ) : customerReport ? (
            <>
              {/* Customer Stats */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card className="border-white/10 bg-white/5">
                  <CardContent className="pt-6 text-center">
                    <Users className="h-8 w-8 text-gold-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-white">{customerReport.customerStats.newCustomers}</p>
                    <p className="text-sm text-white/60">Clientes nuevos</p>
                  </CardContent>
                </Card>
                <Card className="border-white/10 bg-white/5">
                  <CardContent className="pt-6 text-center">
                    <RefreshCw className="h-8 w-8 text-amber-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-white">{customerReport.customerStats.returningCustomers}</p>
                    <p className="text-sm text-white/60">Clientes recurrentes</p>
                  </CardContent>
                </Card>
                <Card className="border-white/10 bg-white/5">
                  <CardContent className="pt-6 text-center">
                    <Ticket className="h-8 w-8 text-pink-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-white">{customerReport.customerStats.avgTicketsPerCustomer}</p>
                    <p className="text-sm text-white/60">Boletos/cliente</p>
                  </CardContent>
                </Card>
                <Card className="border-white/10 bg-white/5">
                  <CardContent className="pt-6 text-center">
                    <DollarSign className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-white">
                      {formatPrice(customerReport.customerStats.avgSpentPerCustomer, config.currency)}
                    </p>
                    <p className="text-sm text-white/60">Gasto promedio</p>
                  </CardContent>
                </Card>
              </div>

              {/* Top Buyers Table */}
              <Card className="border-white/10 bg-white/5">
                <CardHeader>
                  <CardTitle className="text-white text-lg flex items-center gap-2">
                    <Crown className="h-5 w-5 text-amber-400" />
                    Top compradores
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10">
                        <TableHead className="text-white/60">#</TableHead>
                        <TableHead className="text-white/60">Cliente</TableHead>
                        <TableHead className="text-white/60 text-center">Órdenes</TableHead>
                        <TableHead className="text-white/60 text-center">Boletos</TableHead>
                        <TableHead className="text-white/60 text-right">Total gastado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customerReport.topBuyers.slice(0, 10).map((buyer, i) => (
                        <TableRow key={buyer.email} className="border-white/10">
                          <TableCell>
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                              style={{ backgroundColor: i < 3 ? `${COLORS[i]}30` : "#334155", color: i < 3 ? COLORS[i] : "#94a3b8" }}>
                              {i + 1}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-white font-medium">{buyer.name}</p>
                              <p className="text-white/60 text-xs">{buyer.email}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-center text-white">{buyer.orders}</TableCell>
                          <TableCell className="text-center text-white">{buyer.tickets}</TableCell>
                          <TableCell className="text-right text-emerald-400 font-medium">
                            {formatPrice(buyer.spent, config.currency)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="border-white/10 bg-white/5">
              <CardContent className="py-12 text-center text-white/60">
                No hay datos de clientes disponibles
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Comparison Report */}
        <TabsContent value="comparison" className="space-y-6 mt-6">
          {loadingComparison ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-gold-400" />
            </div>
          ) : comparisonReport && comparisonReport.events.length > 0 ? (
            <>
              {/* Averages */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-white/10 bg-white/5">
                  <CardContent className="pt-6 text-center">
                    <Calendar className="h-8 w-8 text-gold-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-white">{comparisonReport.averages.totalEvents}</p>
                    <p className="text-sm text-white/60">Eventos analizados</p>
                  </CardContent>
                </Card>
                <Card className="border-white/10 bg-white/5">
                  <CardContent className="pt-6 text-center">
                    <Ticket className="h-8 w-8 text-amber-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-white">{comparisonReport.averages.avgTicketsPerEvent}</p>
                    <p className="text-sm text-white/60">Boletos promedio/evento</p>
                  </CardContent>
                </Card>
                <Card className="border-white/10 bg-white/5">
                  <CardContent className="pt-6 text-center">
                    <DollarSign className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-white">
                      {formatPrice(comparisonReport.averages.avgRevenuePerEvent, config.currency)}
                    </p>
                    <p className="text-sm text-white/60">Ingreso promedio/evento</p>
                  </CardContent>
                </Card>
              </div>

              {/* Events Comparison */}
              <Card className="border-white/10 bg-white/5">
                <CardHeader>
                  <CardTitle className="text-white text-lg">Comparativa de eventos</CardTitle>
                  <CardDescription>Últimos 10 eventos con ventas</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-white/10">
                          <TableHead className="text-white/60">Evento</TableHead>
                          <TableHead className="text-white/60 text-center">Boletos</TableHead>
                          <TableHead className="text-white/60 text-center">vs Promedio</TableHead>
                          <TableHead className="text-white/60 text-right">Ingresos</TableHead>
                          <TableHead className="text-white/60 text-center">Check-in</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {comparisonReport.events.map((event) => (
                          <TableRow key={event.id} className="border-white/10">
                            <TableCell>
                              <div className="flex items-center gap-3">
                                {event.image && (
                                  <img src={`${API_BASE_URL}${event.image}`} alt="" className="w-10 h-10 rounded object-cover" />
                                )}
                                <div>
                                  <p className="text-white font-medium">{event.name}</p>
                                  <p className="text-white/60 text-xs">{event.venue}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center text-white">{event.ticketsSold}</TableCell>
                            <TableCell className="text-center">
                              <Badge className={event.vsAvgTickets >= 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}>
                                {event.vsAvgTickets >= 0 ? "+" : ""}{event.vsAvgTickets}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-emerald-400 font-medium">
                              {formatPrice(event.revenue, config.currency)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className={event.checkinRate >= 70 ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}>
                                {event.checkinRate}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Comparison Chart */}
              <Card className="border-white/10 bg-white/5">
                <CardHeader>
                  <CardTitle className="text-white text-lg">Gráfica comparativa</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={comparisonReport.events}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                        <YAxis stroke="#94a3b8" />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                          formatter={(value: number, name: string) => [
                            name === "revenue" ? formatPrice(value, config.currency) : value,
                            name === "revenue" ? "Ingresos" : "Boletos"
                          ]}
                        />
                        <Legend />
                        <Bar dataKey="ticketsSold" fill="#06b6d4" name="Boletos" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="border-white/10 bg-white/5">
              <CardContent className="py-12 text-center text-white/60">
                No hay suficientes eventos para comparar
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Coupons Report */}
        <TabsContent value="coupons" className="space-y-6 mt-6">
          {loadingCoupons ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-gold-400" />
            </div>
          ) : couponReport ? (
            <>
              {/* Total Discounted */}
              <Card className="border-amber-500/20 bg-amber-500/5">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="rounded-xl bg-amber-500/20 p-4">
                        <Tag className="h-8 w-8 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-amber-400">
                          {formatPrice(couponReport.totalDiscounted, config.currency)}
                        </p>
                        <p className="text-white/60">Total descontado en el período</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Coupons Table */}
              <Card className="border-white/10 bg-white/5">
                <CardHeader>
                  <CardTitle className="text-white text-lg">Uso de cupones</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10">
                        <TableHead className="text-white/60">Código</TableHead>
                        <TableHead className="text-white/60">Descuento</TableHead>
                        <TableHead className="text-white/60 text-center">Usos</TableHead>
                        <TableHead className="text-white/60 text-right">Descontado</TableHead>
                        <TableHead className="text-white/60 text-right">Ingresos generados</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {couponReport.coupons.map((coupon) => (
                        <TableRow key={coupon.id} className="border-white/10">
                          <TableCell>
                            <Badge className="bg-amber-500/20 text-amber-400 font-mono">{coupon.code}</Badge>
                          </TableCell>
                          <TableCell className="text-white">
                            {coupon.discountType === "PERCENTAGE" 
                              ? `${coupon.discountValue}%` 
                              : formatPrice(coupon.discountValue, config.currency)}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-white">{coupon.timesUsed}</span>
                            {coupon.maxUses && (
                              <span className="text-white/60">/{coupon.maxUses}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-amber-400">
                            {formatPrice(coupon.totalDiscounted, config.currency)}
                          </TableCell>
                          <TableCell className="text-right text-emerald-400 font-medium">
                            {formatPrice(coupon.revenueWithCoupon, config.currency)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {couponReport.coupons.length === 0 && (
                    <p className="text-center text-white/60 py-8">No hay cupones utilizados en este período</p>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="border-white/10 bg-white/5">
              <CardContent className="py-12 text-center text-white/60">
                No hay datos de cupones disponibles
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}