import { useState, useMemo, useCallback, useEffect } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, reservationsApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useAppConfig, formatPrice } from "@/hooks/useAppConfig";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { Progress } from "@/components/ui/progress";
import { SeatMapViewer } from "@/components/SeatMapViewer";
import { HierarchicalSeatMap } from "@/components/HierarchicalSeatMap";
import { MercadoPagoCheckout } from "@/components/MercadoPagoCheckout";
import PublicNavbar from "@/components/PublicNavbar";
import {
  Calendar,
  Ticket,
  Loader2,
  ArrowLeft,
  X,
  CheckCircle2,
  AlertCircle,
  ShoppingCart,
  User,
  Mail,
  CreditCard,
  AlertTriangle,
  Phone,
  Timer,
  Tag,
  TicketPercent,
  Plus,
  Minus,
  Users,
  Gift,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

type SeatAvailability = {
  id: string;
  zoneId: string | null;
  sectionId?: string | null;
  label: string;
  rowLabel: string | null;
  columnNumber: number | null;
  available: boolean;
  status: string;
  price: number;
  fee?: number;
};

type Zone = {
  id: string;
  name: string;
  color: string;
  seatCount: number;
};

type PriceTier = {
  id: string;
  zoneId: string | null;
  zoneName: string | null;
  price: number;
  fee: number;
  currency: string;
};

type ReservationData = {
  id: string;
  expiresAt: string;
  expiresIn: number;
  expiresInMinutes: number;
  tickets: Array<{ id: string; seatId: string | null; tierId: string | null; price: number }>;
  session: { id: string; eventId: string; eventName: string; startsAt: string };
};

const MAX_SEATS = 10;
const RESERVATION_MINUTES = 15;

// Timer hook for countdown
function useCountdown(expiresAt: string | null) {
  const [timeLeft, setTimeLeft] = useState<number>(RESERVATION_MINUTES * 60);

  useEffect(() => {
    if (!expiresAt) {
      setTimeLeft(RESERVATION_MINUTES * 60); // Reset to full time when no reservation
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const expiry = new Date(expiresAt).getTime();
      const remaining = Math.max(0, Math.floor((expiry - now) / 1000));
      setTimeLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const progress = expiresAt ? (timeLeft / (RESERVATION_MINUTES * 60)) * 100 : 100;
  // Only mark as expired if we have an expiresAt AND timeLeft reached 0
  const isExpired = expiresAt !== null && timeLeft === 0;
  const isWarning = timeLeft > 0 && timeLeft < 120; // Last 2 minutes

  return { timeLeft, minutes, seconds, progress, isExpired, isWarning };
}

const EventPurchase = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, token } = useAuth();
  const { config } = useAppConfig();

  const [selectedSeats, setSelectedSeats] = useState<SeatAvailability[]>([]);
  const [step, setStep] = useState<"seats" | "checkout" | "payment" | "processing" | "confirmation">("seats");
  const [customerForm, setCustomerForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: "",
  });
  const [purchaseResult, setPurchaseResult] = useState<any>(null);

  // General admission ticket quantities (tierId -> quantity)
  const [ticketQuantities, setTicketQuantities] = useState<Record<string, number>>({});

  // Coupon state
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    id: string;
    code: string;
    name: string;
    discountType: "PERCENTAGE" | "FIXED";
    discountValue: number;
    discount: number;
  } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState("");

  // Payment method state (for admin courtesy)
  const [paymentMethod, setPaymentMethod] = useState<"card" | "courtesy">("card");
  const isAdmin = user?.role === "ADMIN";

  // Reservation state
  const [reservation, setReservation] = useState<ReservationData | null>(null);
  const [reservedTicketIds, setReservedTicketIds] = useState<string[]>([]);
  const countdown = useCountdown(reservation?.expiresAt || null);

  // Fetch event details
  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ["purchase-event", eventId],
    queryFn: () => api.getEvent(eventId!),
    enabled: Boolean(eventId),
  });

  // Fetch seat availability for the session
  const { data: availability, isLoading: availabilityLoading, refetch: refetchAvailability } = useQuery({
    queryKey: ["seat-availability", eventId, sessionId],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/events/${eventId}/sessions/${sessionId}/availability`);
      if (!response.ok) throw new Error("Error cargando disponibilidad");
      return response.json();
    },
    enabled: Boolean(eventId && sessionId),
    refetchInterval: 30000,
  });

  // Fetch reservation status for real-time updates
  const { data: sessionStatus } = useQuery({
    queryKey: ["session-status", sessionId],
    queryFn: () => reservationsApi.getSessionStatus(sessionId!),
    enabled: Boolean(sessionId),
    refetchInterval: 10000,
  });

  // Get session info
  const session = useMemo(() => {
    return event?.sessions?.find((s: any) => s.id === sessionId);
  }, [event, sessionId]);

  // Check if this is a general admission event (availability has the latest flag)
  const isGeneralAdmission = useMemo(() => {
    if (availability?.eventType === "general") {
      return true;
    }
    return event?.eventType === "general";
  }, [event?.eventType, availability?.eventType]);

  const showRemainingTickets = Boolean(
    availability?.showRemainingTickets ?? event?.showRemainingTickets ?? false,
  );

  // Get prices by zone
  const pricesByZone = useMemo(() => {
    const tiers = event?.priceTiers ?? [];
    const map = new Map<string, PriceTier>();
    tiers.forEach((tier: PriceTier) => {
      if (tier.zoneId) {
        map.set(tier.zoneId, tier);
      }
    });
    return map;
  }, [event?.priceTiers]);

  // Get zones with colors
  const zonesMap = useMemo(() => {
    const zones = event?.venue?.zones ?? [];
    const map = new Map<string, Zone>();
    zones.forEach((zone: Zone) => {
      map.set(zone.id, zone);
    });
    return map;
  }, [event?.venue?.zones]);

  // Group seats by zone and row
  const seatsByZone = useMemo(() => {
    if (isGeneralAdmission) {
      return {};
    }

    const seats = availability?.seats ?? [];
    const grouped: Record<string, SeatAvailability[]> = {};
    
    seats.forEach((seat: SeatAvailability) => {
      const zoneId = seat.zoneId ?? "general";
      if (!grouped[zoneId]) {
        grouped[zoneId] = [];
      }
      // Mark seat as unavailable if it's reserved by someone else
      const reservedStatus = sessionStatus?.seats?.[seat.id];
      if (reservedStatus && !reservedTicketIds.some(t => t === seat.id)) {
        seat.available = false;
        seat.status = reservedStatus.status;
      }
      grouped[zoneId].push(seat);
    });
    
    Object.keys(grouped).forEach(zoneId => {
      grouped[zoneId].sort((a, b) => {
        const rowA = a.rowLabel ?? "";
        const rowB = b.rowLabel ?? "";
        if (rowA !== rowB) return rowA.localeCompare(rowB);
        return (a.columnNumber ?? 0) - (b.columnNumber ?? 0);
      });
    });
    
    return grouped;
  }, [availability?.seats, sessionStatus, reservedTicketIds, isGeneralAdmission]);

  // Calculate totals - supports both seated and general admission
  const totals = useMemo(() => {
    if (isGeneralAdmission) {
      // General admission: calculate from ticket quantities
      // Use tiers from availability (has real-time prices) or fall back to event.priceTiers
      const tiers = availability?.tiers ?? event?.priceTiers ?? [];
      let subtotal = 0;
      let fees = 0;
      
      tiers.forEach((tier: any) => {
        const qty = ticketQuantities[tier.id] || 0;
        subtotal += tier.price * qty;
        fees += (tier.fee || 0) * qty;
      });
      
      // Apply global service fee if configured
      if (event?.serviceFeeType && event?.serviceFeeValue) {
        if (event.serviceFeeType === "percentage") {
          fees += subtotal * (event.serviceFeeValue / 100);
        } else {
          // Fixed fee per ticket
          const totalTickets = Object.values(ticketQuantities).reduce((a, b) => a + b, 0);
          fees += event.serviceFeeValue * totalTickets;
        }
      }
      
      const discount = appliedCoupon?.discount ?? 0;
      return {
        subtotal,
        fees,
        discount,
        total: Math.max(0, subtotal + fees - discount),
      };
    }
    
    // Seated event: calculate from selected seats
    const subtotal = selectedSeats.reduce((sum, seat) => sum + seat.price, 0);
    let fees = selectedSeats.reduce((sum, seat) => sum + (seat.fee || 0), 0);
    
    // Apply global service fee if configured
    if (event?.serviceFeeType && event?.serviceFeeValue) {
      if (event.serviceFeeType === "percentage") {
        fees += subtotal * (event.serviceFeeValue / 100);
      } else {
        fees += event.serviceFeeValue * selectedSeats.length;
      }
    }
    
    const discount = appliedCoupon?.discount ?? 0;
    return {
      subtotal,
      fees,
      discount,
      total: Math.max(0, subtotal + fees - discount),
    };
  }, [selectedSeats, pricesByZone, appliedCoupon, isGeneralAdmission, ticketQuantities, event]);

  // Total tickets for general admission
  const totalGeneralTickets = useMemo(() => {
    return Object.values(ticketQuantities).reduce((a, b) => a + b, 0);
  }, [ticketQuantities]);

  // Handle reservation expiration
  useEffect(() => {
    if (countdown.isExpired && reservation) {
      toast({
        variant: "destructive",
        title: "Tiempo agotado",
        description: "Tu reserva ha expirado. Los asientos han sido liberados.",
      });
      setReservation(null);
      setReservedTicketIds([]);
      setSelectedSeats([]);
      setStep("seats");
      refetchAvailability();
    }
  }, [countdown.isExpired, reservation, toast, refetchAvailability]);

  // Toggle seat selection
  const toggleSeat = useCallback((seat: SeatAvailability) => {
    if (!seat.available) return;
    
    setSelectedSeats(prev => {
      const isSelected = prev.some(s => s.id === seat.id);
      if (isSelected) {
        return prev.filter(s => s.id !== seat.id);
      }
      if (prev.length >= MAX_SEATS) {
        toast({
          variant: "destructive",
          title: "Límite alcanzado",
          description: `Máximo ${MAX_SEATS} boletos por compra`,
        });
        return prev;
      }
      return [...prev, seat];
    });
  }, [toast]);

  // Update ticket quantity for general admission
  const updateTicketQuantity = useCallback((tierId: string, delta: number, maxQty: number = 10) => {
    setTicketQuantities(prev => {
      const current = prev[tierId] || 0;
      const newQty = Math.max(0, Math.min(maxQty, current + delta));
      const totalOther = Object.entries(prev)
        .filter(([id]) => id !== tierId)
        .reduce((sum, [, qty]) => sum + qty, 0);
      
      // Check max total
      if (newQty + totalOther > MAX_SEATS) {
        toast({
          variant: "destructive",
          title: "Límite alcanzado",
          description: `Máximo ${MAX_SEATS} boletos por compra`,
        });
        return prev;
      }
      
      return { ...prev, [tierId]: newQty };
    });
  }, [toast]);

  // Create reservation mutation
  const reservationMutation = useMutation({
    mutationFn: async () => {
      // Check if user is authenticated
      if (!token) {
        throw new Error("Debes iniciar sesión para comprar boletos");
      }
      
      const seats = selectedSeats.map(seat => ({
        seatId: seat.id,
        tierId: seat.zoneId ? pricesByZone.get(seat.zoneId)?.id : undefined,
        price: seat.price,
      }));
      return reservationsApi.create(sessionId!, seats);
    },
    onSuccess: (data) => {
      if (data.success && data.reservation) {
        setReservation(data.reservation);
        setReservedTicketIds(data.reservation.tickets.map(t => t.id));
        setStep("checkout");
        toast({
          title: "Asientos reservados",
          description: `Tienes ${RESERVATION_MINUTES} minutos para completar tu compra`,
        });
      } else {
        throw new Error(data.error || "Error al reservar asientos");
      }
    },
    onError: (error: any) => {
      const errorMessage = error?.message || error?.error || "Error desconocido al reservar";
      toast({
        variant: "destructive",
        title: "Error al reservar",
        description: errorMessage,
      });
      refetchAvailability();
    },
  });

  // Cancel reservation mutation
  const cancelReservationMutation = useMutation({
    mutationFn: () => reservationsApi.cancel(reservedTicketIds),
    onSuccess: () => {
      setReservation(null);
      setReservedTicketIds([]);
      setSelectedSeats([]);
      setStep("seats");
      refetchAvailability();
    },
  });

  // Confirm purchase mutation (with payment simulation)
  const confirmMutation = useMutation({
    mutationFn: async () => {
      // Step 1: Simulate payment processing
      setStep("processing");
      
      // ========== COURTESY FLOW (Admin only) ==========
      if (paymentMethod === "courtesy" && isAdmin) {
        // Use courtesy endpoint
        const courtesyPayload = {
          sessionId: sessionId!,
          recipientName: customerForm.name,
          recipientEmail: customerForm.email,
          recipientPhone: customerForm.phone || undefined,
          notes: "Cortesía emitida desde flujo de compra",
          // For seated events - ensure IDs are strings
          seatIds: isGeneralAdmission ? undefined : selectedSeats.map(s => String(s.id)),
          // For general admission
          tierId: isGeneralAdmission ? Object.keys(ticketQuantities).find(k => ticketQuantities[k] > 0) : undefined,
          quantity: isGeneralAdmission ? Object.values(ticketQuantities).reduce((a, b) => a + b, 0) : undefined,
        };
        
        console.log("Sending courtesy payload:", JSON.stringify(courtesyPayload, null, 2));
        
        const courtesyResponse = await fetch(`${API_BASE_URL}/api/admin/courtesies`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(courtesyPayload),
        });

        if (!courtesyResponse.ok) {
          const errData = await courtesyResponse.json().catch(() => ({}));
          console.error("Courtesy API error:", JSON.stringify(errData, null, 2));
          throw new Error(errData.error || "Error al emitir cortesía");
        }

        const courtesyData = await courtesyResponse.json();
        
        if (!courtesyData.success) {
          throw new Error(courtesyData.error || "Error al emitir cortesía");
        }

        return {
          order: { orderNumber: courtesyData.courtesy.orderNumber },
          ticketCodes: courtesyData.courtesy.ticketCodes,
          ticketCount: courtesyData.courtesy.ticketCount,
          isCourtesy: true,
        };
      }
      
      // ========== GENERAL ADMISSION FLOW ==========
      if (isGeneralAdmission) {
        // Build tickets array from quantities
        const ticketsToCreate = Object.entries(ticketQuantities)
          .filter(([, qty]) => qty > 0)
          .map(([tierId, quantity]) => ({ tierId, quantity }));

        if (ticketsToCreate.length === 0) {
          throw new Error("No hay boletos seleccionados");
        }

        // Direct purchase without seat reservation
        const purchaseData = await reservationsApi.purchaseGeneral({
          sessionId: sessionId!,
          tickets: ticketsToCreate,
          buyerName: customerForm.name,
          buyerEmail: customerForm.email,
          buyerPhone: customerForm.phone || undefined,
          couponCode: appliedCoupon?.code,
          couponDiscount: appliedCoupon?.discount,
        });

        if (!purchaseData.success) {
          throw new Error(purchaseData.error || "Error al procesar la compra");
        }

        return {
          order: purchaseData.order,
          ticketCodes: purchaseData.ticketCodes,
          ticketCount: purchaseData.ticketCount,
        };
      }
      
      // ========== SEATED EVENT FLOW ==========
      // For development/testing: Use simulate-success endpoint
      // For production with MercadoPago: Create preference and redirect to checkout
      
      // Simulate successful payment (development mode)
      // This endpoint creates the Order and confirms all tickets in one atomic operation
      const simulateResponse = await fetch(`${API_BASE_URL}/api/payments/simulate-success`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ticketIds: reservedTicketIds,
          buyerName: customerForm.name,
          buyerEmail: customerForm.email,
          buyerPhone: customerForm.phone || undefined,
        }),
      });
      
      if (!simulateResponse.ok) {
        const errData = await simulateResponse.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || "Error al procesar el pago simulado");
      }
      
      const simulateData = await simulateResponse.json();
      
      if (!simulateData.success) {
        throw new Error(simulateData.error || "Error al confirmar la compra");
      }
      
      // Note: In production, we would instead:
      // 1. Create MercadoPago preference with POST /api/payments/preference
      // 2. Redirect user to MercadoPago checkout
      // 3. Handle webhook callback to confirm tickets
      
      return simulateData;
    },
    onSuccess: (data: any) => {
      setPurchaseResult({
        orderId: data.order?.orderNumber,
        ticketCount: data.ticketCodes?.length || data.ticketCount || selectedSeats.length || totalGeneralTickets,
        totalPrice: data.isCourtesy ? 0 : totals.total,
        ticketCodes: data.ticketCodes,
        isCourtesy: data.isCourtesy || false,
      });
      setStep("confirmation");
      setReservation(null);
      setReservedTicketIds([]);
      setTicketQuantities({});
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error en la compra",
        description: error.message,
      });
      setStep("checkout");
    },
  });

  const handleProceedToCheckout = () => {
    // Validate selection based on event type
    if (isGeneralAdmission) {
      if (totalGeneralTickets === 0) {
        toast({
          variant: "destructive",
          title: "Selecciona boletos",
          description: "Debes seleccionar al menos un boleto",
        });
        return;
      }
    } else {
      if (selectedSeats.length === 0) {
        toast({
          variant: "destructive",
          title: "Selecciona asientos",
          description: "Debes seleccionar al menos un asiento",
        });
        return;
      }
    }
    
    // Check if user is logged in
    if (!token) {
      toast({
        variant: "destructive",
        title: "Inicia sesión",
        description: "Debes iniciar sesión para comprar boletos",
      });
      // Redirect to login with return URL
      navigate(`/login?redirect=/events/${eventId}/purchase?session=${sessionId}`);
      return;
    }
    
    // For general admission, skip reservation and go directly to checkout
    if (isGeneralAdmission) {
      setStep("checkout");
      return;
    }
    
    // For seated events, create reservation
    reservationMutation.mutate();
  };

  const handleCompletePurchase = () => {
    if (!customerForm.email) {
      toast({
        variant: "destructive",
        title: "Email requerido",
        description: "Ingresa tu email para recibir los boletos",
      });
      return;
    }
    if (!customerForm.name) {
      toast({
        variant: "destructive",
        title: "Nombre requerido",
        description: "Ingresa tu nombre para los boletos",
      });
      return;
    }
    
    // For general admission, process directly (no reservation needed)
    if (isGeneralAdmission) {
      confirmMutation.mutate();
      return;
    }
    
    // For courtesy payments (admin only), process directly without payment gateway
    if (paymentMethod === "courtesy" && isAdmin) {
      confirmMutation.mutate();
      return;
    }
    
    // For seated events with regular payment, go to payment step with embedded checkout
    setStep("payment");
  };

  const handleCancelCheckout = () => {
    if (step === "payment") {
      // Go back to checkout form from payment
      setStep("checkout");
      return;
    }
    
    if (reservation) {
      cancelReservationMutation.mutate();
    } else {
      // For general admission or if no reservation exists
      setStep("seats");
      if (isGeneralAdmission) {
        // Keep ticket quantities when going back
      }
    }
  };

  // Validate and apply coupon
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError("Ingresa un código de cupón");
      return;
    }

    setCouponLoading(true);
    setCouponError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/coupons/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          code: couponCode.toUpperCase(),
          subtotal: totals.subtotal + totals.fees,
          eventId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setCouponError(data.error || "Cupón no válido");
        return;
      }

      setAppliedCoupon(data.coupon);
      setCouponCode("");
      toast({
        title: "¡Cupón aplicado!",
        description: `Descuento de ${formatPrice(data.coupon.discount, config.currency)}`,
      });
    } catch (err) {
      setCouponError("Error al validar el cupón");
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponError("");
    toast({
      title: "Cupón removido",
      description: "El descuento ha sido eliminado",
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getSeatColor = (seat: SeatAvailability) => {
    if (!seat.available) return "bg-zinc-700 cursor-not-allowed";
    if (selectedSeats.some(s => s.id === seat.id)) return "bg-gold-500 ring-2 ring-gold-300";
    const zone = seat.zoneId ? zonesMap.get(seat.zoneId) : null;
    return zone?.color ? `hover:opacity-80` : "bg-emerald-500 hover:bg-emerald-400";
  };

  if (eventLoading || availabilityLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#050505] via-[#0a0a0a] to-[#050505]">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-gold-400" />
          <p className="mt-4 text-white/60">Cargando disponibilidad...</p>
        </div>
      </div>
    );
  }

  if (!event || !session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#050505] via-[#0a0a0a] to-[#050505]">
        <AlertCircle className="mb-4 h-16 w-16 text-red-400" />
        <h2 className="text-xl font-semibold text-white">Sesión no encontrada</h2>
        <Link to={`/events/${eventId}`} className="mt-4">
          <Button variant="outline">Volver al evento</Button>
        </Link>
      </div>
    );
  }

  // Processing Step
  if (step === "processing") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#050505] via-[#0a0a0a] to-[#050505]">
        <Card className="max-w-md border-gold-500/30 bg-gold-500/5">
          <CardContent className="p-8 text-center">
            <div className="relative mx-auto h-20 w-20">
              <div className="absolute inset-0 animate-ping rounded-full bg-gold-500/30" />
              <div className="relative flex h-full w-full items-center justify-center rounded-full bg-gold-500/20">
                <CreditCard className="h-10 w-10 text-gold-400" />
              </div>
            </div>
            <h2 className="mt-6 text-xl font-semibold text-white">Procesando pago...</h2>
            <p className="mt-2 text-white/60">No cierres esta ventana</p>
            <Progress className="mt-6" value={66} />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Confirmation Step
  if (step === "confirmation" && purchaseResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#050505] via-[#0a0a0a] to-[#050505]">
        <div className="container mx-auto max-w-2xl px-3 sm:px-4 py-8 sm:py-16">
          <Card className={`border-emerald-500/30 ${purchaseResult.isCourtesy ? 'bg-purple-500/5' : 'bg-emerald-500/5'}`}>
            <CardContent className="p-4 sm:p-8 text-center">
              {purchaseResult.isCourtesy ? (
                <Gift className="mx-auto h-14 w-14 sm:h-20 sm:w-20 text-purple-400" />
              ) : (
                <CheckCircle2 className="mx-auto h-14 w-14 sm:h-20 sm:w-20 text-emerald-400" />
              )}
              <h1 className="mt-4 sm:mt-6 text-2xl sm:text-3xl font-bold text-white">
                {purchaseResult.isCourtesy ? '¡Cortesía emitida!' : '¡Compra exitosa!'}
              </h1>
              <p className="mt-2 text-sm sm:text-base text-white/70">
                Tu orden #{purchaseResult.orderId} ha sido confirmada
              </p>
              {purchaseResult.isCourtesy && (
                <Badge className="mt-2 bg-purple-500/20 text-purple-300">
                  <Gift className="mr-1 h-3 w-3" /> Cortesía
                </Badge>
              )}

              <div className="mt-6 sm:mt-8 rounded-lg bg-white/5 p-4 sm:p-6 text-left">
                <h3 className="mb-3 sm:mb-4 text-sm sm:text-base font-semibold text-white">
                  {purchaseResult.isCourtesy ? 'Resumen de cortesía' : 'Resumen de compra'}
                </h3>
                <div className="space-y-2 text-xs sm:text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/60">Evento:</span>
                    <span className="text-white text-right ml-2 truncate max-w-[60%]">{event.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Fecha:</span>
                    <span className="text-white">{formatDate(session.startsAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Boletos:</span>
                    <span className="text-white">{purchaseResult.ticketCount}</span>
                  </div>
                  <Separator className="my-3 bg-white/10" />
                  <div className="flex justify-between text-base sm:text-lg font-bold">
                    <span className="text-white">Total:</span>
                    <span className={purchaseResult.isCourtesy ? 'text-purple-400' : 'text-emerald-400'}>
                      {purchaseResult.isCourtesy ? 'CORTESÍA' : formatPrice(purchaseResult.totalPrice || 0, config.currency)}
                    </span>
                  </div>
                </div>
              </div>

              {purchaseResult.ticketCodes && purchaseResult.ticketCodes.length > 0 && (
                <div className="mt-6 rounded-lg bg-white/5 p-4">
                  <h4 className="mb-2 text-sm font-medium text-white">Códigos de boletos:</h4>
                  <div className="flex flex-wrap gap-2">
                    {purchaseResult.ticketCodes.map((code: string) => (
                      <Badge key={code} variant="secondary" className="font-mono">
                        {code}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <p className="mt-6 text-sm text-white/60">
                Hemos enviado los boletos a {customerForm.email}
              </p>

              <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
                <Link to="/my-tickets">
                  <Button className="w-full sm:w-auto bg-gold-500 hover:bg-gold-600">
                    <Ticket className="mr-2 h-4 w-4" />
                    Ver mis boletos
                  </Button>
                </Link>
                <Link to="/events">
                  <Button variant="outline" className="w-full sm:w-auto">
                    Ver más eventos
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#050505] via-[#0a0a0a] to-[#050505]">
      {/* Navbar consistente */}
      <PublicNavbar />

      {/* Reservation Timer Bar */}
      {reservation && (step === "checkout" || step === "payment") && (
        <div className={`border-b ${countdown.isWarning ? 'bg-amber-500/20 border-amber-500/30' : 'bg-gold-500/10 border-gold-500/20'}`}>
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Timer className={`h-5 w-5 ${countdown.isWarning ? 'text-amber-400 animate-pulse' : 'text-gold-400'}`} />
                <div>
                  <p className={`text-sm font-medium ${countdown.isWarning ? 'text-amber-300' : 'text-gold-300'}`}>
                    Tiempo restante para completar la compra
                  </p>
                  <p className="text-xs text-white/60">
                    Los asientos están reservados temporalmente
                  </p>
                </div>
              </div>
              <div className={`text-2xl font-mono font-bold ${countdown.isWarning ? 'text-amber-400' : 'text-gold-400'}`}>
                {String(countdown.minutes).padStart(2, '0')}:{String(countdown.seconds).padStart(2, '0')}
              </div>
            </div>
            <Progress 
              value={countdown.progress} 
              className={`mt-2 h-1 ${countdown.isWarning ? '[&>div]:bg-amber-500' : '[&>div]:bg-gold-500'}`}
            />
          </div>
        </div>
      )}

      <div className="container mx-auto px-2 sm:px-4 py-3 sm:py-6 max-w-7xl">
        {/* Session Info */}
        <Card className="mb-3 sm:mb-6 border-white/10 bg-white/5">
          <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 p-2.5 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
              <div className="rounded-lg bg-gold-500/20 p-1.5 sm:p-2 flex-shrink-0">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-gold-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm sm:text-base font-medium text-white truncate">{session.title || "Función"}</p>
                <p className="text-[11px] sm:text-sm text-white/60">{formatDate(session.startsAt)}</p>
              </div>
            </div>
            {(!isGeneralAdmission || showRemainingTickets) && (
              <Badge className="bg-white/10 text-[10px] sm:text-sm mt-1 sm:mt-0 self-start sm:self-auto">
                {availability?.stats?.available ?? 0} disponibles
              </Badge>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:gap-6 grid-cols-1 lg:grid-cols-3">
          {/* Seat Map / Checkout Form */}
          <div className="lg:col-span-2 order-1 lg:order-1">
            <Card className="border-white/10 bg-white/5 overflow-hidden">
              <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-4">
                <CardTitle className="text-sm sm:text-lg text-white">
                  {step === "seats" 
                    ? (isGeneralAdmission ? "Selecciona tus boletos" : "Selecciona tus asientos") 
                    : "Completa tu compra"}
                </CardTitle>
                <CardDescription className="text-[11px] sm:text-sm">
                  {step === "seats"
                    ? `Máximo ${MAX_SEATS} ${isGeneralAdmission ? 'boletos' : 'asientos'}`
                    : "Ingresa tus datos para finalizar"}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-2 sm:p-6 pt-0">
                {step === "seats" ? (
                  <>
                    {/* ========== GENERAL ADMISSION UI ========== */}
                    {isGeneralAdmission ? (
                      <div className="space-y-3 sm:space-y-4">
                        {/* Info card */}
                        <div className="rounded-lg bg-gold-500/10 border border-gold-500/30 p-2.5 sm:p-4 mb-3 sm:mb-6">
                          <div className="flex items-start gap-2 sm:gap-3">
                            <Users className="h-4 w-4 sm:h-5 sm:w-5 text-gold-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs sm:text-base font-medium text-gold-300">Evento de Admisión General</p>
                              <p className="text-[10px] sm:text-sm text-gold-200/70">
                                Selecciona la cantidad de boletos.
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Ticket Types - Use availability data for real-time stock */}
                        <div className="space-y-2 sm:space-y-3">
                          {/* Use tiers from availability endpoint if available (has real-time stock), else fall back to event.priceTiers */}
                          {(availability?.tiers ?? event?.priceTiers ?? []).map((tier: any) => {
                            const qty = ticketQuantities[tier.id] || 0;
                            // For availability tiers, use available count; for event tiers, use capacity
                            const tierAvailable = tier.available !== undefined ? tier.available : (tier.capacity || null);
                            const maxQty = tierAvailable !== null 
                              ? Math.min(10, tierAvailable) 
                              : 10;
                            const isOutOfStock = tierAvailable !== null && tierAvailable === 0;
                            return (
                              <div 
                                key={tier.id}
                                className={`flex flex-row items-center justify-between p-2.5 sm:p-4 rounded-xl border gap-2 sm:gap-4 ${
                                  isOutOfStock 
                                    ? 'border-red-500/30 bg-red-500/5 opacity-60' 
                                    : 'border-white/10 bg-white/5'
                                }`}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                    <p className="text-xs sm:text-base font-medium text-white truncate">{tier.label}</p>
                                    {isOutOfStock && (
                                      <Badge variant="destructive" className="text-[8px] sm:text-xs px-1 py-0">Agotado</Badge>
                                    )}
                                  </div>
                                  <p className="text-sm sm:text-lg font-bold text-emerald-400">
                                    {formatPrice(tier.price, config.currency)}
                                  </p>
                                  {showRemainingTickets && tierAvailable !== null && !isOutOfStock && (
                                    <p className="text-[9px] sm:text-xs text-white/50">{tierAvailable} disponibles</p>
                                  )}
                                </div>
                                
                                {/* Quantity Selector */}
                                <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-7 w-7 sm:h-9 sm:w-9 rounded-full border-white/20 bg-white/5 hover:bg-white/10"
                                    onClick={() => updateTicketQuantity(tier.id, -1, maxQty)}
                                    disabled={qty === 0 || isOutOfStock}
                                  >
                                    <Minus className="h-3 w-3 sm:h-4 sm:w-4" />
                                  </Button>
                                  <span className="w-6 sm:w-8 text-center text-sm sm:text-lg font-semibold text-white">
                                    {qty}
                                  </span>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-7 w-7 sm:h-9 sm:w-9 rounded-full border-white/20 bg-white/5 hover:bg-white/10"
                                    onClick={() => updateTicketQuantity(tier.id, 1, maxQty)}
                                    disabled={totalGeneralTickets >= MAX_SEATS || isOutOfStock || qty >= maxQty}
                                  >
                                    <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Empty state */}
                        {(availability?.tiers ?? event?.priceTiers ?? []).length === 0 && (
                          <div className="text-center py-8 text-white/60">
                            <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No hay tipos de boleto configurados para este evento.</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* ========== SEATED EVENT UI ========== */
                      <>
                        {/* Debug info */}
                        {availability?.seats?.length === 0 && (
                          <div className="mb-4 rounded-lg bg-amber-500/10 border border-amber-500/30 p-4">
                            <div className="flex items-start gap-3">
                              <AlertCircle className="h-5 w-5 text-amber-400 mt-0.5" />
                              <div>
                                <p className="font-medium text-amber-300">No hay asientos disponibles</p>
                                <p className="text-sm text-amber-200/70 mt-1">
                                  {!availability?.seats ? "No se pudo cargar la información de asientos." : "No hay asientos configurados para esta sesión."}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Legend */}
                        <div className="mb-3 sm:mb-6 flex flex-wrap justify-center sm:justify-start gap-2 sm:gap-4 text-[10px] sm:text-sm px-1">
                          <div className="flex items-center gap-1 sm:gap-2">
                            <div className="h-2.5 w-2.5 sm:h-4 sm:w-4 rounded bg-emerald-500" />
                            <span className="text-white/60">Disponible</span>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-2">
                            <div className="h-2.5 w-2.5 sm:h-4 sm:w-4 rounded bg-gold-500 ring-2 ring-gold-300" />
                            <span className="text-white/60">Seleccionado</span>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-2">
                            <div className="h-2.5 w-2.5 sm:h-4 sm:w-4 rounded bg-zinc-700" />
                            <span className="text-white/60">No disponible</span>
                          </div>
                        </div>

                        {/* Stage indicator */}
                        <div className="mb-4 sm:mb-8 rounded-lg bg-gradient-to-r from-amber-500/20 to-gold-500/20 p-2 sm:p-4 text-center border border-white/10 mx-1 sm:mx-0">
                          <span className="text-[10px] sm:text-sm font-medium text-white">🎭 ESCENARIO</span>
                        </div>

                        {/* Visual Seat Map - Supports both flat and hierarchical layouts */}
                        {availability?.seats && availability.seats.length > 0 && eventId && sessionId && (
                          <HierarchicalSeatMap
                            eventId={eventId}
                            sessionId={sessionId}
                            selectedSeats={selectedSeats}
                            onSeatSelect={toggleSeat}
                          />
                        )}
                      </>
                    )}
                  </>
                ) : (
                  /* Checkout Form */
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-white/70">
                        <User className="h-4 w-4" />
                        Nombre completo *
                      </Label>
                      <Input
                        value={customerForm.name}
                        onChange={(e) => setCustomerForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Juan Pérez"
                        className="border-white/20 bg-white/5"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-white/70">
                        <Mail className="h-4 w-4" />
                        Email *
                      </Label>
                      <Input
                        type="email"
                        value={customerForm.email}
                        onChange={(e) => setCustomerForm(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="tu@email.com"
                        className="border-white/20 bg-white/5"
                        required
                      />
                      <p className="text-xs text-white/50">
                        Los boletos se enviarán a este correo
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-white/70">
                        <Phone className="h-4 w-4" />
                        Teléfono (opcional)
                      </Label>
                      <Input
                        type="tel"
                        value={customerForm.phone}
                        onChange={(e) => setCustomerForm(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="+52 55 1234 5678"
                        className="border-white/20 bg-white/5"
                      />
                    </div>

                    <Separator className="my-4 bg-white/10" />

                    {/* Payment Method Selector - Only for Admin */}
                    {isAdmin && (
                      <div className="space-y-2 mb-4">
                        <Label className="flex items-center gap-2 text-white/70">
                          <CreditCard className="h-4 w-4" />
                          Método de Pago
                        </Label>
                        <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as "card" | "courtesy")}>
                          <SelectTrigger className="border-white/20 bg-white/5">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="card">
                              <div className="flex items-center gap-2">
                                <CreditCard className="h-4 w-4" />
                                <span>Tarjeta de Crédito/Débito</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="courtesy">
                              <div className="flex items-center gap-2">
                                <Gift className="h-4 w-4 text-amber-400" />
                                <span>Cortesía (sin cargo)</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        {paymentMethod === "courtesy" && (
                          <p className="text-xs text-amber-400">
                            Los boletos se emitirán como cortesía sin costo
                          </p>
                        )}
                      </div>
                    )}

                    {paymentMethod === "card" ? (
                      <div className="rounded-lg bg-gold-500/10 border border-gold-500/30 p-4">
                        <div className="flex items-start gap-3">
                          <CreditCard className="h-5 w-5 text-gold-400 mt-0.5" />
                          <div>
                            <p className="font-medium text-gold-300">Pago Seguro</p>
                            <p className="text-sm text-gold-200/70">
                              En el siguiente paso podrás ingresar los datos de tu tarjeta de forma segura
                              con MercadoPago. Aceptamos Visa, Mastercard y American Express.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-4">
                        <div className="flex items-start gap-3">
                          <Gift className="h-5 w-5 text-amber-400 mt-0.5" />
                          <div>
                            <p className="font-medium text-amber-300">Boletos de Cortesía</p>
                            <p className="text-sm text-amber-200/70">
                              Se emitirán boletos sin costo. Esta opción solo está disponible para administradores.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {countdown.isWarning && (
                      <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5" />
                          <div>
                            <p className="font-medium text-amber-300">¡Tiempo limitado!</p>
                            <p className="text-sm text-amber-200/70">
                              Te quedan menos de 2 minutos para completar tu compra.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Payment Step - Embedded MercadoPago */}
          {step === "payment" && (
            <div className="lg:col-span-2">
              <MercadoPagoCheckout
                amount={totals.total}
                currency={config.currency}
                ticketIds={reservedTicketIds}
                buyerName={customerForm.name}
                buyerEmail={customerForm.email}
                buyerPhone={customerForm.phone}
                eventName={event.name}
                onSuccess={(data) => {
                  setPurchaseResult({
                    orderId: data.orderNumber,
                    ticketCount: data.ticketCodes?.length || selectedSeats.length || totalGeneralTickets,
                    totalPrice: totals.total,
                    ticketCodes: data.ticketCodes,
                  });
                  setStep("confirmation");
                  setReservation(null);
                  setReservedTicketIds([]);
                  setTicketQuantities({});
                }}
                onError={(error) => {
                  toast({
                    variant: "destructive",
                    title: "Error en el pago",
                    description: error,
                  });
                  setStep("checkout");
                }}
                onCancel={() => setStep("checkout")}
                className="w-full"
              />
            </div>
          )}

          {/* Order Summary - hide when payment step since MercadoPagoCheckout has its own summary */}
          {step !== "payment" && (
          <div className="lg:col-span-1 order-2 lg:order-2">
            <div className="lg:sticky lg:top-24">
              <Card className="border-white/10 bg-white/5">
                <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-4">
                  <CardTitle className="text-sm sm:text-lg text-white">Resumen de compra</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5 sm:space-y-4 p-3 sm:p-6 pt-0">
                  {/* Selected Items - Different UI for seated vs general */}
                  {isGeneralAdmission ? (
                    /* General Admission Summary */
                    totalGeneralTickets === 0 ? (
                      <p className="text-xs sm:text-sm text-white/60">
                        No has seleccionado boletos
                      </p>
                    ) : (
                      <div className="space-y-1.5 sm:space-y-2">
                        {(availability?.tiers ?? event?.priceTiers ?? []).map((tier: any) => {
                          const qty = ticketQuantities[tier.id] || 0;
                          if (qty === 0) return null;
                          return (
                            <div
                              key={tier.id}
                              className="flex items-center justify-between rounded bg-white/5 p-1.5 sm:p-2"
                            >
                              <div className="flex items-center gap-1.5 sm:gap-2">
                                <span className="text-xs sm:text-sm text-white truncate max-w-[100px] sm:max-w-none">{tier.label}</span>
                                <span className="text-[10px] sm:text-xs text-white/60">x{qty}</span>
                              </div>
                              <span className="text-xs sm:text-sm text-white/60">
                                {formatPrice(tier.price * qty, config.currency)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )
                  ) : (
                    /* Seated Event Summary */
                    selectedSeats.length === 0 ? (
                      <p className="text-xs sm:text-sm text-white/60">
                        No has seleccionado asientos
                      </p>
                    ) : (
                      <div className="max-h-36 sm:max-h-48 space-y-1.5 sm:space-y-2 overflow-y-auto">
                        {selectedSeats.map(seat => {
                          const zone = seat.zoneId ? zonesMap.get(seat.zoneId) : null;
                          return (
                            <div
                              key={seat.id}
                              className="flex items-center justify-between rounded bg-white/5 p-1.5 sm:p-2"
                            >
                              <div className="flex items-center gap-1.5 sm:gap-2">
                                <div
                                  className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full"
                                  style={{ backgroundColor: zone?.color || "#64748b" }}
                                />
                                <span className="text-xs sm:text-sm text-white">{seat.label}</span>
                              </div>
                              <div className="flex items-center gap-1.5 sm:gap-2">
                                <span className="text-[10px] sm:text-sm text-white/60">
                                  {formatPrice(seat.price, config.currency)}
                                  {seat.fee > 0 && (
                                    <span className="text-[8px] sm:text-xs ml-0.5 sm:ml-1">+ {formatPrice(seat.fee, config.currency)} fee</span>
                                  )}
                                </span>
                                {step === "seats" && (
                                  <button
                                    onClick={() => toggleSeat(seat)}
                                    className="text-white/60 hover:text-red-400"
                                  >
                                    <X className="h-3 w-3 sm:h-4 sm:w-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}

                  <Separator className="bg-white/10" />

                  {/* Coupon Section */}
                  {step === "checkout" && (
                    <div className="space-y-3">
                      {appliedCoupon ? (
                        <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3">
                          <div className="flex items-center gap-2">
                            <TicketPercent className="h-4 w-4 text-emerald-400" />
                            <div>
                              <p className="text-sm font-medium text-emerald-300">{appliedCoupon.code}</p>
                              <p className="text-xs text-emerald-400/70">
                                {appliedCoupon.discountType === "PERCENTAGE"
                                  ? `${appliedCoupon.discountValue}% de descuento`
                                  : `$${appliedCoupon.discountValue} de descuento`}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={handleRemoveCoupon}
                            className="text-emerald-400 hover:text-emerald-300"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <Input
                              placeholder="Código de cupón"
                              value={couponCode}
                              onChange={(e) => {
                                setCouponCode(e.target.value.toUpperCase());
                                setCouponError("");
                              }}
                              className="border-white/20 bg-white/5 text-sm uppercase"
                              disabled={couponLoading}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleApplyCoupon}
                              disabled={couponLoading || !couponCode.trim()}
                              className="border-white/20 shrink-0"
                            >
                              {couponLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Tag className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          {couponError && (
                            <p className="text-xs text-red-400">{couponError}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Totals */}
                  <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                    <div className="flex justify-between">
                      <span className="text-white/60">
                        Subtotal ({isGeneralAdmission ? totalGeneralTickets : selectedSeats.length} boletos)
                      </span>
                      <span className="text-white">{formatPrice(totals.subtotal, config.currency)}</span>
                    </div>
                    {totals.fees > 0 && (
                      <div className="flex justify-between">
                        <span className="text-white/60">Cargo por servicio</span>
                        <span className="text-white">{formatPrice(totals.fees, config.currency)}</span>
                      </div>
                    )}
                    {totals.discount > 0 && (
                      <div className="flex justify-between text-emerald-400">
                        <span>Descuento ({appliedCoupon?.code})</span>
                        <span>-{formatPrice(totals.discount, config.currency)}</span>
                      </div>
                    )}
                    <Separator className="bg-white/10" />
                    <div className="flex justify-between text-base sm:text-lg font-bold">
                      <span className="text-white">Total</span>
                      <span className="text-gold-400">{formatPrice(totals.total, config.currency)}</span>
                    </div>
                  </div>

                  {/* Action Button */}
                  {step === "seats" ? (
                    <Button
                      className="w-full bg-gold-500 hover:bg-gold-600 text-sm sm:text-base"
                      disabled={(isGeneralAdmission ? totalGeneralTickets === 0 : selectedSeats.length === 0) || reservationMutation.isPending}
                      onClick={handleProceedToCheckout}
                    >
                      {reservationMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                          Reservando...
                        </>
                      ) : (
                        "Continuar al pago"
                      )}
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <Button
                        className={`w-full text-sm sm:text-base ${paymentMethod === "courtesy" && isAdmin ? "bg-purple-500 hover:bg-purple-600" : "bg-emerald-500 hover:bg-emerald-600"}`}
                        disabled={confirmMutation.isPending || !customerForm.email || !customerForm.name}
                        onClick={handleCompletePurchase}
                      >
                        {confirmMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                            Procesando...
                          </>
                        ) : paymentMethod === "courtesy" && isAdmin ? (
                          <>
                            <Gift className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                            Emitir cortesía
                          </>
                        ) : (
                          <>
                            <CreditCard className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                            {isGeneralAdmission ? "Confirmar compra" : "Ir al pago"}
                          </>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        className="w-full text-xs sm:text-sm text-white/60 hover:text-white"
                        onClick={handleCancelCheckout}
                        disabled={confirmMutation.isPending || cancelReservationMutation.isPending}
                      >
                        {cancelReservationMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                            Cancelando...
                          </>
                        ) : (
                          "Cancelar y volver"
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventPurchase;
