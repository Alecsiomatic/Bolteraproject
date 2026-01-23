import { query, withTransaction } from "./db";
import { RowDataPacket } from "mysql2";
import { randomUUID } from "crypto";

// Configuración de reservas
export const RESERVATION_TIMEOUT_MINUTES = 15;
export const RESERVATION_TIMEOUT_MS = RESERVATION_TIMEOUT_MINUTES * 60 * 1000;

// Tipos
export interface ReservationResult {
  success: boolean;
  reservationId?: string;
  expiresAt?: Date;
  tickets?: Array<{
    id: string;
    seatId: string | null;
    tierId: string | null;
    price: number;
  }>;
  error?: string;
}

export interface SeatToReserve {
  seatId: string;
  tierId?: string;
  price: number;
}

/**
 * Reserva asientos temporalmente (15 minutos)
 * Los asientos quedan en estado RESERVED hasta que:
 * - Se confirme el pago → SOLD
 * - Expire el timeout → AVAILABLE (tickets eliminados)
 */
export async function reserveSeats(
  sessionId: string,
  seats: SeatToReserve[],
  holderEmail?: string
): Promise<ReservationResult> {
  try {
    const result = await withTransaction(async (connection) => {
      const reservationId = randomUUID();
      const expiresAt = new Date(Date.now() + RESERVATION_TIMEOUT_MS);
      const tickets: Array<{ id: string; seatId: string | null; tierId: string | null; price: number }> = [];

      // 1. Verificar que los asientos no estén ya reservados o vendidos
      for (const seat of seats) {
        const [existingTicket] = await connection.query<RowDataPacket[]>(
          `SELECT t.id, t.status, t.createdAt 
           FROM Ticket t 
           WHERE t.sessionId = ? AND t.seatId = ? AND t.status IN ('RESERVED', 'SOLD')
           FOR UPDATE`,
          [sessionId, seat.seatId]
        );

        const existing = (existingTicket as RowDataPacket[])[0];
        
        if (existing) {
          // Si está reservado, verificar si expiró
          if (existing.status === 'RESERVED') {
            const createdAt = new Date(existing.createdAt);
            const now = new Date();
            const diffMs = now.getTime() - createdAt.getTime();
            
            if (diffMs < RESERVATION_TIMEOUT_MS) {
              // Reserva vigente de otro usuario
              throw new Error(`El asiento ya está reservado por otro usuario`);
            }
            // Reserva expirada, eliminarla
            await connection.query(`DELETE FROM Ticket WHERE id = ?`, [existing.id]);
          } else {
            // Vendido
            throw new Error(`El asiento ya fue vendido`);
          }
        }
      }

      // 2. Crear tickets con estado RESERVED
      for (const seat of seats) {
        const ticketId = randomUUID();
        
        await connection.query(
          `INSERT INTO Ticket (id, sessionId, seatId, tierId, price, currency, status, holderEmail, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, 'MXN', 'RESERVED', ?, NOW(), NOW())`,
          [ticketId, sessionId, seat.seatId, seat.tierId || null, seat.price, holderEmail || null]
        );

        tickets.push({
          id: ticketId,
          seatId: seat.seatId,
          tierId: seat.tierId || null,
          price: seat.price,
        });
      }

      // 3. Actualizar status de los asientos en la tabla Seat
      const seatIds = seats.map(s => s.seatId);
      if (seatIds.length > 0) {
        await connection.query(
          `UPDATE Seat SET status = 'RESERVED', updatedAt = NOW() WHERE id IN (?)`,
          [seatIds]
        );
      }

      return {
        reservationId,
        expiresAt,
        tickets,
      };
    });

    return {
      success: true,
      reservationId: result.reservationId,
      expiresAt: result.expiresAt,
      tickets: result.tickets,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Error al reservar asientos",
    };
  }
}

/**
 * Confirma una reserva (cuando el pago es exitoso)
 * Cambia status de RESERVED a SOLD
 */
export async function confirmReservation(
  ticketIds: string[],
  orderId: string,
  paymentData: {
    paymentReference?: string;
    paymentMethod?: string;
    holderName?: string;
    holderEmail?: string;
  }
): Promise<{ success: boolean; ticketCodes: string[]; error?: string }> {
  try {
    const ticketCodes: string[] = [];
    
    await withTransaction(async (connection) => {
      for (const ticketId of ticketIds) {
        // Verificar que el ticket existe y está RESERVED
        const [ticketResult] = await connection.query<RowDataPacket[]>(
          `SELECT id, seatId, status FROM Ticket WHERE id = ? FOR UPDATE`,
          [ticketId]
        );
        
        const ticket = (ticketResult as RowDataPacket[])[0];
        if (!ticket) {
          throw new Error(`Ticket ${ticketId} no encontrado`);
        }
        if (ticket.status !== 'RESERVED') {
          throw new Error(`Ticket ${ticketId} no está en estado reservado`);
        }

        // Generar código único para el QR
        const ticketCode = generateTicketCode();
        ticketCodes.push(ticketCode);

        // Actualizar ticket a SOLD
        await connection.query(
          `UPDATE Ticket 
           SET status = 'SOLD', 
               orderId = ?, 
               ticketCode = ?,
               holderName = COALESCE(?, holderName),
               holderEmail = COALESCE(?, holderEmail),
               purchasedAt = NOW(),
               updatedAt = NOW()
           WHERE id = ?`,
          [orderId, ticketCode, paymentData.holderName, paymentData.holderEmail, ticketId]
        );

        // Actualizar estado del asiento a SOLD
        if (ticket.seatId) {
          await connection.query(
            `UPDATE Seat SET status = 'SOLD', updatedAt = NOW() WHERE id = ?`,
            [ticket.seatId]
          );
        }
      }

      // Actualizar la orden
      await connection.query(
        `UPDATE \`Order\` 
         SET status = 'PAID',
             paymentReference = ?,
             paymentMethod = ?,
             paidAt = NOW(),
             updatedAt = NOW()
         WHERE id = ?`,
        [paymentData.paymentReference, paymentData.paymentMethod, orderId]
      );
    });

    return { success: true, ticketCodes };
  } catch (error: any) {
    return { success: false, ticketCodes: [], error: error.message };
  }
}

