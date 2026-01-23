/**
 * MercadoPago Checkout Component
 * 
 * Pago embebido con Checkout Bricks de MercadoPago
 * Estilo Liquid Glass UI con Flip Card animada
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { 
  CreditCard, 
  Lock, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Wifi,
  Shield,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

// Declarar tipos de MercadoPago
declare global {
  interface Window {
    MercadoPago: any;
  }
}

interface MercadoPagoCheckoutProps {
  amount: number;
  currency?: string;
  ticketIds: string[];
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string;
  eventName: string;
  onSuccess: (data: PaymentResult) => void;
  onError: (error: string) => void;
  onCancel?: () => void;
  className?: string;
}

interface PaymentResult {
  orderId: string;
  orderNumber: string;
  ticketCodes: string[];
  status: string;
}

interface CardData {
  number: string;
  name: string;
  expiry: string;
  cvv: string;
  type: "visa" | "mastercard" | "amex" | "unknown";
}

// Detectar tipo de tarjeta por número
function detectCardType(number: string): CardData["type"] {
  const cleaned = number.replace(/\s/g, "");
  if (/^4/.test(cleaned)) return "visa";
  if (/^5[1-5]/.test(cleaned) || /^2[2-7]/.test(cleaned)) return "mastercard";
  if (/^3[47]/.test(cleaned)) return "amex";
  return "unknown";
}

// Formatear número de tarjeta
function formatCardNumber(value: string): string {
  const cleaned = value.replace(/\D/g, "");
  const groups = cleaned.match(/.{1,4}/g);
  return groups ? groups.join(" ") : cleaned;
}

// Formatear fecha de expiración
function formatExpiry(value: string): string {
  const cleaned = value.replace(/\D/g, "");
  if (cleaned.length >= 2) {
    return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`;
  }
  return cleaned;
}

export function MercadoPagoCheckout({
  amount,
  currency = "MXN",
  ticketIds,
  buyerName,
  buyerEmail,
  buyerPhone,
  eventName,
  onSuccess,
  onError,
  onCancel,
  className,
}: MercadoPagoCheckoutProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [mpReady, setMpReady] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [testMode, setTestMode] = useState(true);
  
  const [cardData, setCardData] = useState<CardData>({
    number: "",
    name: buyerName.toUpperCase(),
    expiry: "",
    cvv: "",
    type: "unknown",
  });

  const mpRef = useRef<any>(null);
  const cardFormRef = useRef<any>(null);

  // Cargar configuración de MercadoPago
  useEffect(() => {
    async function loadConfig() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/payments/config`);
        const data = await response.json();
        
        if (data.success && data.publicKey) {
          setPublicKey(data.publicKey);
          setTestMode(data.testMode);
        }
      } catch (err) {
        console.error("Error loading MP config:", err);
      }
    }
    loadConfig();
  }, []);

  // Cargar SDK de MercadoPago
  useEffect(() => {
    if (!publicKey) return;

    const script = document.createElement("script");
    script.src = "https://sdk.mercadopago.com/js/v2";
    script.async = true;
    script.onload = () => {
      if (window.MercadoPago) {
        mpRef.current = new window.MercadoPago(publicKey, {
          locale: "es-MX",
        });
        setMpReady(true);
      }
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [publicKey]);

  // Actualizar tipo de tarjeta cuando cambia el número
  const handleCardNumberChange = (value: string) => {
    const formatted = formatCardNumber(value);
    if (formatted.replace(/\s/g, "").length <= 16) {
      setCardData(prev => ({
        ...prev,
        number: formatted,
        type: detectCardType(formatted),
      }));
    }
  };

  // Manejar cambio de expiración
  const handleExpiryChange = (value: string) => {
    const formatted = formatExpiry(value);
    if (formatted.length <= 5) {
      setCardData(prev => ({ ...prev, expiry: formatted }));
    }
  };

  // Manejar cambio de CVV (flip card)
  const handleCvvFocus = () => setIsFlipped(true);
  const handleCvvBlur = () => setIsFlipped(false);

  // Procesar pago
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!cardData.number || !cardData.expiry || !cardData.cvv || !cardData.name) {
      setErrorMessage("Por favor completa todos los campos de la tarjeta");
      return;
    }

    setIsProcessing(true);
    setPaymentStatus("processing");
    setErrorMessage("");

    try {
      const token = localStorage.getItem("auth_token");
      
      // Parsear fecha de expiración
      const [expMonth, expYear] = cardData.expiry.split("/");
      
      // Crear token de tarjeta con MercadoPago
      let cardToken: string | null = null;
      
      if (mpReady && mpRef.current) {
        try {
          const tokenResponse = await mpRef.current.createCardToken({
            cardNumber: cardData.number.replace(/\s/g, ""),
            cardholderName: cardData.name,
            cardExpirationMonth: expMonth,
            cardExpirationYear: `20${expYear}`,
            securityCode: cardData.cvv,
            identificationType: "RFC", // Para México
            identificationNumber: "XAXX010101000", // Genérico para pruebas
          });
          cardToken = tokenResponse.id;
        } catch (tokenErr: any) {
          console.error("Error creating card token:", tokenErr);
          // En modo test sin MP configurado, continuar con simulación
        }
      }

      // Enviar pago al backend
      const response = await fetch(`${API_BASE_URL}/api/payments/process`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ticketIds,
          amount,
          currency,
          cardToken,
          buyerName,
          buyerEmail,
          buyerPhone,
          // Datos adicionales para simulación si no hay token
          cardData: !cardToken ? {
            lastFourDigits: cardData.number.slice(-4),
            cardType: cardData.type,
          } : undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Error procesando el pago");
      }

      setPaymentStatus("success");
      
      // Esperar animación antes de callback
      setTimeout(() => {
        onSuccess({
          orderId: result.order.id,
          orderNumber: result.order.orderNumber,
          ticketCodes: result.ticketCodes || [],
          status: result.order.status,
        });
      }, 1500);

    } catch (err: any) {
      console.error("Payment error:", err);
      setPaymentStatus("error");
      setErrorMessage(err.message || "Error al procesar el pago");
      onError(err.message || "Error al procesar el pago");
    } finally {
      setIsProcessing(false);
    }
  };

  // Render card logo
  const CardLogo = () => {
    switch (cardData.type) {
      case "visa":
        return (
          <svg viewBox="0 0 48 48" className="h-10 w-14">
            <rect fill="#1A1F71" width="48" height="48" rx="4"/>
            <path fill="#fff" d="M19.5 31h-3.2l2-12.3h3.2l-2 12.3zm11.8-12c-.6-.2-1.6-.5-2.9-.5-3.2 0-5.5 1.7-5.5 4.1 0 1.8 1.6 2.8 2.8 3.4 1.2.6 1.7 1 1.7 1.5 0 .8-1 1.2-1.9 1.2-1.3 0-2-.2-3-.7l-.4-.2-.5 2.8c.8.4 2.1.7 3.6.7 3.4 0 5.6-1.7 5.6-4.2 0-1.4-.9-2.5-2.8-3.4-1.2-.6-1.9-1-1.9-1.6 0-.5.6-1.1 1.9-1.1 1.1 0 1.9.2 2.5.5l.3.2.5-2.7zm8.3-.3h-2.5c-.8 0-1.4.2-1.7 1l-4.9 11.6h3.4l.7-1.9h4.2l.4 1.9h3l-2.6-12.6zm-4 8.1l1.3-3.5.4-1.1.2 1 .8 3.6h-2.7zm-21.1-8.1l-3.2 8.4-.3-1.7c-.6-2-2.4-4.1-4.5-5.2l2.9 10.8h3.4l5.1-12.3h-3.4z"/>
          </svg>
        );
      case "mastercard":
        return (
          <svg viewBox="0 0 48 48" className="h-10 w-14">
            <rect fill="#000" width="48" height="48" rx="4"/>
            <circle fill="#EB001B" cx="18" cy="24" r="10"/>
            <circle fill="#F79E1B" cx="30" cy="24" r="10"/>
            <path fill="#FF5F00" d="M24 16.8a10 10 0 0 0-3.6 7.2 10 10 0 0 0 3.6 7.2 10 10 0 0 0 3.6-7.2 10 10 0 0 0-3.6-7.2z"/>
          </svg>
        );
      case "amex":
        return (
          <svg viewBox="0 0 48 48" className="h-10 w-14">
            <rect fill="#006FCF" width="48" height="48" rx="4"/>
            <path fill="#fff" d="M8 28h4l.8-2h1.8l.8 2h8v-1.5l.7 1.5h4.2l.7-1.6v1.6h16.9l2-2.1 1.9 2.1H44l-3.6-4 3.6-4h-5l-2 2.1-1.9-2.1h-18l-1.5 3.4-1.6-3.4h-4v1.4l-.8-1.4H6l-2.6 6h3.2l.8-2h1.8l.8 2zm4.4-5.6l-2 5.2h1.6l.4-1h2l.4 1h2.8l-2.4-5.2h-2.8zm1.2 1.4l.6 1.5h-1.2l.6-1.5zm7.4-1.4v5.2h1.6v-3.7l1.8 3.7h1.4l1.8-3.7v3.7h1.6v-5.2h-2.5l-1.6 3.2-1.6-3.2h-2.5zm10 0v5.2h5.2v-1.2h-3.6v-1h3.5v-1.2h-3.5v-.8h3.6v-1h-5.2zm6.4 0v5.2h1.6v-1.8h.7l1.6 1.8h2l-1.9-2c.9-.3 1.5-1 1.5-1.8 0-1.2-1-2.2-2.4-2.2h-3.1zm1.6 1v1.4h1.5c.5 0 .8-.3.8-.7s-.3-.7-.8-.7h-1.5z"/>
          </svg>
        );
      default:
        return <CreditCard className="h-10 w-14 text-white/50" />;
    }
  };

  // Estado de éxito
  if (paymentStatus === "success") {
    return (
      <div className={cn(
        "relative overflow-hidden rounded-[32px] p-8",
        "bg-gradient-to-br from-emerald-500/20 via-emerald-500/10 to-transparent",
        "border border-emerald-500/30 backdrop-blur-xl",
        "shadow-[0_25px_80px_rgba(16,185,129,0.3)]",
        className
      )}>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="mb-6 rounded-full bg-emerald-500/20 p-4">
            <CheckCircle2 className="h-16 w-16 text-emerald-400 animate-in zoom-in duration-500" />
          </div>
          <h3 className="text-2xl font-semibold text-white mb-2">¡Pago Exitoso!</h3>
          <p className="text-emerald-200/70">Tu compra ha sido procesada correctamente</p>
          <div className="mt-6 flex items-center gap-2 text-sm text-emerald-300/60">
            <Shield className="h-4 w-4" />
            <span>Transacción segura con MercadoPago</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "relative overflow-hidden rounded-[32px]",
      "bg-gradient-to-br from-white/10 via-white/5 to-transparent",
      "border border-white/15 backdrop-blur-xl",
      "shadow-[0_25px_80px_rgba(15,23,42,0.7)]",
      className
    )}>
      {/* Header */}
      <div className="border-b border-white/10 bg-white/5 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gold-500/20 p-2">
              <CreditCard className="h-5 w-5 text-gold-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Pago Seguro</h3>
              <p className="text-xs text-white/60">Procesado por MercadoPago</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {testMode && (
              <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-400">
                MODO PRUEBA
              </span>
            )}
            <Lock className="h-4 w-4 text-emerald-400" />
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Flip Card */}
        <div 
          className="relative mx-auto mb-8 h-48 w-80"
          style={{ perspective: "1000px" }}
        >
          <div
            className={cn(
              "relative h-full w-full transition-transform duration-700",
              "transform-gpu preserve-3d",
              isFlipped && "[transform:rotateY(180deg)]"
            )}
            style={{ transformStyle: "preserve-3d" }}
          >
            {/* Frente de la tarjeta */}
            <div
              className={cn(
                "absolute inset-0 rounded-2xl p-6",
                "bg-gradient-to-br from-slate-800 via-[#0a0a0a] to-black",
                "border border-white/20",
                "shadow-[0_20px_60px_rgba(0,0,0,0.5)]",
                "backface-hidden"
              )}
              style={{ backfaceVisibility: "hidden" }}
            >
              {/* Chip y NFC */}
              <div className="mb-6 flex items-center justify-between">
                <div className="h-10 w-14 rounded-md bg-gradient-to-br from-amber-300 via-amber-400 to-amber-500 p-1">
                  <div className="h-full w-full rounded-sm bg-gradient-to-br from-amber-200 to-amber-400 opacity-50" />
                </div>
                <Wifi className="h-6 w-6 rotate-90 text-white/40" />
              </div>

              {/* Número de tarjeta */}
              <div className="mb-4 font-mono text-xl tracking-widest text-white">
                {cardData.number || "•••• •••• •••• ••••"}
              </div>

              {/* Nombre y fecha */}
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/50">Titular</p>
                  <p className="font-medium text-white/90">
                    {cardData.name || "TU NOMBRE"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-white/50">Válida hasta</p>
                  <p className="font-mono text-white/90">
                    {cardData.expiry || "MM/AA"}
                  </p>
                </div>
                <CardLogo />
              </div>

              {/* Efecto de brillo */}
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-50" />
            </div>

            {/* Reverso de la tarjeta */}
            <div
              className={cn(
                "absolute inset-0 rounded-2xl",
                "bg-gradient-to-br from-slate-800 via-[#0a0a0a] to-black",
                "border border-white/20",
                "shadow-[0_20px_60px_rgba(0,0,0,0.5)]",
                "[transform:rotateY(180deg)]"
              )}
              style={{ backfaceVisibility: "hidden" }}
            >
              {/* Banda magnética */}
              <div className="mt-6 h-12 w-full bg-[#050505]" />

              {/* CVV */}
              <div className="mt-6 px-6">
                <div className="flex items-center justify-end">
                  <div className="mr-4 h-8 flex-1 rounded bg-white/90" />
                  <div className="flex h-10 w-16 items-center justify-center rounded bg-white/20 font-mono text-lg tracking-widest text-white">
                    {cardData.cvv || "•••"}
                  </div>
                </div>
              </div>

              {/* Info de seguridad */}
              <div className="mt-8 px-6">
                <p className="text-center text-[10px] text-white/40">
                  Este código de seguridad (CVV) se encuentra en el reverso de tu tarjeta
                </p>
              </div>

              <CardLogo />
            </div>
          </div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Número de tarjeta */}
          <div className="space-y-2">
            <Label className="text-sm text-white/70">Número de tarjeta</Label>
            <div className="relative">
              <Input
                type="text"
                placeholder="1234 5678 9012 3456"
                value={cardData.number}
                onChange={(e) => handleCardNumberChange(e.target.value)}
                className={cn(
                  "h-12 border-white/10 bg-white/5 pl-12 font-mono text-lg tracking-wider",
                  "placeholder:text-white/50 focus:border-gold-500/50 focus:ring-gold-500/20"
                )}
                maxLength={19}
                disabled={isProcessing}
              />
              <CreditCard className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/50" />
            </div>
          </div>

          {/* Nombre */}
          <div className="space-y-2">
            <Label className="text-sm text-white/70">Nombre en la tarjeta</Label>
            <Input
              type="text"
              placeholder="JUAN PÉREZ"
              value={cardData.name}
              onChange={(e) => setCardData(prev => ({ ...prev, name: e.target.value.toUpperCase() }))}
              className={cn(
                "h-12 border-white/10 bg-white/5 uppercase",
                "placeholder:text-white/50 focus:border-gold-500/50 focus:ring-gold-500/20"
              )}
              disabled={isProcessing}
            />
          </div>

          {/* Fecha y CVV */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm text-white/70">Fecha de vencimiento</Label>
              <Input
                type="text"
                placeholder="MM/AA"
                value={cardData.expiry}
                onChange={(e) => handleExpiryChange(e.target.value)}
                className={cn(
                  "h-12 border-white/10 bg-white/5 font-mono text-center",
                  "placeholder:text-white/50 focus:border-gold-500/50 focus:ring-gold-500/20"
                )}
                maxLength={5}
                disabled={isProcessing}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-white/70">CVV</Label>
              <Input
                type="text"
                placeholder="123"
                value={cardData.cvv}
                onChange={(e) => setCardData(prev => ({ 
                  ...prev, 
                  cvv: e.target.value.replace(/\D/g, "").slice(0, 4) 
                }))}
                onFocus={handleCvvFocus}
                onBlur={handleCvvBlur}
                className={cn(
                  "h-12 border-white/10 bg-white/5 font-mono text-center",
                  "placeholder:text-white/50 focus:border-gold-500/50 focus:ring-gold-500/20"
                )}
                maxLength={4}
                disabled={isProcessing}
              />
            </div>
          </div>

          {/* Error */}
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/30 p-4">
              <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-300">{errorMessage}</p>
            </div>
          )}

          {/* Resumen de pago */}
          <div className="rounded-xl bg-white/5 border border-white/10 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/60">Evento</span>
              <span className="text-white font-medium">{eventName}</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/60">Boletos</span>
              <span className="text-white">{ticketIds.length}</span>
            </div>
            <div className="border-t border-white/10 pt-2 mt-2">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-white">Total a pagar</span>
                <span className="text-2xl font-bold text-gold-400">
                  ${amount.toLocaleString()} <span className="text-sm text-white/60">{currency}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-2">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isProcessing}
                className="flex-1 h-14 border-white/20 bg-white/5 hover:bg-white/10"
              >
                Cancelar
              </Button>
            )}
            <Button
              type="submit"
              disabled={isProcessing || !cardData.number || !cardData.expiry || !cardData.cvv}
              className={cn(
                "flex-1 h-14 text-lg font-semibold",
                "bg-gradient-to-r from-gold-500 to-amber-500",
                "hover:from-gold-400 hover:to-amber-400",
                "shadow-[0_10px_40px_rgba(6,182,212,0.3)]",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Pagar ${amount.toLocaleString()}
                </>
              )}
            </Button>
          </div>

          {/* Seguridad */}
          <div className="flex items-center justify-center gap-4 pt-4 text-xs text-white/50">
            <div className="flex items-center gap-1">
              <Lock className="h-3 w-3" />
              <span>Cifrado SSL</span>
            </div>
            <div className="flex items-center gap-1">
              <Shield className="h-3 w-3" />
              <span>PCI DSS</span>
            </div>
            <img 
              src="https://www.mercadopago.com/org-img/MP3/home/logomp3.gif" 
              alt="MercadoPago"
              className="h-5 opacity-50"
            />
          </div>
        </form>
      </div>
    </div>
  );
}

export default MercadoPagoCheckout;
