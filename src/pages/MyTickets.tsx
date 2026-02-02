import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PublicNavbar from "@/components/PublicNavbar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Ticket,
  Calendar,
  MapPin,
  Download,
  QrCode,
  Clock,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  Eye,
  Send,
  Loader2,
  CalendarPlus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, isPast, isFuture, isToday } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { API_BASE_URL } from "@/lib/api-base";
import { normalizeImageUrl } from "@/lib/utils/imageUrl";

interface TicketItem {
  id: string;
  code: string;
  status: "VALID" | "USED" | "CANCELLED" | "REFUNDED";
  seatLabel: string | null;
  zoneName: string | null;
  price: number;
  checkedInAt: string | null;
}

interface Order {
  id: string;
  orderNumber: string;
  status: "PENDING" | "PAID" | "CANCELLED" | "REFUNDED";
  total: number;
  currency: string;
  createdAt: string;
  paymentMethod?: string;
  isCourtesy?: boolean;
  event: {
    id: string;
    name: string;
    thumbnailImage: string | null;
  };
  session: {
    id: string;
    startsAt: string;
    title: string | null;
  };
  venue: {
    id: string;
    name: string;
    city: string;
  } | null;
  tickets: TicketItem[];
}

function getStatusBadge(status: Order["status"], isCourtesy?: boolean) {
  if (isCourtesy) {
    return <Badge className="bg-purple-600">Cortesía</Badge>;
  }
  switch (status) {
    case "PAID":
      return <Badge className="bg-green-600">Pagado</Badge>;
    case "PENDING":
      return <Badge className="bg-yellow-500">Pendiente</Badge>;
    case "CANCELLED":
      return <Badge className="bg-red-600">Cancelado</Badge>;
    case "REFUNDED":
      return <Badge className="bg-gray-500">Reembolsado</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
}

function getTicketStatusIcon(status: TicketItem["status"]) {
  switch (status) {
    case "VALID":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "USED":
      return <CheckCircle className="h-4 w-4 text-blue-500" />;
    case "CANCELLED":
    case "REFUNDED":
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return null;
  }
}

function TicketQRDialog({ ticketCode, eventName }: { ticketCode: string; eventName: string }) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadQR = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/tickets/${ticketCode}/qr`);
      if (response.ok) {
        const blob = await response.blob();
        setQrUrl(URL.createObjectURL(blob));
      } else {
        toast.error("No se pudo cargar el código QR");
      }
    } catch (error) {
      toast.error("Error al cargar el QR");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" onClick={loadQR}>
          <QrCode className="h-4 w-4 mr-1" />
          Ver QR
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Código QR - {ticketCode}</DialogTitle>
          <DialogDescription>{eventName}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-center p-4">
          {loading ? (
            <div className="w-64 h-64 animate-pulse bg-muted rounded-lg" />
          ) : qrUrl ? (
            <img src={qrUrl} alt="Ticket QR Code" className="w-64 h-64" />
          ) : (
            <div className="w-64 h-64 flex items-center justify-center bg-muted rounded-lg">
              <QrCode className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
        </div>
        <p className="text-center text-sm text-muted-foreground">
          Muestra este código en la entrada del evento
        </p>
      </DialogContent>
    </Dialog>
  );
}

function TransferTicketDialog({
  ticketCode,
  eventName,
  onSuccess,
  token,
}: {
  ticketCode: string;
  eventName: string;
  onSuccess: () => void;
  token: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    newHolderName: "",
    newHolderEmail: "",
    message: "",
  });

  const handleTransfer = async () => {
    if (!form.newHolderName.trim() || !form.newHolderEmail.trim()) {
      toast.error("Nombre y email son requeridos");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.newHolderEmail)) {
      toast.error("El email no es válido");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/tickets/${ticketCode}/transfer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al transferir el boleto");
      }

      toast.success("¡Boleto transferido exitosamente!", {
        description: `El boleto ahora pertenece a ${form.newHolderName}`,
      });
      setOpen(false);
      setForm({ newHolderName: "", newHolderEmail: "", message: "" });
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al transferir");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Send className="h-4 w-4 mr-1" />
          Transferir
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Transferir Boleto</DialogTitle>
          <DialogDescription>
            Transfiere este boleto a otra persona. Una vez transferido, no podrás acceder a él.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-sm font-medium">{eventName}</p>
            <p className="text-xs text-muted-foreground">Código: {ticketCode}</p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="newHolderName">Nombre del nuevo titular *</Label>
            <Input
              id="newHolderName"
              value={form.newHolderName}
              onChange={(e) => setForm({ ...form, newHolderName: e.target.value })}
              placeholder="Nombre completo"
              disabled={loading}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="newHolderEmail">Email del nuevo titular *</Label>
            <Input
              id="newHolderEmail"
              type="email"
              value={form.newHolderEmail}
              onChange={(e) => setForm({ ...form, newHolderEmail: e.target.value })}
              placeholder="email@ejemplo.com"
              disabled={loading}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="message">Mensaje (opcional)</Label>
            <Textarea
              id="message"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Agrega un mensaje personal..."
              rows={2}
              disabled={loading}
            />
          </div>
          
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
            <p className="text-sm text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-4 w-4 inline mr-1" />
              Esta acción es irreversible. El nuevo titular recibirá acceso al boleto.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleTransfer} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Transfiriendo...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Transferir Boleto
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OrderCard({ order, onRefund, onRefresh, token }: { order: Order; onRefund: (orderNumber: string) => void; onRefresh: () => void; token: string | null }) {
  const sessionDate = new Date(order.session.startsAt);
  const isUpcoming = isFuture(sessionDate);
  const isEventToday = isToday(sessionDate);
  const isPastEvent = isPast(sessionDate) && !isEventToday;

  const downloadPDF = async (ticketCode?: string) => {
    try {
      let url: string;
      let filename: string;
      
      if (ticketCode) {
        url = `${API_BASE_URL}/api/tickets/${ticketCode}/pdf`;
        filename = `boleto-${ticketCode}.pdf`;
      } else {
        url = `${API_BASE_URL}/api/orders/${order.orderNumber}/pdf`;
        filename = `orden-${order.orderNumber}.pdf`;
      }
      
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to download");
      
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      
      toast.success("PDF descargado correctamente");
    } catch (error) {
      toast.error("Error al descargar el PDF");
    }
  };

  // Calendar functions
  const formatCalendarDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const generateGoogleCalendarUrl = () => {
    const startDate = sessionDate;
    const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000); // 2 hours default
    
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: order.event.name,
      dates: `${formatCalendarDate(startDate)}/${formatCalendarDate(endDate)}`,
      details: `Orden: ${order.orderNumber}\nBoletos: ${order.tickets.length}`,
      location: order.venue ? `${order.venue.name}, ${order.venue.city}` : '',
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  const downloadICalFile = () => {
    const startDate = sessionDate;
    const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
    
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Boletera//Ticket//ES',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `DTSTART:${formatCalendarDate(startDate)}`,
      `DTEND:${formatCalendarDate(endDate)}`,
      `SUMMARY:${order.event.name}`,
      `DESCRIPTION:Orden: ${order.orderNumber}\\nBoletos: ${order.tickets.length}`,
      `LOCATION:${order.venue ? `${order.venue.name}, ${order.venue.city}` : ''}`,
      `UID:${order.id}@boletera.com`,
      `DTSTAMP:${formatCalendarDate(new Date())}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${order.event.name.toLowerCase().replace(/\s+/g, '-')}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className={`rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden transition-all ${isPastEvent ? "opacity-70" : ""}`}>
      <div className="p-3 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
          <div className="flex gap-3 sm:gap-4">
            {order.event.thumbnailImage && (
              <img
                src={normalizeImageUrl(order.event.thumbnailImage) || ''}
                alt={order.event.name}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover flex-shrink-0 ring-2 ring-white/10"
              />
            )}
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-white truncate">{order.event.name}</h3>
              <div className="flex flex-col gap-0.5 sm:gap-1 mt-1 text-xs sm:text-sm text-white/60">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 flex-shrink-0 text-gold-400" />
                  <span className="truncate">{format(sessionDate, "EEE d 'de' MMM, yyyy", { locale: es })}</span>
                  {isEventToday && (
                    <Badge className="ml-1 sm:ml-2 text-[10px] sm:text-xs bg-gold-500/20 text-gold-400 border border-gold-500/30">
                      ¡Hoy!
                    </Badge>
                  )}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3 flex-shrink-0 text-gold-400" />
                  {format(sessionDate, "HH:mm", { locale: es })} hrs
                </span>
                {order.venue && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 flex-shrink-0 text-gold-400" />
                    <span className="truncate">{order.venue.name}, {order.venue.city}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start sm:text-right gap-2">
            {getStatusBadge(order.status, order.isCourtesy)}
            <p className="text-base sm:text-lg font-bold">
              {order.isCourtesy ? (
                <span className="text-purple-400">CORTESÍA</span>
              ) : (
                <span className="text-gold-400">${order.total.toFixed(2)} {order.currency}</span>
              )}
            </p>
            <p className="text-[10px] sm:text-xs text-white/40 hidden sm:block">
              Orden: {order.orderNumber}
            </p>
          </div>
        </div>
      </div>
      <div className="p-3 sm:p-6 pt-0">
        <div className="space-y-2 sm:space-y-3">
          <div className="text-xs sm:text-sm font-medium text-white/80">
            Boletos ({order.tickets.length})
          </div>
          <div className="grid gap-2">
            {order.tickets.map((ticket) => (
              <div
                key={ticket.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-3 bg-white/5 rounded-xl border border-white/5 gap-2"
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  {getTicketStatusIcon(ticket.status)}
                  <div className="min-w-0">
                    <p className="font-medium text-xs sm:text-sm truncate text-white">
                      {ticket.zoneName || "General"} - {ticket.seatLabel || "Sin asiento"}
                    </p>
                    <p className="text-[10px] sm:text-xs text-white/50">
                      Código: {ticket.code}
                      {ticket.checkedInAt && (
                        <span className="ml-2 text-gold-400">
                          • Check-in: {format(new Date(ticket.checkedInAt), "HH:mm")}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 justify-end sm:justify-start">
                  {ticket.status === "VALID" && order.status === "PAID" && (
                    <>
                      <TicketQRDialog
                        ticketCode={ticket.code}
                        eventName={order.event.name}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 sm:px-3 border-white/20 hover:bg-white/10"
                        onClick={() => downloadPDF(ticket.code)}
                      >
                        <Download className="h-3 w-3 sm:h-4 sm:w-4" />
                      </Button>
                      {isUpcoming && (
                        <TransferTicketDialog
                          ticketCode={ticket.code}
                          eventName={order.event.name}
                          onSuccess={onRefresh}
                          token={token}
                        />
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {/* Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 pt-3 border-t border-white/10">
            <div className="flex flex-wrap gap-2">
              {order.status === "PAID" && (
                <Button variant="outline" size="sm" className="text-xs sm:text-sm h-8 border-white/20 hover:bg-white/10" onClick={() => downloadPDF()}>
                  <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                  Descargar Todos
                </Button>
              )}
              {isUpcoming && order.status === "PAID" && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="text-xs sm:text-sm h-8 border-white/20 hover:bg-white/10">
                      <CalendarPlus className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                      Añadir a calendario
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-black/90 border-white/10 backdrop-blur-xl">
                    <DropdownMenuItem onClick={() => window.open(generateGoogleCalendarUrl(), '_blank')} className="text-white hover:bg-white/10">
                      <Calendar className="h-4 w-4 mr-2" />
                      Google Calendar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={downloadICalFile} className="text-white hover:bg-white/10">
                      <Download className="h-4 w-4 mr-2" />
                      Descargar .ics
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <Link to={`/events/${order.event.id}`}>
                <Button variant="ghost" size="sm" className="text-gold-400 hover:text-gold-300 hover:bg-gold-500/10">
                  <Eye className="h-4 w-4 mr-1" />
                  Ver Evento
                </Button>
              </Link>
            </div>
            
            {/* Refund option for upcoming events */}
            {order.status === "PAID" && isUpcoming && !isEventToday && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30">
                    Solicitar Reembolso
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-black/95 border-white/10 backdrop-blur-xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-white">¿Solicitar reembolso?</AlertDialogTitle>
                    <AlertDialogDescription className="text-white/60">
                      Esta acción cancelará tu orden y se procesará el reembolso a tu método de pago original.
                      Los reembolsos pueden tardar de 5 a 10 días hábiles en reflejarse.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-white/20 hover:bg-white/10">Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onRefund(order.orderNumber)} className="bg-red-500 hover:bg-red-600">
                      Confirmar Reembolso
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MyTickets() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("upcoming");

  // Detectar si estamos dentro del UserLayout (panel de usuario)
  const isInUserPanel = location.pathname.startsWith("/mi-cuenta");

  useEffect(() => {
    if (!user || !token) {
      navigate("/login", { state: { from: location.pathname } });
      return;
    }
    fetchOrders();
  }, [user, token]);

  const fetchOrders = async () => {
    if (!user || !token) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/${user.id}/orders`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error("No se pudieron cargar las órdenes");
      }
      
      const data = await response.json();
      setOrders(data.orders || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      toast.error("Error al cargar tus boletos");
    } finally {
      setLoading(false);
    }
  };

  const handleRefund = async (orderNumber: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/orders/${orderNumber}/refund`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: "Solicitud del cliente" }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "No se pudo procesar el reembolso");
      }
      
      toast.success("Solicitud de reembolso procesada correctamente");
      fetchOrders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al procesar reembolso");
    }
  };

  // Filter orders by status
  const upcomingOrders = orders.filter((o) => {
    const sessionDate = new Date(o.session.startsAt);
    return (isFuture(sessionDate) || isToday(sessionDate)) && o.status === "PAID";
  });

  const pastOrders = orders.filter((o) => {
    const sessionDate = new Date(o.session.startsAt);
    return isPast(sessionDate) && !isToday(sessionDate);
  });

  const cancelledOrders = orders.filter(
    (o) => o.status === "CANCELLED" || o.status === "REFUNDED"
  );

  if (loading) {
    // Si está en el panel de usuario, renderizar solo el contenido
    if (isInUserPanel) {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <Ticket className="h-5 w-5 sm:h-6 sm:w-6 text-gold-400" />
              Mis Boletos
            </h1>
          </div>
          <div className="space-y-3 sm:space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-6">
                <div className="flex gap-3 sm:gap-4">
                  <Skeleton className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-white/10" />
                  <div className="space-y-2">
                    <Skeleton className="h-5 sm:h-6 w-36 sm:w-48 bg-white/10" />
                    <Skeleton className="h-3 sm:h-4 w-28 sm:w-32 bg-white/10" />
                    <Skeleton className="h-3 sm:h-4 w-20 sm:w-24 bg-white/10" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-[#050505] via-[#0a0a0a] to-[#050505]">
        <PublicNavbar />
        <main className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6 flex items-center gap-2">
            <Ticket className="h-5 w-5 sm:h-6 sm:w-6 text-gold-400" />
            Mis Boletos
          </h1>
          <div className="space-y-3 sm:space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-4 sm:p-6">
                <div className="flex gap-3 sm:gap-4">
                  <Skeleton className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-white/10" />
                  <div className="space-y-2">
                    <Skeleton className="h-5 sm:h-6 w-36 sm:w-48 bg-white/10" />
                    <Skeleton className="h-3 sm:h-4 w-28 sm:w-32 bg-white/10" />
                    <Skeleton className="h-3 sm:h-4 w-20 sm:w-24 bg-white/10" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  // Contenido de las tabs (compartido)
  const ticketContent = (
    <>
      {error ? (
        <div className="max-w-md mx-auto rounded-2xl border border-red-500/20 bg-red-500/5 p-8">
          <div className="flex flex-col items-center justify-center">
            <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
            <h2 className="text-lg font-semibold mb-2 text-white">Error al cargar</h2>
            <p className="text-white/60 text-center mb-4">{error}</p>
            <Button onClick={fetchOrders} className="bg-gradient-to-r from-gold-500 to-amber-500 hover:from-gold-400 hover:to-amber-400 text-black font-semibold">Reintentar</Button>
          </div>
        </div>
      ) : orders.length === 0 ? (
        <div className="max-w-md mx-auto rounded-2xl border border-white/10 bg-white/[0.03] p-8">
          <div className="flex flex-col items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-gold-500/10 flex items-center justify-center mb-4">
              <Ticket className="h-10 w-10 text-gold-400" />
            </div>
            <h2 className="text-lg font-semibold mb-2 text-white">No tienes boletos</h2>
            <p className="text-white/60 text-center mb-4">
              Aún no has comprado ningún boleto. ¡Explora los eventos disponibles!
            </p>
            <Link to="/">
              <Button className="bg-gradient-to-r from-gold-500 to-amber-500 hover:from-gold-400 hover:to-amber-400 text-black font-semibold">Ver Eventos</Button>
            </Link>
          </div>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 sm:mb-6 w-full sm:w-auto flex overflow-x-auto bg-white/5 border border-white/10 rounded-xl p-1">
            <TabsTrigger value="upcoming" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm flex-1 sm:flex-none data-[state=active]:bg-gold-500/20 data-[state=active]:text-gold-400 rounded-lg">
              <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
              Próximos ({upcomingOrders.length})
            </TabsTrigger>
            <TabsTrigger value="past" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm flex-1 sm:flex-none data-[state=active]:bg-white/10 data-[state=active]:text-white rounded-lg">
              <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
              Pasados ({pastOrders.length})
            </TabsTrigger>
            <TabsTrigger value="cancelled" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm flex-1 sm:flex-none data-[state=active]:bg-red-500/20 data-[state=active]:text-red-400 rounded-lg">
              <XCircle className="h-3 w-3 sm:h-4 sm:w-4" />
              Cancelados ({cancelledOrders.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="space-y-3 sm:space-y-4">
            {upcomingOrders.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
                <p className="text-white/60">
                  No tienes eventos próximos
                </p>
                <Link to="/">
                  <Button className="mt-4 bg-gradient-to-r from-gold-500 to-amber-500 hover:from-gold-400 hover:to-amber-400 text-black font-semibold">Explorar Eventos</Button>
                </Link>
              </div>
            ) : (
              upcomingOrders.map((order) => (
                <OrderCard key={order.id} order={order} onRefund={handleRefund} onRefresh={fetchOrders} token={token} />
              ))
            )}
          </TabsContent>

          <TabsContent value="past" className="space-y-4">
            {pastOrders.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
                <p className="text-white/60">
                  No tienes eventos pasados
                </p>
              </div>
            ) : (
              pastOrders.map((order) => (
                <OrderCard key={order.id} order={order} onRefund={handleRefund} onRefresh={fetchOrders} token={token} />
              ))
            )}
          </TabsContent>

          <TabsContent value="cancelled" className="space-y-4">
            {cancelledOrders.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
                <p className="text-white/60">
                  No tienes órdenes canceladas
                </p>
              </div>
            ) : (
              cancelledOrders.map((order) => (
                <OrderCard key={order.id} order={order} onRefund={handleRefund} onRefresh={fetchOrders} token={token} />
              ))
            )}
          </TabsContent>
        </Tabs>
      )}
    </>
  );

  // Si está dentro del panel de usuario, renderizar solo el contenido
  if (isInUserPanel) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Ticket className="h-5 w-5 sm:h-6 sm:w-6 text-gold-400" />
            Mis Boletos
          </h1>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchOrders}
            className="border-gold-500/30 text-gold-400 hover:bg-gold-500/10 hover:text-gold-300 w-fit"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>
        {ticketContent}
      </div>
    );
  }

  // Renderizado normal con navbar y fondo para /my-tickets
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#050505] via-[#0a0a0a] to-[#050505]">
      <PublicNavbar />

      <main className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Ticket className="h-5 w-5 sm:h-6 sm:w-6 text-gold-400" />
            Mis Boletos
          </h1>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchOrders}
            className="border-gold-500/30 text-gold-400 hover:bg-gold-500/10 hover:text-gold-300 w-fit backdrop-blur-sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>
        {ticketContent}
      </main>
    </div>
  );
}
