import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  Calendar,
  MapPin,
  Ticket,
  Download,
  QrCode,
  ArrowRight,
  AlertCircle,
  Clock,
  Mail,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

interface OrderTicket {
  id: string;
  code: string;
  status: string;
  seatLabel: string | null;
  zoneName: string | null;
  price: number;
}

interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  currency: string;
  paymentMethod: string | null;
  paymentReference: string | null;
  createdAt: string;
  buyer: {
    name: string;
    email: string;
    phone: string | null;
  };
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
    address: string | null;
  } | null;
  tickets: OrderTicket[];
}

export default function OrderConfirmation() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const { token } = useAuth();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderNumber) return;
    
    const fetchOrder = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/orders/${orderNumber}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Orden no encontrada");
          }
          throw new Error("Error al cargar la orden");
        }
        
        const data = await response.json();
        setOrder(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        setLoading(false);
      }
    };
    
    fetchOrder();
  }, [orderNumber, token]);

  const downloadAllPDF = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/orders/${orderNumber}/pdf`);
      if (!response.ok) throw new Error("Error al descargar");
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `boletos-${orderNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success("PDF descargado correctamente");
    } catch (err) {
      toast.error("Error al descargar el PDF");
    }
  };

  const downloadTicketPDF = async (ticketCode: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tickets/${ticketCode}/pdf`);
      if (!response.ok) throw new Error("Error al descargar");
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `boleto-${ticketCode}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success("Boleto descargado");
    } catch (err) {
      toast.error("Error al descargar el boleto");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="container mx-auto max-w-3xl px-4 py-16">
          <Card className="border-white/10 bg-white/5">
            <CardContent className="p-8">
              <div className="flex flex-col items-center">
                <Skeleton className="h-20 w-20 rounded-full" />
                <Skeleton className="mt-6 h-8 w-64" />
                <Skeleton className="mt-2 h-6 w-48" />
              </div>
              <div className="mt-8 space-y-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="container mx-auto max-w-2xl px-4 py-16">
          <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="p-8 text-center">
              <AlertCircle className="mx-auto h-16 w-16 text-red-400" />
              <h1 className="mt-4 text-2xl font-bold text-white">Orden no encontrada</h1>
              <p className="mt-2 text-slate-400">{error || "No pudimos encontrar esta orden"}</p>
              <Link to="/events" className="mt-6 inline-block">
                <Button>Explorar eventos</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const sessionDate = new Date(order.session.startsAt);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="container mx-auto max-w-3xl px-4 py-16">
        {/* Success Header */}
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-8">
            <div className="text-center">
              <div className="relative mx-auto h-20 w-20">
                <div className="absolute inset-0 animate-pulse rounded-full bg-emerald-500/20" />
                <div className="relative flex h-full w-full items-center justify-center rounded-full bg-emerald-500/30">
                  <CheckCircle2 className="h-12 w-12 text-emerald-400" />
                </div>
              </div>
              <h1 className="mt-6 text-3xl font-bold text-white">¡Compra exitosa!</h1>
              <p className="mt-2 text-slate-300">
                Tu orden <span className="font-mono font-bold text-emerald-400">#{order.orderNumber}</span> ha sido confirmada
              </p>
            </div>

            {/* Email Notice */}
            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-400">
              <Mail className="h-4 w-4" />
              <span>Hemos enviado los boletos a {order.buyer.email}</span>
            </div>
          </CardContent>
        </Card>

        {/* Event Details */}
        <Card className="mt-6 border-white/10 bg-white/5">
          <CardContent className="p-6">
            <div className="flex gap-4">
              {order.event.thumbnailImage && (
                <img
                  src={`${API_BASE_URL}${order.event.thumbnailImage}`}
                  alt={order.event.name}
                  className="h-24 w-24 rounded-lg object-cover"
                />
              )}
              <div className="flex-1">
                <h2 className="text-xl font-bold text-white">{order.event.name}</h2>
                <div className="mt-2 space-y-1 text-sm text-slate-400">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {format(sessionDate, "EEEE d 'de' MMMM, yyyy", { locale: es })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>{format(sessionDate, "HH:mm", { locale: es })} hrs</span>
                  </div>
                  {order.venue && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>{order.venue.name}, {order.venue.city}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tickets */}
        <Card className="mt-6 border-white/10 bg-white/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Ticket className="h-5 w-5 text-cyan-400" />
                Tus boletos ({order.tickets.length})
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadAllPDF}
                className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
              >
                <Download className="h-4 w-4 mr-2" />
                Descargar todos
              </Button>
            </div>

            <div className="space-y-3">
              {order.tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="flex items-center justify-between rounded-lg bg-white/5 p-4 border border-white/10"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-500/20">
                      <QrCode className="h-6 w-6 text-cyan-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-white">
                          {ticket.code}
                        </span>
                        <Badge
                          variant="secondary"
                          className={
                            ticket.status === "VALID"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-slate-500/20 text-slate-400"
                          }
                        >
                          {ticket.status === "VALID" ? "Válido" : ticket.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-400">
                        {ticket.zoneName || "General"} • {ticket.seatLabel || "Sin asiento"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-300">
                      ${ticket.price.toFixed(2)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadTicketPDF(ticket.code)}
                      className="text-slate-400 hover:text-cyan-400"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Separator className="my-4 bg-white/10" />

            {/* Total */}
            <div className="flex items-center justify-between text-lg">
              <span className="font-medium text-white">Total pagado</span>
              <span className="font-bold text-emerald-400">
                ${order.total.toFixed(2)} {order.currency}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Important Info */}
        <Card className="mt-6 border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4">
            <h4 className="font-medium text-amber-300 mb-2">Información importante</h4>
            <ul className="text-sm text-amber-200/70 space-y-1 list-disc list-inside">
              <li>Presenta tu código QR en la entrada del evento</li>
              <li>Cada boleto puede usarse una sola vez</li>
              <li>Llega con al menos 30 minutos de anticipación</li>
              <li>Guarda tus boletos en un lugar seguro</li>
            </ul>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
          <Link to="/my-tickets">
            <Button className="w-full sm:w-auto bg-gradient-to-br from-cyan-500/80 via-cyan-400/70 to-cyan-500/80 text-white border border-cyan-400/30 shadow-[0_8px_32px_rgba(6,182,212,0.3),inset_0_1px_1px_rgba(255,255,255,0.2)] hover:shadow-[0_12px_40px_rgba(6,182,212,0.4)] backdrop-blur-xl">
              <Ticket className="mr-2 h-4 w-4" />
              Ver mis boletos
            </Button>
          </Link>
          <Link to="/events">
            <Button variant="outline" className="w-full sm:w-auto">
              Explorar más eventos
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        {/* Order Details */}
        <div className="mt-8 text-center text-xs text-slate-500">
          <p>Orden: {order.orderNumber}</p>
          <p>Fecha: {format(new Date(order.createdAt), "dd/MM/yyyy HH:mm")}</p>
          {order.paymentReference && <p>Referencia: {order.paymentReference}</p>}
        </div>
      </div>
    </div>
  );
}
