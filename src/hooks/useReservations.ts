import { useState, useCallback, useEffect, useRef } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

// Helper function for API calls
async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("auth_token");
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || data.message || "API Error");
  }

  return data;
}

export interface ReservedTicket {
  id: string;
  seatId: string | null;
  tierId: string | null;
  price: number;
}

export interface Reservation {
  id: string;
  expiresAt: Date;
  expiresIn: number;
  expiresInMinutes: number;
  tickets: ReservedTicket[];
  session: {
    id: string;
    eventId: string;
    eventName: string;
    startsAt: string;
  };
}

export interface SeatStatus {
  [seatId: string]: {
    status: "RESERVED" | "SOLD";
    expiresAt?: string;
  };
}

export function useReservations() {
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingTime, setRemainingTime] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Timer para countdown
  useEffect(() => {
    if (reservation && remainingTime > 0) {
      timerRef.current = setInterval(() => {
        setRemainingTime((prev) => {
          if (prev <= 1000) {
            // Reserva expirada
            setReservation(null);
            return 0;
          }
          return prev - 1000;
        });
      }, 1000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }
  }, [reservation]);

  // Crear reserva
  const createReservation = useCallback(
    async (
      sessionId: string,
      seats: Array<{ seatId: string; tierId?: string; price: number }>
    ) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await apiFetch<{
          success: boolean;
          error?: string;
          reservation: Reservation & {
            expiresAt: string;
          };
        }>("/api/reservations", {
          method: "POST",
          body: JSON.stringify({ sessionId, seats }),
        });

        if (!response.success) {
          throw new Error(response.error || "Error al crear reserva");
        }

        const newReservation: Reservation = {
          ...response.reservation,
          expiresAt: new Date(response.reservation.expiresAt),
        };

        setReservation(newReservation);
        setRemainingTime(newReservation.expiresIn);

        return { success: true, reservation: newReservation };
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.error || err.message || "Error al crear reserva";
        setError(errorMessage);
        return { success: false, error: errorMessage };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Cancelar reserva
  const cancelReservation = useCallback(async () => {
    if (!reservation) return { success: false, error: "No hay reserva activa" };

    setIsLoading(true);
    setError(null);

    try {
      const ticketIds = reservation.tickets.map((t) => t.id);
      const response = await apiFetch<{ success: boolean; error?: string }>(
        "/api/reservations",
        {
          method: "DELETE",
          body: JSON.stringify({ ticketIds }),
        }
      );

      if (!response.success) {
        throw new Error(response.error || "Error al cancelar reserva");
      }

      setReservation(null);
      setRemainingTime(0);

      return { success: true };
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.error || err.message || "Error al cancelar reserva";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [reservation]);

  // Confirmar reserva (después del pago)
  const confirmReservation = useCallback(
    async (paymentData: {
      paymentReference?: string;
      paymentMethod?: string;
      buyerName: string;
      buyerEmail: string;
      buyerPhone?: string;
    }) => {
      if (!reservation)
        return { success: false, error: "No hay reserva activa" };

      setIsLoading(true);
      setError(null);

      try {
        const ticketIds = reservation.tickets.map((t) => t.id);
        const response = await apiFetch<{
          success: boolean;
          error?: string;
          order: unknown;
          ticketCodes: string[];
        }>("/api/reservations/confirm", {
          method: "POST",
          body: JSON.stringify({ ticketIds, ...paymentData }),
        });

        if (!response.success) {
          throw new Error(response.error || "Error al confirmar reserva");
        }

        setReservation(null);
        setRemainingTime(0);

        return {
          success: true,
          order: response.order,
          ticketCodes: response.ticketCodes,
        };
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.error ||
          err.message ||
          "Error al confirmar reserva";
        setError(errorMessage);
        return { success: false, error: errorMessage };
      } finally {
        setIsLoading(false);
      }
    },
    [reservation]
  );

  // Verificar disponibilidad de un asiento
  const checkSeatAvailability = useCallback(
    async (sessionId: string, seatId: string) => {
      try {
        const response = await apiFetch<{ available: boolean }>(
          `/api/reservations/check/${sessionId}/${seatId}`
        );
        return response;
      } catch (err: any) {
        return { available: false, error: err.message };
      }
    },
    []
  );

  // Obtener estado de todos los asientos de una sesión
  const getSessionSeatsStatus = useCallback(async (sessionId: string) => {
    try {
      const response = await apiFetch<{
        seats: SeatStatus;
        totalReserved: number;
        totalSold: number;
      }>(`/api/reservations/session/${sessionId}/status`);
      return {
        success: true,
        seats: response.seats,
        totalReserved: response.totalReserved,
        totalSold: response.totalSold,
      };
    } catch (err: any) {
      return { success: false, error: err.message, seats: {} as SeatStatus };
    }
  }, []);

  // Formatear tiempo restante para mostrar
  const formatRemainingTime = useCallback(() => {
    if (remainingTime <= 0) return "00:00";

    const minutes = Math.floor(remainingTime / 60000);
    const seconds = Math.floor((remainingTime % 60000) / 1000);

    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }, [remainingTime]);

  // Calcular total de la reserva
  const getTotal = useCallback(() => {
    if (!reservation) return 0;
    return reservation.tickets.reduce((sum, t) => sum + t.price, 0);
  }, [reservation]);

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return {
    // Estado
    reservation,
    isLoading,
    error,
    remainingTime,
    formattedTime: formatRemainingTime(),
    total: getTotal(),
    hasReservation: !!reservation,
    isExpired: reservation && remainingTime <= 0,

    // Acciones
    createReservation,
    cancelReservation,
    confirmReservation,
    checkSeatAvailability,
    getSessionSeatsStatus,
    clearError: () => setError(null),
  };
}
