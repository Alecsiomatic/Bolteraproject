import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { XCircle, ArrowLeft, RefreshCw, HelpCircle } from "lucide-react";

export default function PaymentFailure() {
  const [searchParams] = useSearchParams();
  
  const paymentId = searchParams.get("payment_id");
  const externalReference = searchParams.get("external_reference");
  const status = searchParams.get("status");
  const statusDetail = searchParams.get("status_detail");

  const getErrorMessage = (detail: string | null) => {
    const messages: Record<string, string> = {
      cc_rejected_bad_filled_card_number: "El número de tarjeta es incorrecto",
      cc_rejected_bad_filled_date: "La fecha de vencimiento es incorrecta",
      cc_rejected_bad_filled_other: "Algún dato de la tarjeta es incorrecto",
      cc_rejected_bad_filled_security_code: "El código de seguridad es incorrecto",
      cc_rejected_blacklist: "Tu tarjeta no puede procesar pagos en este momento",
      cc_rejected_call_for_authorize: "Debes autorizar el pago con tu banco",
      cc_rejected_card_disabled: "Tu tarjeta está deshabilitada",
      cc_rejected_card_error: "Tu tarjeta no pudo procesar el pago",
      cc_rejected_duplicated_payment: "Ya realizaste un pago por este monto",
      cc_rejected_high_risk: "El pago fue rechazado por motivos de seguridad",
      cc_rejected_insufficient_amount: "Fondos insuficientes",
      cc_rejected_invalid_installments: "La tarjeta no permite cuotas",
      cc_rejected_max_attempts: "Excediste el número máximo de intentos",
      cc_rejected_other_reason: "El pago fue rechazado",
    };
    return messages[detail || ""] || "El pago no pudo ser procesado";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 py-12">
      <div className="container mx-auto max-w-lg px-4">
        {/* Error Icon */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-red-500/20">
            <XCircle className="h-16 w-16 text-red-400" />
          </div>
          <h1 className="mb-2 text-3xl font-bold text-white">Pago rechazado</h1>
          <p className="text-slate-400">
            {getErrorMessage(statusDetail)}
          </p>
        </div>

        <Card className="mb-6 border-white/10 bg-white/5">
          <CardContent className="py-6">
            <h3 className="mb-4 font-semibold text-white">¿Qué puedo hacer?</h3>
            <ul className="space-y-3 text-sm text-slate-300">
              <li className="flex items-start gap-2">
                <span className="mt-1 text-cyan-400">•</span>
                <span>Verifica que los datos de tu tarjeta sean correctos</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 text-cyan-400">•</span>
                <span>Asegúrate de tener fondos suficientes</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 text-cyan-400">•</span>
                <span>Intenta con otro método de pago</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 text-cyan-400">•</span>
                <span>Contacta a tu banco si el problema persiste</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Link to={externalReference ? `/events` : "/events"}>
            <Button className="w-full bg-gradient-to-br from-cyan-500/80 via-cyan-400/70 to-cyan-500/80 text-white border border-cyan-400/30 shadow-[0_8px_32px_rgba(6,182,212,0.3),inset_0_1px_1px_rgba(255,255,255,0.2)] hover:shadow-[0_12px_40px_rgba(6,182,212,0.4)] backdrop-blur-xl">
              <RefreshCw className="mr-2 h-4 w-4" />
              Intentar de nuevo
            </Button>
          </Link>
          <Link to="/events">
            <Button variant="outline" className="w-full border-white/20">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a eventos
            </Button>
          </Link>
        </div>

        {/* Help Link */}
        <div className="mt-8 text-center">
          <Link to="/help" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white">
            <HelpCircle className="h-4 w-4" />
            ¿Necesitas ayuda?
          </Link>
        </div>

        {/* Debug Info */}
        {paymentId && (
          <p className="mt-6 text-center text-xs text-slate-500">
            ID: {paymentId} | Ref: {externalReference || "N/A"} | Status: {status || "rejected"}
          </p>
        )}
      </div>
    </div>
  );
}
