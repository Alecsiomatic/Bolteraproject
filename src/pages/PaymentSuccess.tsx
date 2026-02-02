import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Ticket, Download, Calendar, MapPin, Loader2, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { API_BASE_URL } from "@/lib/api-base";

interface OrderInfo {
  orderNumber: string;
  total: number;
  currency: string;
  status: string;
  event: {
    id: string;
    name: string;
  };
  session: {
    startsAt: string;
  };
  venue: {
    name: string;
    city: string;
  } | null;
  tickets: Array<{
    code: string;
    seatLabel: string | null;
    zoneName: string | null;
  }>;
}

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const paymentId = searchParams.get("payment_id");
  const externalReference = searchParams.get("external_reference");
  const status = searchParams.get("status");
  const collectionStatus = searchParams.get("collection_status");

  useEffect(() => {
    const verifyPayment = async () => {
      if (!externalReference) {
        setError("No se encontró referencia de pago");
        setLoading(false);
        return;
      }

      try {
        // Verificar pago y obtener detalles de la orden
        const response = await fetch(
          `${API_BASE_URL}/api/payments/verify?external_reference=${externalReference}&payment_id=${paymentId || ""}`
        );

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.order) {
            setOrder(data.order);
          } else {
            // Si no hay orden, puede que el webhook aún no la haya procesado
            // Mostramos un mensaje de espera
            setError("Tu pago está siendo procesado. Recibirás un email de confirmación en breve.");
          }
        } else {
          setError("No pudimos verificar tu pago. Por favor revisa tu email o contacta soporte.");
        }
      } catch (err) {
        console.error("Error verifying payment:", err);
        setError("Error al verificar el pago");
      } finally {
        setLoading(false);
      }
    };

    verifyPayment();
  }, [externalReference, paymentId]);

  const downloadPDF = async (ticketCode: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tickets/${ticketCode}/pdf`);
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `boleto-${ticketCode}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Error downloading PDF:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-cyan-400" />
          <p className="mt-4 text-lg text-slate-300">Verificando tu pago...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 py-12">
      <div className="container mx-auto max-w-2xl px-4">
        {/* Success Animation */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/20">
            <CheckCircle className="h-16 w-16 text-emerald-400" />
          </div>
          <h1 className="mb-2 text-3xl font-bold text-white">¡Pago exitoso!</h1>
          <p className="text-slate-400">
            {error || "Tu compra ha sido confirmada. Te enviamos un email con los detalles."}
          </p>
        </div>

        {order ? (
          <>
            {/* Order Details */}
            <Card className="mb-6 border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Ticket className="h-5 w-5 text-cyan-400" />
                  {order.event.name}
                </CardTitle>
                <CardDescription>
                  Orden #{order.orderNumber}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 text-slate-300">
                  <Calendar className="h-4 w-4 text-cyan-400" />
                  <span>
                    {format(new Date(order.session.startsAt), "EEEE d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es })}
                  </span>
                </div>
                {order.venue && (
                  <div className="flex items-center gap-3 text-slate-300">
                    <MapPin className="h-4 w-4 text-cyan-400" />
                    <span>{order.venue.name}, {order.venue.city}</span>
                  </div>
                )}

                <div className="rounded-lg bg-white/5 p-4">
                  <p className="mb-2 text-sm font-medium text-slate-400">Tus boletos</p>
                  <div className="space-y-2">
                    {order.tickets.map((ticket) => (
                      <div key={ticket.code} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-white">{ticket.code}</p>
                          <p className="text-sm text-slate-400">
                            {ticket.zoneName || "General"} {ticket.seatLabel && `- ${ticket.seatLabel}`}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadPDF(ticket.code)}
                          className="border-white/20"
                        >
                          <Download className="mr-1 h-4 w-4" />
                          PDF
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-white/10 pt-4">
                  <span className="text-slate-400">Total pagado</span>
                  <span className="text-2xl font-bold text-emerald-400">
                    ${order.total.toLocaleString()} {order.currency}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link to="/my-tickets" className="flex-1">
                <Button className="w-full bg-gradient-to-br from-cyan-500/80 via-cyan-400/70 to-cyan-500/80 text-white border border-cyan-400/30 shadow-[0_8px_32px_rgba(6,182,212,0.3),inset_0_1px_1px_rgba(255,255,255,0.2)] hover:shadow-[0_12px_40px_rgba(6,182,212,0.4)] backdrop-blur-xl">
                  Ver mis boletos
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/events" className="flex-1">
                <Button variant="outline" className="w-full border-white/20">
                  Explorar más eventos
                </Button>
              </Link>
            </div>
          </>
        ) : (
          /* Fallback when no order info */
          <Card className="border-white/10 bg-white/5">
            <CardContent className="py-8 text-center">
              <p className="mb-6 text-slate-300">{error}</p>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Link to="/my-tickets">
                  <Button className="bg-gradient-to-br from-cyan-500/80 via-cyan-400/70 to-cyan-500/80 text-white border border-cyan-400/30 shadow-[0_8px_32px_rgba(6,182,212,0.3),inset_0_1px_1px_rgba(255,255,255,0.2)] hover:shadow-[0_12px_40px_rgba(6,182,212,0.4)] backdrop-blur-xl">
                    Ir a Mis Boletos
                  </Button>
                </Link>
                <Link to="/events">
                  <Button variant="outline" className="border-white/20">
                    Ver eventos
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Info */}
        {paymentId && (
          <p className="mt-6 text-center text-xs text-slate-500">
            ID de pago: {paymentId} | Estado: {collectionStatus || status || "approved"}
          </p>
        )}
      </div>
    </div>
  );
}
