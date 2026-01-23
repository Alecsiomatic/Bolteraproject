import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, AlertTriangle, Mail, ArrowRight, Ticket } from "lucide-react";

export default function PaymentPending() {
  const [searchParams] = useSearchParams();
  
  const paymentId = searchParams.get("payment_id");
  const externalReference = searchParams.get("external_reference");
  const paymentType = searchParams.get("payment_type");

  const getInstructions = () => {
    // Instrucciones basadas en el tipo de pago
    if (paymentType === "ticket" || paymentType === "atm") {
      return {
        title: "Pago en efectivo pendiente",
        description: "Tienes 24-72 horas para completar el pago",
        steps: [
          "Acude a cualquier OXXO, 7-Eleven o tienda de conveniencia",
          "Proporciona el código de pago al cajero",
          "Guarda tu comprobante de pago",
          "Recibirás tus boletos por email una vez confirmado el pago",
        ],
      };
    }
    
    if (paymentType === "bank_transfer") {
      return {
        title: "Transferencia bancaria pendiente",
        description: "Tu pago está siendo procesado",
        steps: [
          "Realiza la transferencia con los datos proporcionados",
          "El banco puede tardar 1-2 días hábiles en procesar",
          "Recibirás confirmación por email cuando se acredite",
        ],
      };
    }

    return {
      title: "Pago en proceso",
      description: "Tu pago está siendo verificado",
      steps: [
        "Estamos verificando tu pago con la institución financiera",
        "Este proceso puede tardar unos minutos",
        "Te notificaremos por email cuando se confirme",
      ],
    };
  };

  const instructions = getInstructions();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 py-12">
      <div className="container mx-auto max-w-lg px-4">
        {/* Pending Icon */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-amber-500/20">
            <Clock className="h-16 w-16 text-amber-400" />
          </div>
          <h1 className="mb-2 text-3xl font-bold text-white">{instructions.title}</h1>
          <p className="text-slate-400">{instructions.description}</p>
        </div>

        {/* Instructions Card */}
        <Card className="mb-6 border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-lg text-white">Próximos pasos</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              {instructions.steps.map((step, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-sm font-medium text-cyan-400">
                    {index + 1}
                  </span>
                  <span className="text-slate-300">{step}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {/* Email Notification */}
        <Card className="mb-6 border-amber-500/30 bg-amber-500/10">
          <CardContent className="flex items-start gap-3 py-4">
            <Mail className="mt-0.5 h-5 w-5 text-amber-400" />
            <div>
              <p className="font-medium text-white">Revisa tu email</p>
              <p className="text-sm text-slate-300">
                Te enviamos los detalles y código de pago a tu correo electrónico.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Warning */}
        <Card className="mb-6 border-white/10 bg-white/5">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-400" />
            <div>
              <p className="font-medium text-white">Importante</p>
              <p className="text-sm text-slate-300">
                Tus asientos están reservados temporalmente. Si el pago no se completa
                en el tiempo indicado, la reserva se cancelará automáticamente.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Link to="/my-tickets">
            <Button className="w-full bg-gradient-to-br from-cyan-500/80 via-cyan-400/70 to-cyan-500/80 text-white border border-cyan-400/30 shadow-[0_8px_32px_rgba(6,182,212,0.3),inset_0_1px_1px_rgba(255,255,255,0.2)] hover:shadow-[0_12px_40px_rgba(6,182,212,0.4)] backdrop-blur-xl">
              <Ticket className="mr-2 h-4 w-4" />
              Ver mis órdenes
            </Button>
          </Link>
          <Link to="/events">
            <Button variant="outline" className="w-full border-white/20">
              Explorar más eventos
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        {/* Reference Info */}
        {externalReference && (
          <div className="mt-8 rounded-lg bg-white/5 p-4 text-center">
            <p className="text-xs text-slate-500">Referencia de pago</p>
            <p className="font-mono text-lg text-white">{externalReference}</p>
            {paymentId && (
              <p className="mt-1 text-xs text-slate-500">ID: {paymentId}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
