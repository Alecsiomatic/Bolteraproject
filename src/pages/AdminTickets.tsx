/**
 * Panel de Gestión de Boletos
 * 
 * Lista, búsqueda, invalidación y reenvío de boletos
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
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  RefreshCw,
  Ticket,
  User,
  Mail,
  Calendar,
  MapPin,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Download,
  Send,
  Ban,
  QrCode,
  ChevronLeft,
  ChevronRight,
  ScanLine,
} from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

interface TicketItem {
  id: string;
  code: string;
  status: "RESERVED" | "CONFIRMED" | "USED" | "CANCELLED" | "TRANSFERRED" | "SOLD";
  price: number;
  fee: number;
  seatId: string | null;
  seatLabel: string | null;
  rowLabel: string | null;
  zoneId: string | null;
  zoneName: string | null;
  tierId: string | null;
  tierLabel: string | null;
  buyerName: string;
  buyerEmail: string;
  orderId: string;
  orderNumber: string;
  eventId: string;
  eventName: string;
  sessionId: string;
  sessionDate: string;
  venueName: string | null;
  checkedInAt: string | null;
  checkedInBy: string | null;
  transferredAt: string | null;
  transferredTo: string | null;
  createdAt: string;
  isCourtesy?: boolean;
}

interface TicketsResponse {
  success: boolean;
  tickets: TicketItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

async function fetchTickets(params: {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  eventId?: string;
}): Promise<TicketsResponse> {
  const token = localStorage.getItem("auth_token");
  const queryParams = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.search) queryParams.set("search", params.search);
  if (params.status && params.status !== "all") queryParams.set("status", params.status);
  if (params.eventId && params.eventId !== "all") queryParams.set("eventId", params.eventId);

  const response = await fetch(`${API_BASE_URL}/api/admin/tickets?${queryParams}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Error al cargar boletos");
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

async function invalidateTicket(ticketId: string, reason: string) {
  const token = localStorage.getItem("auth_token");
  const response = await fetch(`${API_BASE_URL}/api/admin/tickets/${ticketId}/invalidate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ reason }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Error al invalidar boleto");
  }
  return response.json();
}

async function resendTicket(ticketId: string) {
  const token = localStorage.getItem("auth_token");
  const response = await fetch(`${API_BASE_URL}/api/admin/tickets/${ticketId}/resend`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Error al reenviar boleto");
  }
  return response.json();
}

async function manualCheckin(ticketId: string) {
  const token = localStorage.getItem("auth_token");
  const response = await fetch(`${API_BASE_URL}/api/checkin/manual`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ticketId }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Error al hacer check-in");
  }
  return response.json();
}

const statusConfig = {
  RESERVED: { label: "Reservado", color: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: Clock },
  CONFIRMED: { label: "Confirmado", color: "bg-gold-500/20 text-gold-400 border-gold-500/30", icon: Ticket },
  SOLD: { label: "Vendido", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: CheckCircle2 },
  USED: { label: "Usado", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
  CANCELLED: { label: "Cancelado", color: "bg-rose-500/20 text-rose-400 border-rose-500/30", icon: XCircle },
  TRANSFERRED: { label: "Transferido", color: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: RefreshCw },
};

export default function AdminTickets() {
  const { config } = useAppConfig();
  const queryClient = useQueryClient();
  
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [eventFilter, setEventFilter] = useState("all");
  const [selectedTicket, setSelectedTicket] = useState<TicketItem | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showInvalidateDialog, setShowInvalidateDialog] = useState(false);
  const [invalidateReason, setInvalidateReason] = useState("");
  
  const limit = 25;

  // Fetch tickets
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-tickets", page, search, statusFilter, eventFilter],
    queryFn: () => fetchTickets({ page, limit, search, status: statusFilter, eventId: eventFilter }),
  });

  // Fetch events for filter
  const { data: events } = useQuery({
    queryKey: ["events-list"],
    queryFn: fetchEvents,
  });

  // Invalidate mutation
  const invalidateMutation = useMutation({
    mutationFn: () => invalidateTicket(selectedTicket!.id, invalidateReason),
    onSuccess: () => {
      toast.success("Boleto invalidado correctamente");
      setShowInvalidateDialog(false);
      setInvalidateReason("");
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // Resend mutation
  const resendMutation = useMutation({
    mutationFn: (ticketId: string) => resendTicket(ticketId),
    onSuccess: () => {
      toast.success("Boleto reenviado correctamente");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // Manual check-in mutation
  const checkinMutation = useMutation({
    mutationFn: (ticketId: string) => manualCheckin(ticketId),
    onSuccess: () => {
      toast.success("Check-in realizado correctamente");
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
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

  const tickets = data?.tickets || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Boletos</h1>
          <p className="text-white/60">Gestiona todos los boletos emitidos</p>
        </div>
        <Button variant="outline" onClick={() => refetch()} className="border-white/20">
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar
        </Button>
      </div>

      {/* Stats */}
      {pagination && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-white/10 bg-white/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-gold-500/20 p-3">
                  <Ticket className="h-5 w-5 text-gold-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{pagination.total}</p>
                  <p className="text-sm text-white/60">Total boletos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="border-white/10 bg-white/5">
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" />
                <Input
                  placeholder="Buscar por código, nombre o email..."
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
                <SelectItem value="RESERVED">Reservado</SelectItem>
                <SelectItem value="CONFIRMED">Confirmado</SelectItem>
                <SelectItem value="USED">Usado</SelectItem>
                <SelectItem value="CANCELLED">Cancelado</SelectItem>
                <SelectItem value="TRANSFERRED">Transferido</SelectItem>
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

      {/* Tickets Table */}
      <Card className="border-white/10 bg-white/5">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-gold-400" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-white/60">
              <Ticket className="h-12 w-12 mb-4 opacity-50" />
              <p>No se encontraron boletos</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 text-left text-sm text-white/60">
                    <th className="p-4 font-medium">Código</th>
                    <th className="p-4 font-medium">Cliente</th>
                    <th className="p-4 font-medium">Evento</th>
                    <th className="p-4 font-medium">Ubicación</th>
                    <th className="p-4 font-medium">Precio</th>
                    <th className="p-4 font-medium">Estado</th>
                    <th className="p-4 font-medium">Check-in</th>
                    <th className="p-4 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => {
                    const StatusIcon = statusConfig[ticket.status]?.icon || Ticket;
                    return (
                      <tr
                        key={ticket.id}
                        className="border-b border-white/5 hover:bg-white/5 transition-colors"
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <QrCode className="h-4 w-4 text-white/60" />
                            <span className="font-mono text-sm text-gold-400">{ticket.code}</span>
                            {ticket.isCourtesy && (
                              <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs">
                                Cortesía
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <div>
                            <p className="font-medium text-white">{ticket.buyerName}</p>
                            <p className="text-sm text-white/60">{ticket.buyerEmail}</p>
                          </div>
                        </td>
                        <td className="p-4">
                          <div>
                            <p className="text-white text-sm">{ticket.eventName}</p>
                            <p className="text-xs text-white/60">
                              {format(new Date(ticket.sessionDate), "dd MMM HH:mm", { locale: es })}
                            </p>
                          </div>
                        </td>
                        <td className="p-4">
                          {ticket.seatLabel ? (
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-white/60" />
                              <span className="text-white text-sm">{ticket.seatLabel}</span>
                            </div>
                          ) : ticket.tierLabel ? (
                            <Badge variant="outline" className="border-white/20">
                              {ticket.tierLabel}
                            </Badge>
                          ) : (
                            <span className="text-white/50">-</span>
                          )}
                        </td>
                        <td className="p-4">
                          {ticket.isCourtesy ? (
                            <span className="text-purple-400 font-medium">$0.00</span>
                          ) : (
                            <span className="text-white">
                              {formatPrice(ticket.price, config.currency)}
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          <Badge className={statusConfig[ticket.status]?.color}>
                            <StatusIcon className="mr-1 h-3 w-3" />
                            {statusConfig[ticket.status]?.label}
                          </Badge>
                        </td>
                        <td className="p-4">
                          {ticket.checkedInAt ? (
                            <div className="text-sm">
                              <p className="text-emerald-400">
                                {format(new Date(ticket.checkedInAt), "HH:mm")}
                              </p>
                              {ticket.checkedInBy && (
                                <p className="text-xs text-white/50">{ticket.checkedInBy}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-white/50">-</span>
                          )}
                        </td>
                        <td className="p-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setSelectedTicket(ticket); setShowDetail(true); }}>
                                <Eye className="mr-2 h-4 w-4" />
                                Ver detalle
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => resendMutation.mutate(ticket.id)}>
                                <Send className="mr-2 h-4 w-4" />
                                Reenviar por email
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <a href={`${API_BASE_URL}/api/tickets/${ticket.id}/download`} target="_blank">
                                  <Download className="mr-2 h-4 w-4" />
                                  Descargar PDF
                                </a>
                              </DropdownMenuItem>
                              {ticket.status === "CONFIRMED" && !ticket.checkedInAt && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => checkinMutation.mutate(ticket.id)}>
                                    <ScanLine className="mr-2 h-4 w-4" />
                                    Check-in manual
                                  </DropdownMenuItem>
                                </>
                              )}
                              {(ticket.status === "CONFIRMED" || ticket.status === "RESERVED") && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => { setSelectedTicket(ticket); setShowInvalidateDialog(true); }}
                                    className="text-rose-400"
                                  >
                                    <Ban className="mr-2 h-4 w-4" />
                                    Invalidar boleto
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

      {/* Ticket Detail Dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-lg bg-[#0a0a0a] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <QrCode className="h-5 w-5 text-gold-400" />
              Boleto {selectedTicket?.code}
            </DialogTitle>
          </DialogHeader>

          {selectedTicket && (
            <div className="space-y-4">
              <div className="grid gap-4 grid-cols-2">
                <div>
                  <p className="text-xs text-white/60">Cliente</p>
                  <p className="text-white">{selectedTicket.buyerName}</p>
                  <p className="text-sm text-white/60">{selectedTicket.buyerEmail}</p>
                </div>
                <div>
                  <p className="text-xs text-white/60">Orden</p>
                  <p className="font-mono text-gold-400">{selectedTicket.orderNumber}</p>
                </div>
              </div>

              <Separator className="bg-white/10" />

              <div>
                <p className="text-xs text-white/60 mb-1">Evento</p>
                <p className="text-white font-medium">{selectedTicket.eventName}</p>
                <div className="flex items-center gap-2 mt-1 text-sm text-white/60">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(selectedTicket.sessionDate), "PPP HH:mm", { locale: es })}
                </div>
                {selectedTicket.venueName && (
                  <div className="flex items-center gap-2 mt-1 text-sm text-white/60">
                    <MapPin className="h-4 w-4" />
                    {selectedTicket.venueName}
                  </div>
                )}
              </div>

              <Separator className="bg-white/10" />

              <div className="grid gap-4 grid-cols-2">
                <div>
                  <p className="text-xs text-white/60">Ubicación</p>
                  <p className="text-white">
                    {selectedTicket.seatLabel || selectedTicket.tierLabel || "General"}
                  </p>
                  {selectedTicket.zoneName && (
                    <p className="text-sm text-white/60">{selectedTicket.zoneName}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-white/60">Precio</p>
                  <p className="text-white font-semibold">
                    {formatPrice(selectedTicket.price + selectedTicket.fee, config.currency)}
                  </p>
                </div>
              </div>

              {selectedTicket.checkedInAt && (
                <>
                  <Separator className="bg-white/10" />
                  <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <span className="text-emerald-400 font-medium">Check-in realizado</span>
                    </div>
                    <p className="text-sm text-emerald-300/70 mt-1">
                      {format(new Date(selectedTicket.checkedInAt), "PPP HH:mm", { locale: es })}
                      {selectedTicket.checkedInBy && ` por ${selectedTicket.checkedInBy}`}
                    </p>
                  </div>
                </>
              )}

              {selectedTicket.transferredAt && (
                <>
                  <Separator className="bg-white/10" />
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-amber-400" />
                      <span className="text-amber-400 font-medium">Transferido</span>
                    </div>
                    <p className="text-sm text-amber-300/70 mt-1">
                      {format(new Date(selectedTicket.transferredAt), "PPP HH:mm", { locale: es })}
                      {selectedTicket.transferredTo && ` a ${selectedTicket.transferredTo}`}
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetail(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invalidate Confirmation Dialog */}
      <Dialog open={showInvalidateDialog} onOpenChange={setShowInvalidateDialog}>
        <DialogContent className="bg-[#0a0a0a] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Invalidar Boleto</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de invalidar el boleto {selectedTicket?.code}?
              El cliente no podrá usar este boleto para ingresar al evento.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-white/60">Razón de invalidación</label>
              <Input
                placeholder="Ej: Solicitud del cliente, error de sistema..."
                value={invalidateReason}
                onChange={(e) => setInvalidateReason(e.target.value)}
                className="mt-1 border-white/20 bg-white/5"
              />
            </div>

            <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-4">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-rose-400 flex-shrink-0" />
                <div className="text-sm text-rose-200">
                  <p className="font-medium">Atención:</p>
                  <p className="mt-1">
                    Esta acción no procesa reembolso automático. Si el cliente requiere
                    devolución, debes procesarla desde la sección de Órdenes.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvalidateDialog(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => invalidateMutation.mutate()}
              disabled={invalidateMutation.isPending || !invalidateReason.trim()}
            >
              {invalidateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Ban className="mr-2 h-4 w-4" />
              )}
              Invalidar Boleto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
