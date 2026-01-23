import { FastifyInstance } from "fastify";
import { query } from "../lib/db";
import { RowDataPacket } from "mysql2";
import { randomUUID } from "crypto";
import {
  reserveSeats,
  confirmReservation,
  cancelReservation,
  checkSeatAvailability,
  cleanupExpiredReservations,
  RESERVATION_TIMEOUT_MINUTES,
  RESERVATION_TIMEOUT_MS,
} from "../lib/reservations";
import { requireAuth } from "../lib/authMiddleware";

export async function reservationsRoutes(app: FastifyInstance) {
  
  // POST /api/reservations - Crear una reserva temporal
  app.post("/", {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { sessionId, seats } = request.body as {
        sessionId: string;
        seats: Array<{ seatId: string; tierId?: string; price: number }>;
      };
      const user = (request as any).user;

      if (!sessionId || !seats || seats.length === 0) {
        return reply.status(400).send({
          success: false,
          error: "sessionId y seats son requeridos",
        });
      }

      // Verificar que la sesión existe y está activa
      const [session] = await query<RowDataPacket[]>(
        `SELECT s.id, s.eventId, s.startsAt, e.name as eventName
         FROM EventSession s
         JOIN Event e ON e.id = s.eventId
         WHERE s.id = ? AND s.startsAt > NOW()`,
        [sessionId]
      );

      if (!session) {
        return reply.status(404).send({
          success: false,
          error: "Sesión no encontrada o ya pasó",
        });
      }

      // Reservar asientos
      const result = await reserveSeats(sessionId, seats, user.email);

      if (!result.success) {
        return reply.status(409).send({
          success: false,
          error: result.error,
        });
      }

      return reply.send({
        success: true,
        reservation: {
          id: result.reservationId,
          expiresAt: result.expiresAt?.toISOString(),
          expiresIn: RESERVATION_TIMEOUT_MS,
          expiresInMinutes: RESERVATION_TIMEOUT_MINUTES,
          tickets: result.tickets,
          session: {
            id: session.id,
            eventId: session.eventId,
            eventName: session.eventName,
            startsAt: session.startsAt,
          },
        },
      });
    },
  });

  // GET /api/reservations/:id - Obtener detalles de una reserva
  app.get<{ Params: { id: string } }>("/:id", {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { id } = request.params;
      const user = (request as any).user;

      // Obtener tickets de esta reserva (por el reservationId en metadata o createdAt similar)
      const tickets = await query<RowDataPacket[]>(
        `SELECT t.id, t.sessionId, t.seatId, t.tierId, t.price, t.status, t.createdAt,
                s.label as seatLabel, s.row as seatRow, s.column as seatColumn,
                es.startsAt, e.name as eventName
         FROM Ticket t
         LEFT JOIN Seat s ON s.id = t.seatId
         JOIN EventSession es ON es.id = t.sessionId
         JOIN Event e ON e.id = es.eventId
         WHERE t.holderEmail = ? AND t.status = 'RESERVED'
         ORDER BY t.createdAt DESC`,
        [user.email]
      );

      if (tickets.length === 0) {
        return reply.status(404).send({
          success: false,
          error: "No hay reservas activas",
        });
      }

      // Calcular tiempo restante para cada ticket
      const ticketsWithExpiry = tickets.map((ticket: any) => {
        const createdAt = new Date(ticket.createdAt);
        const expiresAt = new Date(createdAt.getTime() + RESERVATION_TIMEOUT_MS);
        const now = new Date();
        const remainingMs = Math.max(0, expiresAt.getTime() - now.getTime());

        return {
          ...ticket,
          expiresAt,
          remainingMs,
          remainingSeconds: Math.floor(remainingMs / 1000),
        };
      });

      return reply.send({
        success: true,
        tickets: ticketsWithExpiry,
      });
    },
  });

  // DELETE /api/reservations - Cancelar reserva
  app.delete("/", {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { ticketIds } = request.body as { ticketIds: string[] };
      const user = (request as any).user;

      if (!ticketIds || ticketIds.length === 0) {
        return reply.status(400).send({
          success: false,
          error: "ticketIds es requerido",
        });
      }

      // Verificar que los tickets pertenecen al usuario
      const tickets = await query<RowDataPacket[]>(
        `SELECT id, holderEmail FROM Ticket WHERE id IN (?) AND status = 'RESERVED'`,
        [ticketIds]
      );

      const validTicketIds = tickets
        .filter((t: any) => t.holderEmail === user.email)
        .map((t: any) => t.id);

      if (validTicketIds.length === 0) {
        return reply.status(404).send({
          success: false,
          error: "No se encontraron reservas válidas para cancelar",
        });
      }

      const result = await cancelReservation(validTicketIds);

      if (!result.success) {
        return reply.status(500).send({
          success: false,
          error: result.error,
        });
      }

      return reply.send({
        success: true,
        message: `${validTicketIds.length} reserva(s) cancelada(s)`,
      });
    },
  });

  // POST /api/reservations/confirm - Confirmar reserva (después del pago)
  app.post("/confirm", {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const {
        ticketIds,
        paymentReference,
        paymentMethod,
        buyerName,
        buyerEmail,
        buyerPhone,
        couponCode,
        couponDiscount,
      } = request.body as {
        ticketIds: string[];
        paymentReference?: string;
        paymentMethod?: string;
        buyerName: string;
        buyerEmail: string;
        buyerPhone?: string;
        couponCode?: string;
        couponDiscount?: number;
      };
      const user = (request as any).user;

      if (!ticketIds || ticketIds.length === 0) {
        return reply.status(400).send({
          success: false,
          error: "ticketIds es requerido",
        });
      }

      // Verificar que los tickets están reservados y pertenecen al usuario
      const tickets = await query<RowDataPacket[]>(
        `SELECT t.id, t.sessionId, t.price, t.holderEmail, t.createdAt
         FROM Ticket t
         WHERE t.id IN (?) AND t.status = 'RESERVED'`,
        [ticketIds]
      );

      if (tickets.length !== ticketIds.length) {
        return reply.status(400).send({
          success: false,
          error: "Algunos tickets no están disponibles o ya expiraron",
        });
      }

      // Verificar que las reservas no expiraron
      const now = new Date();
      for (const ticket of tickets) {
        const createdAt = new Date(ticket.createdAt);
        const diffMs = now.getTime() - createdAt.getTime();
        if (diffMs >= RESERVATION_TIMEOUT_MS) {
          return reply.status(410).send({
            success: false,
            error: "La reserva ha expirado. Por favor, vuelve a seleccionar los asientos.",
          });
        }
      }

      // Calcular total
      const subtotal = tickets.reduce((sum: number, t: any) => sum + Number(t.price), 0);
      const discount = couponDiscount || 0;
      const total = Math.max(0, subtotal - discount);

      // Crear orden con datos de cupón
      const orderId = randomUUID();
      const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`;

      await query(
        `INSERT INTO \`Order\` (id, userId, orderNumber, buyerName, buyerEmail, buyerPhone, subtotal, total, couponCode, couponDiscount, currency, status, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'MXN', 'PENDING', NOW(), NOW())`,
        [orderId, user.id, orderNumber, buyerName, buyerEmail, buyerPhone || null, subtotal, total, couponCode || null, discount || null]
      );

      // Si hay cupón, incrementar el usedCount y registrar el uso
      if (couponCode) {
        await query(`UPDATE Coupon SET usedCount = usedCount + 1, updatedAt = NOW() WHERE code = ?`, [couponCode]);
        
        // Obtener el ID del cupón para registrar el uso
        const [coupon] = await query<RowDataPacket[]>(`SELECT id FROM Coupon WHERE code = ?`, [couponCode]);
        if (coupon) {
          await query(
            `INSERT INTO CouponUsage (id, couponId, userId, orderId, discountApplied, usedAt)
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [randomUUID(), coupon.id, user.id, orderId, discount]
          );
        }
      }

      // Confirmar la reserva
      const result = await confirmReservation(ticketIds, orderId, {
        paymentReference,
        paymentMethod,
        holderName: buyerName,
        holderEmail: buyerEmail,
      });

      if (!result.success) {
        // Rollback: eliminar orden y revertir uso de cupón
        await query(`DELETE FROM \`Order\` WHERE id = ?`, [orderId]);
        if (couponCode) {
          await query(`UPDATE Coupon SET usedCount = usedCount - 1 WHERE code = ?`, [couponCode]);
          await query(`DELETE FROM CouponUsage WHERE orderId = ?`, [orderId]);
        }
        return reply.status(500).send({
          success: false,
          error: result.error,
        });
      }

      return reply.send({
        success: true,
        order: {
          id: orderId,
          orderNumber,
          total,
          currency: "MXN",
          status: "PAID",
        },
        ticketCodes: result.ticketCodes,
      });
    },
  });

  // GET /api/reservations/check/:sessionId/:seatId - Verificar disponibilidad de un asiento
  app.get<{ Params: { sessionId: string; seatId: string } }>(
    "/check/:sessionId/:seatId",
    async (request, reply) => {
      const { sessionId, seatId } = request.params;

      const result = await checkSeatAvailability(sessionId, seatId);

      return reply.send({
        success: true,
        seatId,
        sessionId,
        available: result.available,
        status: result.status || "AVAILABLE",
      });
    }
  );

  // GET /api/reservations/session/:sessionId/status - Obtener disponibilidad de todos los asientos
  app.get<{ Params: { sessionId: string } }>(
    "/session/:sessionId/status",
    async (request, reply) => {
      const { sessionId } = request.params;

      // Obtener todos los tickets activos de esta sesión
      const tickets = await query<RowDataPacket[]>(
        `SELECT t.seatId, t.status, t.createdAt
         FROM Ticket t
         WHERE t.sessionId = ? AND t.status IN ('RESERVED', 'SOLD')`,
        [sessionId]
      );

      const now = new Date();
      const seatStatus: Record<string, { status: string; expiresAt?: Date }> = {};

      for (const ticket of tickets) {
        if (ticket.status === "SOLD") {
          seatStatus[ticket.seatId] = { status: "SOLD" };
        } else if (ticket.status === "RESERVED") {
          const createdAt = new Date(ticket.createdAt);
          const expiresAt = new Date(createdAt.getTime() + RESERVATION_TIMEOUT_MS);
          
          if (now.getTime() < expiresAt.getTime()) {
            seatStatus[ticket.seatId] = { status: "RESERVED", expiresAt };
          }
          // Si expiró, no lo incluimos (está disponible)
        }
      }

      return reply.send({
        success: true,
        sessionId,
        seats: seatStatus,
        totalReserved: Object.values(seatStatus).filter((s) => s.status === "RESERVED").length,
        totalSold: Object.values(seatStatus).filter((s) => s.status === "SOLD").length,
      });
    }
  );

  // POST /api/reservations/cleanup - Limpiar reservas expiradas (admin/cron)
  app.post("/cleanup", async (request, reply) => {
    const result = await cleanupExpiredReservations();

    return reply.send({
      success: true,
      message: `Se limpiaron ${result.cleaned} reserva(s) expirada(s)`,
      cleaned: result.cleaned,
    });
  });

  // POST /api/reservations/general - Compra directa para eventos de admisión general (sin asientos)
  app.post("/general", {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const {
        sessionId,
        tickets: ticketRequests,
        buyerName,
        buyerEmail,
        buyerPhone,
        couponCode,
        couponDiscount,
      } = request.body as {
        sessionId: string;
        tickets: Array<{ tierId: string; quantity: number }>;
        buyerName: string;
        buyerEmail: string;
        buyerPhone?: string;
        couponCode?: string;
        couponDiscount?: number;
      };
      const user = (request as any).user;

      // Validaciones básicas
      if (!sessionId || !ticketRequests || ticketRequests.length === 0) {
        return reply.status(400).send({
          success: false,
          error: "sessionId y tickets son requeridos",
        });
      }

      if (!buyerName || !buyerEmail) {
        return reply.status(400).send({
          success: false,
          error: "buyerName y buyerEmail son requeridos",
        });
      }

      const totalTickets = ticketRequests.reduce((sum, t) => sum + t.quantity, 0);
      if (totalTickets === 0) {
        return reply.status(400).send({
          success: false,
          error: "Debes seleccionar al menos un boleto",
        });
      }

      if (totalTickets > 10) {
        return reply.status(400).send({
          success: false,
          error: "Máximo 10 boletos por compra",
        });
      }

      // Verificar sesión y evento
      const [session] = await query<RowDataPacket[]>(
        `SELECT s.id, s.eventId, s.startsAt, e.name as eventName, e.eventType, e.serviceFeeType, e.serviceFeeValue
         FROM EventSession s
         JOIN Event e ON e.id = s.eventId
         WHERE s.id = ? AND s.startsAt > NOW()`,
        [sessionId]
      );

      if (!session) {
        return reply.status(404).send({
          success: false,
          error: "Sesión no encontrada o ya pasó",
        });
      }

      if (session.eventType !== "general") {
        return reply.status(400).send({
          success: false,
          error: "Este endpoint solo es para eventos de admisión general",
        });
      }

      // Obtener los price tiers solicitados
      const tierIds = ticketRequests.map(t => t.tierId);
      const priceTiers = await query<RowDataPacket[]>(
        `SELECT id, label, price, fee, capacity
         FROM EventPriceTier
         WHERE id IN (?) AND eventId = ?`,
        [tierIds, session.eventId]
      );

      if (priceTiers.length !== tierIds.length) {
        return reply.status(400).send({
          success: false,
          error: "Algunos tipos de boleto no son válidos",
        });
      }

      // Crear mapa de precios
      const tierMap = new Map(priceTiers.map(t => [t.id, t]));

      // Verificar capacidad disponible por tier
      for (const request of ticketRequests) {
        const tier = tierMap.get(request.tierId);
        if (!tier) continue;

        if (tier.capacity && tier.capacity > 0) {
          // Contar tickets vendidos para este tier
          const [soldCount] = await query<RowDataPacket[]>(
            `SELECT COUNT(*) as count FROM Ticket 
             WHERE tierId = ? AND sessionId = ? AND status IN ('SOLD', 'RESERVED')`,
            [request.tierId, sessionId]
          );

          const available = tier.capacity - (soldCount?.count || 0);
          if (request.quantity > available) {
            return reply.status(400).send({
              success: false,
              error: `No hay suficientes boletos disponibles para "${tier.label}". Disponibles: ${available}`,
            });
          }
        }
      }

      // Calcular totales
      let subtotal = 0;
      let fees = 0;

      for (const request of ticketRequests) {
        const tier = tierMap.get(request.tierId);
        if (!tier) continue;
        subtotal += Number(tier.price) * request.quantity;
        fees += Number(tier.fee || 0) * request.quantity;
      }

      // Agregar cargo por servicio global si existe
      if (session.serviceFeeType && session.serviceFeeValue) {
        if (session.serviceFeeType === "percentage") {
          fees += subtotal * (Number(session.serviceFeeValue) / 100);
        } else {
          fees += Number(session.serviceFeeValue) * totalTickets;
        }
      }

      const discount = couponDiscount || 0;
      const total = Math.max(0, subtotal + fees - discount);

      // Crear orden
      const orderId = randomUUID();
      const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`;

      await query(
        `INSERT INTO \`Order\` (id, userId, orderNumber, buyerName, buyerEmail, buyerPhone, subtotal, total, couponCode, couponDiscount, currency, status, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'MXN', 'PAID', NOW(), NOW())`,
        [orderId, user.id, orderNumber, buyerName, buyerEmail, buyerPhone || null, subtotal, total, couponCode || null, discount || null]
      );

      // Si hay cupón, incrementar el usedCount y registrar el uso
      if (couponCode) {
        await query(`UPDATE Coupon SET usedCount = usedCount + 1, updatedAt = NOW() WHERE code = ?`, [couponCode]);
        
        const [coupon] = await query<RowDataPacket[]>(`SELECT id FROM Coupon WHERE code = ?`, [couponCode]);
        if (coupon) {
          await query(
            `INSERT INTO CouponUsage (id, couponId, userId, orderId, discountApplied, usedAt)
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [randomUUID(), coupon.id, user.id, orderId, discount]
          );
        }
      }

      // Crear tickets (sin seatId para admisión general)
      const ticketCodes: string[] = [];

      for (const request of ticketRequests) {
        const tier = tierMap.get(request.tierId);
        if (!tier) continue;

        for (let i = 0; i < request.quantity; i++) {
          const ticketId = randomUUID();
          const ticketCode = generateTicketCode();
          ticketCodes.push(ticketCode);

          await query(
            `INSERT INTO Ticket (id, sessionId, seatId, tierId, price, currency, status, orderId, ticketCode, holderName, holderEmail, purchasedAt, createdAt, updatedAt)
             VALUES (?, ?, NULL, ?, ?, 'MXN', 'SOLD', ?, ?, ?, ?, NOW(), NOW(), NOW())`,
            [ticketId, sessionId, request.tierId, tier.price, orderId, ticketCode, buyerName, buyerEmail]
          );
        }
      }

      return reply.send({
        success: true,
        order: {
          id: orderId,
          orderNumber,
          subtotal,
          fees,
          discount,
          total,
          currency: "MXN",
          status: "PAID",
        },
        ticketCodes,
        ticketCount: ticketCodes.length,
      });
    },
  });
}

// Helper function to generate ticket code
function generateTicketCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