/**
 * Cancela una reserva (timeout o cancelación manual)
 * Elimina los tickets y libera los asientos
 */
export async function cancelReservation(ticketIds: string[]): Promise<{ success: boolean; error?: string }> {
  try {
    await withTransaction(async (connection) => {
      for (const ticketId of ticketIds) {
        // Obtener el ticket
        const [ticketResult] = await connection.query<RowDataPacket[]>(
          `SELECT id, seatId, status FROM Ticket WHERE id = ? FOR UPDATE`,
          [ticketId]
        );
        
        const ticket = (ticketResult as RowDataPacket[])[0];
        if (!ticket) continue;

        // Solo cancelar si está RESERVED o PENDING
        if (ticket.status !== 'RESERVED' && ticket.status !== 'PENDING') continue;

        // Liberar el asiento
        if (ticket.seatId) {
          await connection.query(
            `UPDATE Seat SET status = 'AVAILABLE', updatedAt = NOW() WHERE id = ?`,
            [ticket.seatId]
          );
        }

        // Eliminar el ticket
        await connection.query(`DELETE FROM Ticket WHERE id = ?`, [ticketId]);
      }
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Limpia reservas expiradas (ejecutar periódicamente)
 */
export async function cleanupExpiredReservations(): Promise<{ cleaned: number }> {
  const expirationTime = new Date(Date.now() - RESERVATION_TIMEOUT_MS);
  
  // Obtener tickets RESERVED que expiraron
  const expiredTickets = await query<RowDataPacket[]>(
    `SELECT id, seatId FROM Ticket 
     WHERE status = 'RESERVED' AND createdAt < ?`,
    [expirationTime]
  );

  if (expiredTickets.length === 0) {
    return { cleaned: 0 };
  }

  const ticketIds = expiredTickets.map(t => t.id);
  const seatIds = expiredTickets.map(t => t.seatId).filter(Boolean);

  // Liberar asientos
  if (seatIds.length > 0) {
    await query(
      `UPDATE Seat SET status = 'AVAILABLE', updatedAt = NOW() WHERE id IN (?)`,
      [seatIds]
    );
  }

  // Eliminar tickets expirados
  await query(`DELETE FROM Ticket WHERE id IN (?)`, [ticketIds]);

  return { cleaned: ticketIds.length };
}

/**
 * Genera un código único para el ticket (para QR)
 * Formato: BOL-XXXXXX-XXXX (12 caracteres alfanuméricos)
 */
function generateTicketCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sin I, O, 0, 1 para evitar confusión
  const part1 = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const part2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `BOL-${part1}-${part2}`;
}

/**
 * Verifica si un asiento específico está disponible
 */
export async function checkSeatAvailability(
  sessionId: string,
  seatId: string
): Promise<{ available: boolean; status?: string }> {
  // Verificar en tickets
  const [ticket] = await query<RowDataPacket[]>(
    `SELECT t.id, t.status, t.createdAt 
     FROM Ticket t 
     WHERE t.sessionId = ? AND t.seatId = ? AND t.status IN ('RESERVED', 'SOLD')
     LIMIT 1`,
    [sessionId, seatId]
  );

  if (!ticket) {
    return { available: true };
  }

  if (ticket.status === 'SOLD') {
    return { available: false, status: 'SOLD' };
  }

  // Verificar si la reserva expiró
  const createdAt = new Date(ticket.createdAt);
  const now = new Date();
  const diffMs = now.getTime() - createdAt.getTime();

  if (diffMs >= RESERVATION_TIMEOUT_MS) {
    // Reserva expirada, el asiento está disponible
    return { available: true, status: 'EXPIRED_RESERVATION' };
  }

  return { available: false, status: 'RESERVED' };
}

/**
 * Obtiene el tiempo restante de una reserva
 */
export function getReservationTimeRemaining(createdAt: Date): number {
  const now = new Date();
  const expiresAt = new Date(createdAt.getTime() + RESERVATION_TIMEOUT_MS);
  const remaining = expiresAt.getTime() - now.getTime();
  return Math.max(0, remaining);
}
