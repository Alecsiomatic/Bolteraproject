/**
 * Panel de Gestión de Órdenes
 * 
 * Lista, búsqueda, filtrado y acciones sobre órdenes de compra
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppConfig, formatPrice } from "@/hooks/useAppConfig";
import { toast } from "sonner";
import { format, isValid, parseISO } from "date-fns";
import { es } from "date-fns/locale";

// Helper para formatear fechas de forma segura
function safeFormatDate(dateValue: string | null | undefined, formatStr: string, options?: { locale?: typeof es }): string {
  if (!dateValue) return "—";
  try {
    const date = typeof dateValue === 'string' ? parseISO(dateValue) : new Date(dateValue);
    if (!isValid(date)) return "—";
    return format(date, formatStr, options);
  } catch {
    return "—";
  }
}
import {
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  RefreshCw,
  Receipt,
  Ticket,
  User,
  Mail,
  Calendar,
  CreditCard,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Download,
  Send,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api-base";

interface Order {
  id: string;
  orderNumber: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string | null;
  total: number;
  subtotal: number;
  serviceFee: number;
  discount: number;
  couponCode: string | null;
  status: "PENDING" | "COMPLETED" | "CANCELLED" | "REFUNDED";
  paymentMethod: string | null;
  paymentId: string | null;
  eventId: string;
  eventName: string;
  sessionId: string;
  sessionDate: string;
  ticketCount: number;
  createdAt: string;
  tickets?: OrderTicket[];
}

interface OrderTicket {
  id: string;
  code: string;
  status: string;
  price: number;
  seatLabel: string | null;
  tierLabel: string | null;
  checkedInAt: string | null;
}

interface OrdersResponse {
  success: boolean;
  orders: Order[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

async function fetchOrders(params: {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  eventId?: string;
}): Promise<OrdersResponse> {
  const token = localStorage.getItem("auth_token");
  const queryParams = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.search) queryParams.set("search", params.search);
  if (params.status && params.status !== "all") queryParams.set("status", params.status);
  if (params.eventId && params.eventId !== "all") queryParams.set("eventId", params.eventId);

  const response = await fetch(`${API_BASE_URL}/api/admin/orders?${queryParams}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Error al cargar órdenes");
  return response.json();
}

async function fetchOrderDetail(orderId: string): Promise<Order> {
  const token = localStorage.getItem("auth_token");
  const response = await fetch(`${API_BASE_URL}/api/admin/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Error al cargar orden");
  const data = await response.json();
  return data.order;
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

async function processRefund(orderId: string, ticketIds?: string[]) {
  const token = localStorage.getItem("auth_token");
  const response = await fetch(`${API_BASE_URL}/api/payments/refund`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ orderId, ticketIds }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Error al procesar reembolso");
  }
  return response.json();
}

async function resendTickets(orderId: string) {
  const token = localStorage.getItem("auth_token");
  const response = await fetch(`${API_BASE_URL}/api/admin/orders/${orderId}/resend`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Error al reenviar boletos");
  }
  return response.json();
}

const statusConfig = {
  PENDING: { label: "Pendiente", color: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: Clock },
  COMPLETED: { label: "Completada", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
  CANCELLED: { label: "Cancelada", color: "bg-white/50/20 text-white/60 border-white/50/30", icon: XCircle },
  REFUNDED: { label: "Reembolsada", color: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: RefreshCw },
};

export default function AdminOrders() {
  const { config } = useAppConfig();
  const queryClient = useQueryClient();
  
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [eventFilter, setEventFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  
  const limit = 20;

  // Fetch orders
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-orders", page, search, statusFilter, eventFilter],
    queryFn: () => fetchOrders({ page, limit, search, status: statusFilter, eventId: eventFilter }),
  });

  // Fetch events for filter
  const { data: events } = useQuery({
    queryKey: ["events-list"],
    queryFn: fetchEvents,
  });

  // Fetch order detail
  const { data: orderDetail, isLoading: detailLoading } = useQuery({
    queryKey: ["order-detail", selectedOrder?.id],
    queryFn: () => fetchOrderDetail(selectedOrder!.id),
    enabled: !!selectedOrder && showDetail,
  });

  // Refund mutation
  const refundMutation = useMutation({
    mutationFn: () => processRefund(selectedOrder!.id),
    onSuccess: () => {
      toast.success("Reembolso procesado correctamente");
      setShowRefundDialog(false);
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["order-detail", selectedOrder?.id] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // Resend tickets mutation
  const resendMutation = useMutation({
    mutationFn: () => resendTickets(selectedOrder!.id),
    onSuccess: () => {
      toast.success("Boletos reenviados correctamente");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    refetch();
  };

  const orders = data?.orders || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Órdenes</h1>
          <p className="text-white/60">Gestiona todas las órdenes de compra</p>
        </div>
        <Button variant="outline" onClick={() => refetch()} className="border-white/20">
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar
        </Button>
      </div>

      {/* Filters */}
      <Card className="border-white/10 bg-white/5">
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" />
                <Input
                  placeholder="Buscar por número, nombre o email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 border-white/20 bg-white/5"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[160px] border-white/20 bg-white/5">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="PENDING">Pendiente</SelectItem>
                <SelectItem value="COMPLETED">Completada</SelectItem>
                <SelectItem value="CANCELLED">Cancelada</SelectItem>
                <SelectItem value="REFUNDED">Reembolsada</SelectItem>
              </SelectContent>
            </Select>

            <Select value={eventFilter} onValueChange={(v) => { setEventFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[200px] border-white/20 bg-white/5">
                <SelectValue placeholder="Evento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los eventos</SelectItem>
                {events?.map((event: any) => (
                  <SelectItem key={event.id} value={event.id}>{event.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button type="submit" className="bg-gold-500 hover:bg-gold-600">
              <Filter className="mr-2 h-4 w-4" />
              Filtrar
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card className="border-white/10 bg-white/5">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-gold-400" />
            </div>
          ) : orders.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-white/60">
              <Receipt className="h-12 w-12 mb-4 opacity-50" />
              <p>No se encontraron órdenes</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 text-left text-sm text-white/60">
                    <th className="p-4 font-medium">Orden</th>
                    <th className="p-4 font-medium">Cliente</th>
                    <th className="p-4 font-medium">Evento</th>
                    <th className="p-4 font-medium">Boletos</th>
                    <th className="p-4 font-medium">Total</th>
                    <th className="p-4 font-medium">Estado</th>
                    <th className="p-4 font-medium">Fecha</th>
                    <th className="p-4 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const StatusIcon = statusConfig[order.status]?.icon || Clock;
                    return (
                      <tr
                        key={order.id}
                        className="border-b border-white/5 hover:bg-white/5 transition-colors"
                      >
                        <td className="p-4">
                          <span className="font-mono text-sm text-gold-400">{order.orderNumber}</span>
                        </td>
                        <td className="p-4">
                          <div>
                            <p className="font-medium text-white">{order.buyerName}</p>
                            <p className="text-sm text-white/60">{order.buyerEmail}</p>
                          </div>
                        </td>
                        <td className="p-4">
                          <div>
                            <p className="text-white">{order.eventName || "—"}</p>
                            <p className="text-sm text-white/60">
                              {safeFormatDate(order.sessionDate, "dd MMM yyyy HH:mm", { locale: es })}
                            </p>
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge variant="outline" className="border-white/20">
                            {order.ticketCount} boleto{order.ticketCount !== 1 ? "s" : ""}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <span className="font-semibold text-white">
                            {formatPrice(order.total, config.currency)}
                          </span>
                        </td>
                        <td className="p-4">
                          <Badge className={statusConfig[order.status]?.color}>
                            <StatusIcon className="mr-1 h-3 w-3" />
                            {statusConfig[order.status]?.label}
                          </Badge>
                        </td>
                        <td className="p-4 text-sm text-white/60">
                          {safeFormatDate(order.createdAt, "dd/MM/yy HH:mm")}
                        </td>
                        <td className="p-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setSelectedOrder(order); setShowDetail(true); }}>
                                <Eye className="mr-2 h-4 w-4" />
                                Ver detalle
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setSelectedOrder(order); resendMutation.mutate(); }}>
                                <Send className="mr-2 h-4 w-4" />
                                Reenviar boletos
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <a href={`${API_BASE_URL}/api/tickets/order/${order.id}/download`} target="_blank">
                                  <Download className="mr-2 h-4 w-4" />
                                  Descargar PDF
                                </a>
                              </DropdownMenuItem>
                              {order.status === "COMPLETED" && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => { setSelectedOrder(order); setShowRefundDialog(true); }}
                                    className="text-rose-400"
                                  >
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Procesar reembolso
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-white/10 p-4">
              <p className="text-sm text-white/60">
                Mostrando {(page - 1) * limit + 1} - {Math.min(page * limit, pagination.total)} de {pagination.total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p - 1)}
                  disabled={page === 1}
                  className="border-white/20"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page === pagination.totalPages}
                  className="border-white/20"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Detail Dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-2xl bg-[#0a0a0a] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">
              Orden {selectedOrder?.orderNumber}
            </DialogTitle>
            <DialogDescription>
              Detalle completo de la orden
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-gold-400" />
            </div>
          ) : orderDetail ? (
            <div className="space-y-6">
              {/* Customer Info */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm text-white/60">Cliente</p>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-white/60" />
                    <span className="text-white">{orderDetail.buyerName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-white/60" />
                    <span className="text-white/70">{orderDetail.buyerEmail}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-white/60">Evento</p>
                  <p className="text-white">{orderDetail.eventName || "—"}</p>
                  <div className="flex items-center gap-2 text-white/70">
                    <Calendar className="h-4 w-4" />
                    {safeFormatDate(orderDetail.sessionDate, "PPP HH:mm", { locale: es })}
                  </div>
                </div>
              </div>

              <Separator className="bg-white/10" />

              {/* Tickets */}
              <div>
                <p className="text-sm text-white/60 mb-3">Boletos ({orderDetail.tickets?.length || 0})</p>
                <div className="space-y-2">
                  {orderDetail.tickets?.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="flex items-center justify-between rounded-lg bg-white/5 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <Ticket className="h-4 w-4 text-gold-400" />
                        <div>
                          <span className="font-mono text-sm text-white">{ticket.code}</span>
                          {ticket.seatLabel && (
                            <span className="ml-2 text-sm text-white/60">• {ticket.seatLabel}</span>
                          )}
                          {ticket.tierLabel && (
                            <span className="ml-2 text-sm text-white/60">• {ticket.tierLabel}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-white/70">
                          {formatPrice(ticket.price, config.currency)}
                        </span>
                        <Badge
                          className={
                            ticket.checkedInAt
                              ? "bg-emerald-500/20 text-emerald-400"
                              : ticket.status === "CANCELLED"
                              ? "bg-rose-500/20 text-rose-400"
                              : "bg-white/50/20 text-white/60"
                          }
                        >
                          {ticket.checkedInAt ? "Check-in" : ticket.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator className="bg-white/10" />

              {/* Totals */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Subtotal</span>
                  <span className="text-white">{formatPrice(orderDetail.subtotal, config.currency)}</span>
                </div>
                {orderDetail.serviceFee > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Cargo por servicio</span>
                    <span className="text-white">{formatPrice(orderDetail.serviceFee, config.currency)}</span>
                  </div>
                )}
                {orderDetail.discount > 0 && (
                  <div className="flex justify-between text-sm text-emerald-400">
                    <span>Descuento {orderDetail.couponCode && `(${orderDetail.couponCode})`}</span>
                    <span>-{formatPrice(orderDetail.discount, config.currency)}</span>
                  </div>
                )}
                <Separator className="bg-white/10" />
                <div className="flex justify-between text-lg font-semibold">
                  <span className="text-white">Total</span>
                  <span className="text-gold-400">{formatPrice(orderDetail.total, config.currency)}</span>
                </div>
              </div>

              {/* Payment Info */}
              {orderDetail.paymentMethod && (
                <div className="rounded-lg bg-white/5 p-4">
                  <div className="flex items-center gap-2 text-sm">
                    <CreditCard className="h-4 w-4 text-white/60" />
                    <span className="text-white/60">Método de pago:</span>
                    <span className="text-white">{orderDetail.paymentMethod}</span>
                  </div>
                  {orderDetail.paymentId && (
                    <p className="mt-1 text-xs text-white/50">ID: {orderDetail.paymentId}</p>
                  )}
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetail(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund Confirmation Dialog */}
      <Dialog open={showRefundDialog} onOpenChange={setShowRefundDialog}>
        <DialogContent className="bg-[#0a0a0a] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Confirmar Reembolso</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de procesar el reembolso de la orden {selectedOrder?.orderNumber}?
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-4">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-400 flex-shrink-0" />
              <div className="text-sm text-amber-200">
                <p className="font-medium">Se reembolsará:</p>
                <p className="mt-1">
                  {formatPrice(selectedOrder?.total || 0, config.currency)} a {selectedOrder?.buyerEmail}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRefundDialog(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => refundMutation.mutate()}
              disabled={refundMutation.isPending}
            >
              {refundMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Procesar Reembolso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
