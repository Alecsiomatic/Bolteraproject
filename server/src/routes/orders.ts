import { FastifyInstance } from "fastify";
import { RowDataPacket } from "mysql2";
import { query, withTransaction } from "../lib/db";
import { requireAuth, requireAdmin, requireOperator } from "../lib/authMiddleware";
import { sendRefundConfirmationEmail } from "../lib/emailService";
import { processRefund } from "../lib/mercadopago";

interface OrderWithDetails extends RowDataPacket {
  id: string;
  orderNumber: string;
  userId: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string | null;
  total: number;
  currency: string;
  status: string;
  paymentReference: string | null;
  paymentMethod: string | null;
  paidAt: Date | null;
  cancelledAt: Date | null;
  refundedAt: Date | null;
  createdAt: Date;
}

export async function ordersRoutes(app: FastifyInstance) {
  
  // GET /api/orders - Listar órdenes (admin: todas, user: las suyas)
  app.get("/api/orders", {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const user = (request as any).user;
      const { status, limit = "20", offset = "0", search } = request.query as {
        status?: string;
        limit?: string;
        offset?: string;
        search?: string;
      };

      const isAdmin = user.role === "ADMIN" || user.role === "OPERATOR";
      let sql = `
        SELECT o.id, o.orderNumber, o.userId, o.buyerName, o.buyerEmail, o.buyerPhone,
               o.total, o.currency, o.status, o.paymentReference, o.paymentMethod,
               o.paidAt, o.cancelledAt, o.refundedAt, o.createdAt
        FROM \`Order\` o
        WHERE 1=1
      `;
      const params: any[] = [];

      // Solo mostrar sus órdenes si no es admin
      if (!isAdmin) {
        sql += ` AND o.userId = ?`;
        params.push(user.id);
      }

      if (status) {
        sql += ` AND o.status = ?`;
        params.push(status);
      }

      if (search && isAdmin) {
        sql += ` AND (o.orderNumber LIKE ? OR o.buyerName LIKE ? OR o.buyerEmail LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      sql += ` ORDER BY o.createdAt DESC LIMIT ? OFFSET ?`;
      params.push(parseInt(limit), parseInt(offset));

      const orders = await query<OrderWithDetails[]>(sql, params);

      // Obtener count de tickets por orden
      const orderIds = orders.map((o) => o.id);
      let ticketCounts: Record<string, number> = {};
      
      if (orderIds.length > 0) {
        const counts = await query<RowDataPacket[]>(
          `SELECT orderId, COUNT(*) as count FROM Ticket WHERE orderId IN (?) GROUP BY orderId`,
          [orderIds]
        );
        ticketCounts = counts.reduce((acc: any, c: any) => {
          acc[c.orderId] = c.count;
          return acc;
        }, {});
      }

      return reply.send({
        success: true,
        orders: orders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          buyerName: o.buyerName,
          buyerEmail: o.buyerEmail,
          buyerPhone: o.buyerPhone,
          total: Number(o.total),
          currency: o.currency,
          status: o.status,
          paymentMethod: o.paymentMethod,
          ticketCount: ticketCounts[o.id] || 0,
          paidAt: o.paidAt,
          refundedAt: o.refundedAt,
          createdAt: o.createdAt,
        })),
      });
    },
  });

  // GET /api/orders/:orderNumber - Detalle de una orden
  app.get<{ Params: { orderNumber: string } }>("/api/orders/:orderNumber", {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { orderNumber } = request.params;
      const user = (request as any).user;

      const [order] = await query<OrderWithDetails[]>(
        `SELECT * FROM \`Order\` WHERE orderNumber = ?`,
        [orderNumber]
      );

      if (!order) {
        return reply.status(404).send({
          success: false,
          error: "Orden no encontrada",
        });
      }

      // Verificar acceso
      const isAdmin = user.role === "ADMIN" || user.role === "OPERATOR";
      if (!isAdmin && order.userId !== user.id) {
        return reply.status(403).send({
          success: false,
          error: "No tienes acceso a esta orden",
        });
      }

      // Obtener tickets
      const tickets = await query<RowDataPacket[]>(
        `SELECT 
          t.id, t.ticketCode, t.price, t.currency, t.status, t.holderName, t.holderEmail,
          t.purchasedAt, t.checkedInAt,
          s.label as seatLabel, s.rowLabel as seatRow,
          vz.name as zoneName,
          pt.label as tierName,
          e.id as eventId, e.name as eventName, e.thumbnailImage as eventImage,
          es.startsAt as eventDate,
          v.name as venueName
         FROM Ticket t
         LEFT JOIN Seat s ON s.id = t.seatId
         LEFT JOIN VenueZone vz ON vz.id = s.zoneId
         LEFT JOIN EventPriceTier pt ON pt.id = t.tierId
         JOIN EventSession es ON es.id = t.sessionId
         JOIN Event e ON e.id = es.eventId
         JOIN Venue v ON v.id = e.venueId
         WHERE t.orderId = ?
         ORDER BY t.createdAt`,
        [order.id]
      );

      return reply.send({
        success: true,
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          buyerName: order.buyerName,
          buyerEmail: order.buyerEmail,
          buyerPhone: order.buyerPhone,
          total: Number(order.total),
          currency: order.currency,
          status: order.status,
          paymentReference: order.paymentReference,
          paymentMethod: order.paymentMethod,
          paidAt: order.paidAt,
          cancelledAt: order.cancelledAt,
          refundedAt: order.refundedAt,
          createdAt: order.createdAt,
        },
        tickets: tickets.map((t: any) => ({
          id: t.id,
          ticketCode: t.ticketCode,
          price: Number(t.price),
          currency: t.currency,
          status: t.status,
          holderName: t.holderName,
          holderEmail: t.holderEmail,
          purchasedAt: t.purchasedAt,
          checkedInAt: t.checkedInAt,
          seat: t.seatLabel
            ? { label: t.seatLabel, row: t.seatRow, zone: t.zoneName }
            : null,
          tier: t.tierName,
          event: {
            id: t.eventId,
            name: t.eventName,
            image: t.eventImage,
            date: t.eventDate,
            venue: t.venueName,
          },
        })),
      });
    },
  });

  // GET /api/users/:userId/orders - Historial de compras de un usuario
  app.get<{ Params: { userId: string } }>("/api/users/:userId/orders", {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { userId } = request.params;
      const user = (request as any).user;
      const { limit = "50", offset = "0" } = request.query as {
        limit?: string;
        offset?: string;
      };

      // Verificar acceso
      const isAdmin = user.role === "ADMIN" || user.role === "OPERATOR";
      if (!isAdmin && userId !== user.id) {
        return reply.status(403).send({
          success: false,
          error: "No tienes acceso a este historial",
        });
      }

      // Get orders with event, session, and venue info
      const orders = await query<RowDataPacket[]>(
        `SELECT DISTINCT
          o.id, o.orderNumber, o.total, o.currency, o.status, o.paymentMethod,
          o.paidAt, o.createdAt,
          e.id as eventId, e.name as eventName, e.thumbnailImage as eventImage,
          es.id as sessionId, es.startsAt as sessionDate, es.title as sessionTitle,
          v.id as venueId, v.name as venueName, v.city as venueCity
         FROM \`Order\` o
         LEFT JOIN Ticket t ON t.orderId = o.id
         LEFT JOIN EventSession es ON es.id = t.sessionId
         LEFT JOIN Event e ON e.id = es.eventId
         LEFT JOIN Venue v ON v.id = e.venueId
         WHERE o.userId = ?
         GROUP BY o.id
         ORDER BY o.createdAt DESC
         LIMIT ? OFFSET ?`,
        [userId, parseInt(limit), parseInt(offset)]
      );

      // Get tickets for each order
      const orderIds = orders.map((o: any) => o.id);
      let ticketsMap: Record<string, any[]> = {};
      
      if (orderIds.length > 0) {
        const tickets = await query<RowDataPacket[]>(
          `SELECT 
            t.id, t.ticketCode as code, t.status, t.price, t.orderId,
            t.checkedInAt, t.holderName, t.holderEmail,
            s.label as seatLabel, s.rowLabel,
            vz.name as zoneName
           FROM Ticket t
           LEFT JOIN Seat s ON s.id = t.seatId
           LEFT JOIN VenueZone vz ON vz.id = s.zoneId
           WHERE t.orderId IN (${orderIds.map(() => '?').join(',')})`,
          orderIds
        );
        
        for (const t of tickets) {
          if (!ticketsMap[t.orderId]) {
            ticketsMap[t.orderId] = [];
          }
          ticketsMap[t.orderId].push({
            id: t.id,
            code: t.code,
            status: t.status === 'SOLD' ? 'VALID' : t.status,
            price: Number(t.price),
            seatLabel: t.seatLabel,
            rowLabel: t.rowLabel,
            zoneName: t.zoneName,
            checkedInAt: t.checkedInAt,
            holderName: t.holderName,
            holderEmail: t.holderEmail,
          });
        }
      }

      // Contar total
      const [countResult] = await query<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM \`Order\` WHERE userId = ?`,
        [userId]
      );

      return reply.send({
        success: true,
        orders: orders.map((o: any) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          total: Number(o.total),
          currency: o.currency || 'MXN',
          status: o.status,
          paymentMethod: o.paymentMethod,
          isCourtesy: o.paymentMethod === 'COURTESY',
          paidAt: o.paidAt,
          createdAt: o.createdAt,
          event: {
            id: o.eventId,
            name: o.eventName || 'Evento',
            thumbnailImage: o.eventImage,
          },
          session: {
            id: o.sessionId,
            startsAt: o.sessionDate,
            title: o.sessionTitle,
          },
          venue: o.venueId ? {
            id: o.venueId,
            name: o.venueName,
            city: o.venueCity,
          } : null,
          tickets: ticketsMap[o.id] || [],
        })),
        pagination: {
          total: countResult?.total || 0,
          limit: parseInt(limit),
          offset: parseInt(offset),
        },
      });
    },
  });

  // POST /api/orders/:orderNumber/refund - Solicitar/procesar reembolso
  app.post<{ Params: { orderNumber: string } }>("/api/orders/:orderNumber/refund", {
    preHandler: [requireOperator],
    handler: async (request, reply) => {
      const { orderNumber } = request.params;
      const { reason, ticketIds } = request.body as {
        reason?: string;
        ticketIds?: string[]; // Si es parcial, especificar qué tickets
      };
      const operator = (request as any).user;

      // Obtener la orden
      const [order] = await query<OrderWithDetails[]>(
        `SELECT * FROM \`Order\` WHERE orderNumber = ?`,
        [orderNumber]
      );

      if (!order) {
        return reply.status(404).send({
          success: false,
          error: "Orden no encontrada",
        });
      }

      if (order.status !== "PAID") {
        return reply.status(400).send({
          success: false,
          error: "Solo se pueden reembolsar órdenes pagadas",
        });
      }

      // Obtener tickets a reembolsar
      let ticketsToRefund;
      if (ticketIds && ticketIds.length > 0) {
        // Reembolso parcial
        ticketsToRefund = await query<RowDataPacket[]>(
          `SELECT t.id, t.seatId, t.price, t.status, e.name as eventName
           FROM Ticket t
           JOIN EventSession es ON es.id = t.sessionId
           JOIN Event e ON e.id = es.eventId
           WHERE t.orderId = ? AND t.id IN (?) AND t.status = 'SOLD'`,
          [order.id, ticketIds]
        );
      } else {
        // Reembolso total
        ticketsToRefund = await query<RowDataPacket[]>(
          `SELECT t.id, t.seatId, t.price, t.status, e.name as eventName
           FROM Ticket t
           JOIN EventSession es ON es.id = t.sessionId
           JOIN Event e ON e.id = es.eventId
           WHERE t.orderId = ? AND t.status = 'SOLD'`,
          [order.id]
        );
      }

      if (ticketsToRefund.length === 0) {
        return reply.status(400).send({
          success: false,
          error: "No hay tickets válidos para reembolsar",
        });
      }

      // Calcular monto a reembolsar
      const refundAmount = ticketsToRefund.reduce(
        (sum: number, t: any) => sum + Number(t.price),
        0
      );
      const eventName = ticketsToRefund[0]?.eventName || "Evento";

      // 1. Procesar reembolso REAL en MercadoPago si hay paymentReference
      let mpRefundId: string | undefined;
      if (order.paymentReference) {
        const isPartialRefund = ticketIds && ticketIds.length > 0 && ticketIds.length < ticketsToRefund.length;
        
        const refundResult = await processRefund(
          order.paymentReference,
          isPartialRefund ? refundAmount : undefined // Monto solo si es parcial
        );

        if (!refundResult.success) {
          return reply.status(500).send({
            success: false,
            error: `Error procesando reembolso en MercadoPago: ${refundResult.error}`,
          });
        }
        
        mpRefundId = refundResult.refundId;
        console.log(`[Refund] MercadoPago refund ${mpRefundId} created for order ${orderNumber}`);
      }

      // 2. Actualizar DB solo si el reembolso de MP fue exitoso (o no había payment reference)
      await withTransaction(async (connection) => {
        // Actualizar tickets a REFUNDED y liberar asientos
        for (const ticket of ticketsToRefund) {
          await connection.query(
            `UPDATE Ticket SET status = 'REFUNDED', updatedAt = NOW() WHERE id = ?`,
            [ticket.id]
          );

          if (ticket.seatId) {
            await connection.query(
              `UPDATE Seat SET status = 'AVAILABLE', updatedAt = NOW() WHERE id = ?`,
              [ticket.seatId]
            );
          }
        }

        // Verificar si todos los tickets fueron reembolsados
        const [remainingSold] = await connection.query<RowDataPacket[]>(
          `SELECT COUNT(*) as count FROM Ticket WHERE orderId = ? AND status = 'SOLD'`,
          [order.id]
        );

        const allRefunded = (remainingSold as RowDataPacket[])[0]?.count === 0;

        if (allRefunded) {
          // Marcar orden como completamente reembolsada
          await connection.query(
            `UPDATE \`Order\` SET status = 'REFUNDED', refundedAt = NOW(), updatedAt = NOW() WHERE id = ?`,
            [order.id]
          );
        } else {
          // Reembolso parcial - actualizar el total o agregar nota
          await connection.query(
            `UPDATE \`Order\` SET updatedAt = NOW() WHERE id = ?`,
            [order.id]
          );
        }
      });

      // 3. Enviar email de confirmación
      await sendRefundConfirmationEmail(
        order.buyerName,
        order.buyerEmail,
        order.orderNumber,
        eventName,
        refundAmount,
        order.currency
      );

      return reply.send({
        success: true,
        message: `Reembolso procesado por ${order.currency} $${refundAmount.toFixed(2)}`,
        refund: {
          orderNumber: order.orderNumber,
          ticketsRefunded: ticketsToRefund.length,
          amount: refundAmount,
          currency: order.currency,
          reason,
          mpRefundId,
        },
      });
    },
  });
}
