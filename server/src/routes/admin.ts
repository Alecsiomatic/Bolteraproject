/**
 * Admin Routes - Endpoints adicionales para el panel de administración
 * 
 * Incluye:
 * - /api/admin/orders - Lista de órdenes con filtros avanzados
 * - /api/admin/orders/:id/refund - Procesar reembolso
 * - /api/admin/tickets - Lista de boletos con filtros
 * - /api/admin/tickets/:id/invalidate - Invalidar boleto
 * - /api/admin/tickets/:id/resend - Reenviar boleto por email
 * - /api/admin/reports/sales - Reporte de ventas
 * - /api/admin/reports/checkins - Reporte de check-ins
 * - /api/admin/reports/events/:id - Reporte por evento
 * - /api/admin/reports/export - Exportar reportes
 */

import { FastifyInstance } from "fastify";
import { RowDataPacket } from "mysql2";
import { query, withTransaction } from "../lib/db";
import { requireAdmin, requireOperator } from "../lib/authMiddleware";
import { sendOrderConfirmationEmail, sendRefundConfirmationEmail } from "../lib/emailService";
import { processRefund } from "../lib/mercadopago";
import { generateTicketPDF, TicketPDFData } from "../lib/pdfGenerator";
import PDFDocument from "pdfkit";

// Escapar campos CSV
const escapeCSV = (value: any): string => {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export async function adminRoutes(app: FastifyInstance) {
  
  // ===========================
  // ORDERS ENDPOINTS
  // ===========================

  // GET /api/admin/orders - Lista de órdenes con paginación y filtros
  app.get("/api/admin/orders", {
    preHandler: [requireOperator],
    handler: async (request, reply) => {
      const {
        page = "1",
        limit = "20",
        search,
        status,
        eventId,
        startDate,
        endDate,
      } = request.query as {
        page?: string;
        limit?: string;
        search?: string;
        status?: string;
        eventId?: string;
        startDate?: string;
        endDate?: string;
      };

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;

      let whereClauses: string[] = [];
      const params: any[] = [];

      if (search) {
        whereClauses.push(`(o.orderNumber LIKE ? OR o.buyerName LIKE ? OR o.buyerEmail LIKE ?)`);
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      if (status && status !== "all") {
        whereClauses.push(`o.status = ?`);
        params.push(status);
      }

      if (eventId && eventId !== "all") {
        whereClauses.push(`t.eventId = ?`);
        params.push(eventId);
      }

      if (startDate) {
        whereClauses.push(`DATE(o.createdAt) >= ?`);
        params.push(startDate);
      }

      if (endDate) {
        whereClauses.push(`DATE(o.createdAt) <= ?`);
        params.push(endDate);
      }

      const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

      // Count total
      const [countResult] = await query<RowDataPacket[]>(
        `SELECT COUNT(DISTINCT o.id) as total 
         FROM \`Order\` o
         LEFT JOIN Ticket t ON t.orderId = o.id
         ${whereSQL}`,
        params
      );
      const total = countResult?.total || 0;

      // Get orders with event info
      const orders = await query<RowDataPacket[]>(
        `SELECT DISTINCT
          o.id, o.buyerName, o.buyerEmail, o.buyerPhone,
          o.total, o.status, o.paymentReference,
          o.createdAt, o.updatedAt,
          (SELECT COUNT(*) FROM Ticket WHERE orderId = o.id) as ticketCount,
          (SELECT e.name FROM Ticket t2 JOIN EventSession es ON es.id = t2.sessionId JOIN Event e ON e.id = es.eventId WHERE t2.orderId = o.id LIMIT 1) as eventName
         FROM \`Order\` o
         LEFT JOIN Ticket t ON t.orderId = o.id
         ${whereSQL}
         ORDER BY o.createdAt DESC
         LIMIT ? OFFSET ?`,
        [...params, limitNum, offset]
      );

      return reply.send({
        success: true,
        orders: orders.map((o: any) => ({
          id: o.id,
          orderNumber: o.id.substring(0, 8).toUpperCase(),
          buyerName: o.buyerName,
          buyerEmail: o.buyerEmail,
          buyerPhone: o.buyerPhone,
          total: Number(o.total),
          fee: 0,
          discount: 0,
          currency: 'MXN',
          status: o.status,
          paymentMethod: null,
          paymentReference: o.paymentReference,
          ticketCount: o.ticketCount,
          eventName: o.eventName,
          paidAt: o.status === 'PAID' ? o.updatedAt : null,
          cancelledAt: o.status === 'CANCELLED' ? o.updatedAt : null,
          refundedAt: o.status === 'REFUNDED' ? o.updatedAt : null,
          createdAt: o.createdAt,
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    },
  });

  // GET /api/admin/orders/:id - Detalle de una orden
  app.get<{ Params: { id: string } }>("/api/admin/orders/:id", {
    preHandler: [requireOperator],
    handler: async (request, reply) => {
      const { id } = request.params;

      const [order] = await query<RowDataPacket[]>(
        `SELECT * FROM \`Order\` WHERE id = ?`,
        [id]
      );

      if (!order) {
        return reply.status(404).send({ success: false, error: "Orden no encontrada" });
      }

      // Get tickets
      const tickets = await query<RowDataPacket[]>(
        `SELECT 
          t.id, t.ticketCode as code, t.status, t.price, t.fee,
          t.holderName, t.holderEmail, t.purchasedAt, t.checkedInAt,
          s.label as seatLabel, s.rowLabel,
          vz.name as zoneName,
          pt.label as tierLabel,
          e.name as eventName, e.id as eventId,
          es.startsAt as sessionDate,
          v.name as venueName
         FROM Ticket t
         LEFT JOIN Seat s ON s.id = t.seatId
         LEFT JOIN VenueZone vz ON vz.id = s.zoneId
         LEFT JOIN EventPriceTier pt ON pt.id = t.tierId
         JOIN EventSession es ON es.id = t.sessionId
         JOIN Event e ON e.id = es.eventId
         LEFT JOIN Venue v ON v.id = e.venueId
         WHERE t.orderId = ?`,
        [id]
      );

      // Get coupon if used
      let coupon = null;
      if (order.couponId) {
        const [c] = await query<RowDataPacket[]>(
          `SELECT code, discountType, discountValue FROM Coupon WHERE id = ?`,
          [order.couponId]
        );
        coupon = c || null;
      }

      return reply.send({
        success: true,
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          buyerName: order.buyerName,
          buyerEmail: order.buyerEmail,
          buyerPhone: order.buyerPhone,
          subtotal: Number(order.subtotal),
          fee: Number(order.fee || 0),
          discount: Number(order.discount || 0),
          total: Number(order.total),
          currency: order.currency,
          status: order.status,
          paymentMethod: order.paymentMethod,
          paymentReference: order.paymentReference,
          coupon,
          paidAt: order.paidAt,
          cancelledAt: order.cancelledAt,
          refundedAt: order.refundedAt,
          createdAt: order.createdAt,
          notes: order.notes,
        },
        tickets: tickets.map((t: any) => ({
          id: t.id,
          code: t.code,
          status: t.status,
          price: Number(t.price),
          fee: Number(t.fee || 0),
          holderName: t.holderName,
          holderEmail: t.holderEmail,
          seatLabel: t.seatLabel,
          rowLabel: t.rowLabel,
          zoneName: t.zoneName,
          tierLabel: t.tierLabel,
          eventId: t.eventId,
          eventName: t.eventName,
          sessionDate: t.sessionDate,
          venueName: t.venueName,
          purchasedAt: t.purchasedAt,
          checkedInAt: t.checkedInAt,
        })),
      });
    },
  });

  // POST /api/admin/orders/:id/refund - Procesar reembolso
  app.post<{ Params: { id: string }; Body: { reason?: string; amount?: number } }>(
    "/api/admin/orders/:id/refund",
    {
      preHandler: [requireAdmin],
      handler: async (request, reply) => {
        const { id } = request.params;
        const { reason, amount } = request.body;
        const adminUser = (request as any).user;

        const [order] = await query<RowDataPacket[]>(
          `SELECT * FROM \`Order\` WHERE id = ?`,
          [id]
        );

        if (!order) {
          return reply.status(404).send({ success: false, error: "Orden no encontrada" });
        }

        if (order.status !== "PAID") {
          return reply.status(400).send({ success: false, error: "Solo se pueden reembolsar órdenes pagadas" });
        }

        // Process refund with payment provider
        let refundResult = null;
        if (order.paymentReference) {
          try {
            refundResult = await processRefund(
              order.paymentReference,
              amount || Number(order.total)
            );
          } catch (err) {
            console.error("Error processing refund:", err);
            return reply.status(500).send({
              success: false,
              error: "Error al procesar el reembolso con MercadoPago",
            });
          }
        }

        // Update order status
        await query(
          `UPDATE \`Order\` SET 
            status = 'REFUNDED', 
            refundedAt = NOW(),
            notes = CONCAT(COALESCE(notes, ''), '\n[', NOW(), '] Reembolso procesado por ', ?, '. Razón: ', ?)
           WHERE id = ?`,
          [adminUser.email, reason || "No especificada", id]
        );

        // Cancel all tickets
        await query(
          `UPDATE Ticket SET status = 'CANCELLED' WHERE orderId = ?`,
          [id]
        );

        // Release seats
        await query(
          `UPDATE Seat s
           JOIN Ticket t ON t.seatId = s.id
           SET s.status = 'AVAILABLE'
           WHERE t.orderId = ?`,
          [id]
        );

        // Send confirmation email
        try {
          // Get event name for email
          const [ticketInfo] = await query<RowDataPacket[]>(
            `SELECT e.name as eventName 
             FROM Ticket t 
             JOIN EventSession es ON es.id = t.sessionId 
             JOIN Event e ON e.id = es.eventId 
             WHERE t.orderId = ? LIMIT 1`,
            [id]
          );
          
          await sendRefundConfirmationEmail(
            order.buyerName,
            order.buyerEmail,
            order.orderNumber,
            ticketInfo?.eventName || "Evento",
            amount || Number(order.total),
            order.currency
          );
        } catch (err) {
          console.error("Error sending refund email:", err);
        }

        return reply.send({
          success: true,
          message: "Reembolso procesado correctamente",
          refundId: refundResult?.refundId,
        });
      },
    }
  );

  // POST /api/admin/orders/:id/resend-tickets - Reenviar boletos por email
  app.post<{ Params: { id: string } }>("/api/admin/orders/:id/resend-tickets", {
    preHandler: [requireOperator],
    handler: async (request, reply) => {
      const { id } = request.params;

      const [order] = await query<RowDataPacket[]>(
        `SELECT * FROM \`Order\` WHERE id = ?`,
        [id]
      );

      if (!order) {
        return reply.status(404).send({ success: false, error: "Orden no encontrada" });
      }

      // Get tickets
      const tickets = await query<RowDataPacket[]>(
        `SELECT 
          t.id, t.ticketCode, t.price, t.currency, t.holderName, t.holderEmail, t.purchasedAt,
          s.label as seatLabel, s.rowLabel,
          vz.name as zoneName,
          pt.label as tierName,
          e.name as eventName, es.startsAt as eventDate,
          v.name as venueName, v.address as venueAddress
         FROM Ticket t
         LEFT JOIN Seat s ON s.id = t.seatId
         LEFT JOIN VenueZone vz ON vz.id = s.zoneId
         LEFT JOIN EventPriceTier pt ON pt.id = t.tierId
         JOIN EventSession es ON es.id = t.sessionId
         JOIN Event e ON e.id = es.eventId
         LEFT JOIN Venue v ON v.id = e.venueId
         WHERE t.orderId = ? AND t.status = 'SOLD'`,
        [id]
      );

      if (tickets.length === 0) {
        return reply.status(400).send({ success: false, error: "No hay boletos para enviar" });
      }

      // Send email using order confirmation function (same format)
      try {
        const firstTicket = tickets[0] as any;
        await sendOrderConfirmationEmail({
          orderNumber: order.orderNumber,
          buyerName: order.buyerName,
          buyerEmail: order.buyerEmail,
          total: Number(order.total),
          currency: order.currency,
          eventName: firstTicket.eventName,
          eventDate: firstTicket.eventDate,
          venueName: firstTicket.venueName,
          tickets: tickets.map((t: any) => ({
            ticketCode: t.ticketCode,
            tierName: t.tierName,
            seatInfo: t.seatLabel ? `${t.zoneName || ''} - ${t.rowLabel || ''} ${t.seatLabel}` : undefined,
            price: Number(t.price),
          })),
        });
      } catch (err) {
        console.error("Error sending tickets email:", err);
        return reply.status(500).send({ success: false, error: "Error al enviar el email" });
      }

      return reply.send({
        success: true,
        message: `Boletos reenviados a ${order.buyerEmail}`,
      });
    },
  });

  // ===========================
  // TICKETS ENDPOINTS
  // ===========================

  // GET /api/admin/tickets - Lista de boletos con paginación y filtros
  app.get("/api/admin/tickets", {
    preHandler: [requireOperator],
    handler: async (request, reply) => {
      const {
        page = "1",
        limit = "25",
        search,
        status,
        eventId,
      } = request.query as {
        page?: string;
        limit?: string;
        search?: string;
        status?: string;
        eventId?: string;
      };

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;

      let whereClauses: string[] = [];
      const params: any[] = [];

      if (search) {
        whereClauses.push(`(t.ticketCode LIKE ? OR o.buyerName LIKE ? OR o.buyerEmail LIKE ?)`);
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      if (status && status !== "all") {
        whereClauses.push(`t.status = ?`);
        params.push(status);
      }

      if (eventId && eventId !== "all") {
        whereClauses.push(`e.id = ?`);
        params.push(eventId);
      }

      const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

      // Count total
      const [countResult] = await query<RowDataPacket[]>(
        `SELECT COUNT(*) as total 
         FROM Ticket t
         LEFT JOIN \`Order\` o ON o.id = t.orderId
         JOIN EventSession es ON es.id = t.sessionId
         JOIN Event e ON e.id = es.eventId
         ${whereSQL}`,
        params
      );
      const total = countResult?.total || 0;

      // Get tickets
      const tickets = await query<RowDataPacket[]>(
        `SELECT 
          t.id, t.ticketCode as code, t.status, t.price,
          t.seatId, t.tierId, t.sessionId, t.orderId,
          t.holderName, t.holderEmail, t.purchasedAt, t.checkedInAt,
          s.label as seatLabel, s.rowLabel,
          vz.id as zoneId, vz.name as zoneName,
          pt.label as tierLabel,
          e.id as eventId, e.name as eventName,
          es.startsAt as sessionDate,
          v.name as venueName,
          o.orderNumber, o.buyerName, o.buyerEmail, o.paymentMethod,
          cu.name as checkedInBy
         FROM Ticket t
         LEFT JOIN Seat s ON s.id = t.seatId
         LEFT JOIN VenueZone vz ON vz.id = s.zoneId
         LEFT JOIN EventPriceTier pt ON pt.id = t.tierId
         JOIN EventSession es ON es.id = t.sessionId
         JOIN Event e ON e.id = es.eventId
         LEFT JOIN Venue v ON v.id = e.venueId
         LEFT JOIN \`Order\` o ON o.id = t.orderId
         LEFT JOIN User cu ON cu.id = t.checkedInBy
         ${whereSQL}
         ORDER BY t.purchasedAt DESC
         LIMIT ? OFFSET ?`,
        [...params, limitNum, offset]
      );

      return reply.send({
        success: true,
        tickets: tickets.map((t: any) => ({
          id: t.id,
          code: t.code,
          status: t.status,
          price: Number(t.price),
          fee: 0,
          seatId: t.seatId,
          seatLabel: t.seatLabel,
          rowLabel: t.rowLabel,
          zoneId: t.zoneId,
          zoneName: t.zoneName,
          tierId: t.tierId,
          tierLabel: t.tierLabel,
          buyerName: t.buyerName || t.holderName,
          buyerEmail: t.buyerEmail || t.holderEmail,
          orderId: t.orderId,
          orderNumber: t.orderNumber,
          eventId: t.eventId,
          eventName: t.eventName,
          sessionId: t.sessionId,
          sessionDate: t.sessionDate,
          venueName: t.venueName,
          checkedInAt: t.checkedInAt,
          checkedInBy: t.checkedInBy,
          transferredAt: null,
          transferredTo: null,
          createdAt: t.purchasedAt,
          isCourtesy: t.paymentMethod === 'COURTESY',
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    },
  });

  // POST /api/admin/tickets/:id/invalidate - Invalidar boleto
  app.post<{ Params: { id: string }; Body: { reason: string } }>(
    "/api/admin/tickets/:id/invalidate",
    {
      preHandler: [requireAdmin],
      handler: async (request, reply) => {
        const { id } = request.params;
        const { reason } = request.body;
        const adminUser = (request as any).user;

        const [ticket] = await query<RowDataPacket[]>(
          `SELECT t.*, o.orderNumber FROM Ticket t LEFT JOIN \`Order\` o ON o.id = t.orderId WHERE t.id = ?`,
          [id]
        );

        if (!ticket) {
          return reply.status(404).send({ success: false, error: "Boleto no encontrado" });
        }

        if (ticket.status === "CANCELLED" || ticket.status === "USED") {
          return reply.status(400).send({ success: false, error: "Este boleto no puede ser invalidado" });
        }

        // Update ticket
        await query(
          `UPDATE Ticket SET status = 'CANCELLED' WHERE id = ?`,
          [id]
        );

        // Release seat if assigned
        if (ticket.seatId) {
          await query(
            `UPDATE Seat SET status = 'AVAILABLE' WHERE id = ?`,
            [ticket.seatId]
          );
        }

        // Log action
        await query(
          `INSERT INTO AuditLog (action, entityType, entityId, userId, details, createdAt)
           VALUES ('TICKET_INVALIDATED', 'Ticket', ?, ?, ?, NOW())`,
          [id, adminUser.id, JSON.stringify({ reason, ticketCode: ticket.ticketCode })]
        );

        return reply.send({
          success: true,
          message: "Boleto invalidado correctamente",
        });
      },
    }
  );

  // POST /api/admin/tickets/:id/resend - Reenviar boleto por email
  app.post<{ Params: { id: string } }>("/api/admin/tickets/:id/resend", {
    preHandler: [requireOperator],
    handler: async (request, reply) => {
      const { id } = request.params;

      const [ticket] = await query<RowDataPacket[]>(
        `SELECT 
          t.id, t.ticketCode, t.price, t.currency, t.status, t.holderName, t.holderEmail, t.purchasedAt,
          s.label as seatLabel, s.rowLabel, s.columnNumber,
          vz.name as zoneName,
          pt.label as tierName,
          e.name as eventName, es.startsAt as eventDate,
          v.name as venueName, v.address as venueAddress,
          o.orderNumber, o.buyerName, o.buyerEmail
         FROM Ticket t
         LEFT JOIN Seat s ON s.id = t.seatId
         LEFT JOIN VenueZone vz ON vz.id = s.zoneId
         LEFT JOIN EventPriceTier pt ON pt.id = t.tierId
         JOIN EventSession es ON es.id = t.sessionId
         JOIN Event e ON e.id = es.eventId
         LEFT JOIN Venue v ON v.id = e.venueId
         LEFT JOIN \`Order\` o ON o.id = t.orderId
         WHERE t.id = ?`,
        [id]
      );

      if (!ticket) {
        return reply.status(404).send({ success: false, error: "Boleto no encontrado" });
      }

      if (ticket.status !== "SOLD") {
        return reply.status(400).send({ success: false, error: "Solo se pueden reenviar boletos vendidos" });
      }

      const recipientEmail = ticket.holderEmail || ticket.buyerEmail;
      if (!recipientEmail) {
        return reply.status(400).send({ success: false, error: "No hay email de destino" });
      }

      // Send email using order confirmation function
      try {
        await sendOrderConfirmationEmail({
          orderNumber: ticket.orderNumber,
          buyerName: ticket.holderName || ticket.buyerName,
          buyerEmail: recipientEmail,
          total: Number(ticket.price),
          currency: ticket.currency,
          eventName: ticket.eventName,
          eventDate: ticket.eventDate,
          venueName: ticket.venueName,
          tickets: [{
            ticketCode: ticket.ticketCode,
            tierName: ticket.tierName,
            seatInfo: ticket.seatLabel 
              ? `${ticket.zoneName || ''} - ${ticket.rowLabel || ''} ${ticket.seatLabel}` 
              : undefined,
            price: Number(ticket.price),
          }],
        });
      } catch (err) {
        console.error("Error sending ticket email:", err);
        return reply.status(500).send({ success: false, error: "Error al enviar el email" });
      }

      return reply.send({
        success: true,
        message: `Boleto reenviado a ${recipientEmail}`,
      });
    },
  });

  // ===========================
  // REPORTS ENDPOINTS
  // ===========================

  // GET /api/admin/reports/sales - Reporte de ventas
  app.get("/api/admin/reports/sales", {
    preHandler: [requireOperator],
    handler: async (request, reply) => {
      const { startDate, endDate, eventId } = request.query as {
        startDate: string;
        endDate: string;
        eventId?: string;
      };

      let eventFilter = "";
      const params: any[] = [startDate, endDate];

      if (eventId && eventId !== "all") {
        eventFilter = "AND e.id = ?";
        params.push(eventId);
      }

      // Total revenue & orders
      const [totals] = await query<RowDataPacket[]>(
        `SELECT 
          COALESCE(SUM(o.total), 0) as totalRevenue,
          COUNT(DISTINCT o.id) as totalOrders,
          COUNT(t.id) as totalTickets,
          AVG(o.total) as avgOrderValue
         FROM \`Order\` o
         LEFT JOIN Ticket t ON t.orderId = o.id
         LEFT JOIN EventSession es ON es.id = t.sessionId
         LEFT JOIN Event e ON e.id = es.eventId
         WHERE o.status = 'PAID'
           AND DATE(o.paidAt) >= ? AND DATE(o.paidAt) <= ?
           ${eventFilter}`,
        params
      );

      // Sales by day
      const salesByDay = await query<RowDataPacket[]>(
        `SELECT 
          DATE(o.paidAt) as date,
          COALESCE(SUM(o.total), 0) as revenue,
          COUNT(DISTINCT o.id) as orders,
          COUNT(t.id) as tickets
         FROM \`Order\` o
         LEFT JOIN Ticket t ON t.orderId = o.id
         LEFT JOIN EventSession es ON es.id = t.sessionId
         LEFT JOIN Event e ON e.id = es.eventId
         WHERE o.status = 'PAID'
           AND DATE(o.paidAt) >= ? AND DATE(o.paidAt) <= ?
           ${eventFilter}
         GROUP BY DATE(o.paidAt)
         ORDER BY DATE(o.paidAt)`,
        params
      );

      // Sales by event
      const salesByEvent = await query<RowDataPacket[]>(
        `SELECT 
          e.id as eventId,
          e.name as eventName,
          COALESCE(SUM(t.price), 0) as revenue,
          COUNT(t.id) as tickets
         FROM Event e
         JOIN EventSession es ON es.eventId = e.id
         JOIN Ticket t ON t.sessionId = es.id
         JOIN \`Order\` o ON o.id = t.orderId
         WHERE o.status = 'PAID'
           AND DATE(o.paidAt) >= ? AND DATE(o.paidAt) <= ?
           ${eventFilter}
         GROUP BY e.id
         ORDER BY revenue DESC
         LIMIT 10`,
        params
      );

      // Sales by payment method
      const salesByMethod = await query<RowDataPacket[]>(
        `SELECT 
          COALESCE(o.paymentMethod, 'Sin especificar') as method,
          COUNT(*) as count,
          COALESCE(SUM(o.total), 0) as revenue
         FROM \`Order\` o
         LEFT JOIN Ticket t ON t.orderId = o.id
         LEFT JOIN EventSession es ON es.id = t.sessionId
         LEFT JOIN Event e ON e.id = es.eventId
         WHERE o.status = 'PAID'
           AND DATE(o.paidAt) >= ? AND DATE(o.paidAt) <= ?
           ${eventFilter}
         GROUP BY o.paymentMethod`,
        params
      );

      return reply.send({
        success: true,
        totalRevenue: Number(totals?.totalRevenue) || 0,
        totalOrders: Number(totals?.totalOrders) || 0,
        totalTickets: Number(totals?.totalTickets) || 0,
        averageOrderValue: Number(totals?.avgOrderValue) || 0,
        conversionRate: 0, // TODO: Calculate from abandoned carts
        salesByDay: salesByDay.map((r: any) => ({
          date: r.date,
          revenue: Number(r.revenue),
          orders: r.orders,
          tickets: r.tickets,
        })),
        salesByEvent: salesByEvent.map((r: any) => ({
          eventId: r.eventId,
          eventName: r.eventName,
          revenue: Number(r.revenue),
          tickets: r.tickets,
        })),
        salesByPaymentMethod: salesByMethod.map((r: any) => ({
          method: r.method,
          count: r.count,
          revenue: Number(r.revenue),
        })),
      });
    },
  });

  // GET /api/admin/reports/checkins - Reporte de check-ins
  app.get("/api/admin/reports/checkins", {
    preHandler: [requireOperator],
    handler: async (request, reply) => {
      const { startDate, endDate, eventId } = request.query as {
        startDate: string;
        endDate: string;
        eventId?: string;
      };

      let eventFilter = "";
      const params: any[] = [startDate, endDate];

      if (eventId && eventId !== "all") {
        eventFilter = "AND e.id = ?";
        params.push(eventId);
      }

      // Total check-ins
      const [totals] = await query<RowDataPacket[]>(
        `SELECT 
          COUNT(CASE WHEN t.checkedInAt IS NOT NULL THEN 1 END) as totalCheckins,
          COUNT(*) as totalSold
         FROM Ticket t
         JOIN EventSession es ON es.id = t.sessionId
         JOIN Event e ON e.id = es.eventId
         WHERE t.status IN ('SOLD', 'USED')
           AND DATE(es.startsAt) >= ? AND DATE(es.startsAt) <= ?
           ${eventFilter}`,
        params
      );

      const checkinRate = totals?.totalSold > 0 
        ? Math.round((totals.totalCheckins / totals.totalSold) * 100) 
        : 0;
      const noShowRate = 100 - checkinRate;

      // Check-ins by hour
      const checkinsByHour = await query<RowDataPacket[]>(
        `SELECT 
          HOUR(t.checkedInAt) as hour,
          COUNT(*) as count
         FROM Ticket t
         JOIN EventSession es ON es.id = t.sessionId
         JOIN Event e ON e.id = es.eventId
         WHERE t.checkedInAt IS NOT NULL
           AND DATE(es.startsAt) >= ? AND DATE(es.startsAt) <= ?
           ${eventFilter}
         GROUP BY HOUR(t.checkedInAt)
         ORDER BY hour`,
        params
      );

      // Check-ins by event
      const checkinsByEvent = await query<RowDataPacket[]>(
        `SELECT 
          e.id as eventId,
          e.name as eventName,
          COUNT(*) as total,
          COUNT(CASE WHEN t.checkedInAt IS NOT NULL THEN 1 END) as checkedIn
         FROM Event e
         JOIN EventSession es ON es.eventId = e.id
         JOIN Ticket t ON t.sessionId = es.id
         WHERE t.status IN ('SOLD', 'USED')
           AND DATE(es.startsAt) >= ? AND DATE(es.startsAt) <= ?
           ${eventFilter}
         GROUP BY e.id
         ORDER BY total DESC`,
        params
      );

      return reply.send({
        success: true,
        totalCheckins: totals?.totalCheckins || 0,
        checkinRate,
        noShowRate,
        checkinsByHour: checkinsByHour.map((r: any) => ({
          hour: r.hour,
          count: r.count,
        })),
        checkinsByEvent: checkinsByEvent.map((r: any) => ({
          eventId: r.eventId,
          eventName: r.eventName,
          total: r.total,
          checkedIn: r.checkedIn,
        })),
      });
    },
  });

  // GET /api/admin/reports/events/:eventId - Reporte detallado de un evento
  app.get<{ Params: { eventId: string } }>("/api/admin/reports/events/:eventId", {
    preHandler: [requireOperator],
    handler: async (request, reply) => {
      const { eventId } = request.params;

      const [event] = await query<RowDataPacket[]>(
        `SELECT id, name FROM Event WHERE id = ?`,
        [eventId]
      );

      if (!event) {
        return reply.status(404).send({ success: false, error: "Evento no encontrado" });
      }

      // Stats by session
      const sessions = await query<RowDataPacket[]>(
        `SELECT 
          es.id as sessionId,
          es.startsAt as date,
          (SELECT COUNT(*) FROM Seat s JOIN VenueZone vz ON vz.id = s.zoneId WHERE vz.venueId = e.venueId) as capacity,
          COUNT(t.id) as sold,
          COALESCE(SUM(t.price), 0) as revenue,
          COUNT(CASE WHEN t.checkedInAt IS NOT NULL THEN 1 END) as checkedIn
         FROM EventSession es
         JOIN Event e ON e.id = es.eventId
         LEFT JOIN Ticket t ON t.sessionId = es.id AND t.status IN ('SOLD', 'USED')
         WHERE es.eventId = ?
         GROUP BY es.id
         ORDER BY es.startsAt`,
        [eventId]
      );

      // Stats by zone
      const byZone = await query<RowDataPacket[]>(
        `SELECT 
          vz.id as zoneId,
          vz.name as zoneName,
          COUNT(DISTINCT s.id) as capacity,
          COUNT(CASE WHEN t.status IN ('SOLD', 'USED') THEN 1 END) as sold,
          COALESCE(SUM(CASE WHEN t.status IN ('SOLD', 'USED') THEN t.price ELSE 0 END), 0) as revenue
         FROM VenueZone vz
         JOIN Venue v ON v.id = vz.venueId
         JOIN Event e ON e.venueId = v.id
         LEFT JOIN Seat s ON s.zoneId = vz.id
         LEFT JOIN Ticket t ON t.seatId = s.id
         WHERE e.id = ?
         GROUP BY vz.id`,
        [eventId]
      );

      // Stats by tier
      const byTier = await query<RowDataPacket[]>(
        `SELECT 
          pt.id as tierId,
          pt.label as tierName,
          pt.price,
          COUNT(t.id) as sold,
          COALESCE(SUM(t.price), 0) as revenue
         FROM EventPriceTier pt
         LEFT JOIN Ticket t ON t.tierId = pt.id AND t.status IN ('SOLD', 'USED')
         WHERE pt.eventId = ?
         GROUP BY pt.id`,
        [eventId]
      );

      return reply.send({
        success: true,
        eventId: event.id,
        eventName: event.name,
        sessions: sessions.map((s: any) => ({
          sessionId: s.sessionId,
          date: s.date,
          capacity: s.capacity,
          sold: s.sold,
          revenue: Number(s.revenue),
          checkedIn: s.checkedIn,
        })),
        byZone: byZone.map((z: any) => ({
          zoneId: z.zoneId,
          zoneName: z.zoneName,
          capacity: z.capacity,
          sold: z.sold,
          revenue: Number(z.revenue),
        })),
        byTier: byTier.map((t: any) => ({
          tierId: t.tierId,
          tierName: t.tierName,
          price: Number(t.price),
          sold: t.sold,
          revenue: Number(t.revenue),
        })),
      });
    },
  });

  // GET /api/admin/reports/export - Exportar reportes
  app.get("/api/admin/reports/export", {
    preHandler: [requireOperator],
    handler: async (request, reply) => {
      const { format, type, startDate, endDate, eventId } = request.query as {
        format: "csv" | "xlsx" | "pdf";
        type: string;
        startDate?: string;
        endDate?: string;
        eventId?: string;
      };

      // Get data based on type
      let data: any[] = [];
      let columns: { key: string; header: string }[] = [];
      let title = "";

      if (type === "sales") {
        title = "Reporte de Ventas";
        columns = [
          { key: "orderNumber", header: "# Orden" },
          { key: "buyerName", header: "Cliente" },
          { key: "buyerEmail", header: "Email" },
          { key: "eventName", header: "Evento" },
          { key: "ticketCount", header: "Boletos" },
          { key: "total", header: "Total" },
          { key: "status", header: "Estado" },
          { key: "paidAt", header: "Fecha Pago" },
        ];

        let whereClause = "WHERE o.status = 'PAID'";
        const params: any[] = [];

        if (startDate && endDate) {
          whereClause += " AND DATE(o.paidAt) >= ? AND DATE(o.paidAt) <= ?";
          params.push(startDate, endDate);
        }

        data = await query<RowDataPacket[]>(
          `SELECT 
            o.orderNumber, o.buyerName, o.buyerEmail, o.total, o.status, o.paidAt,
            e.name as eventName,
            COUNT(t.id) as ticketCount
           FROM \`Order\` o
           LEFT JOIN Ticket t ON t.orderId = o.id
           LEFT JOIN EventSession es ON es.id = t.sessionId
           LEFT JOIN Event e ON e.id = es.eventId
           ${whereClause}
           GROUP BY o.id
           ORDER BY o.paidAt DESC`,
          params
        );
      } else if (type === "tickets") {
        title = "Reporte de Boletos";
        columns = [
          { key: "ticketCode", header: "Código" },
          { key: "eventName", header: "Evento" },
          { key: "sessionDate", header: "Fecha Sesión" },
          { key: "buyerName", header: "Comprador" },
          { key: "buyerEmail", header: "Email" },
          { key: "seatInfo", header: "Ubicación" },
          { key: "price", header: "Precio" },
          { key: "status", header: "Estado" },
          { key: "checkedIn", header: "Check-in" },
        ];

        let whereClause = "WHERE 1=1";
        const params: any[] = [];

        if (startDate && endDate) {
          whereClause += " AND DATE(es.startsAt) >= ? AND DATE(es.startsAt) <= ?";
          params.push(startDate, endDate);
        }

        data = await query<RowDataPacket[]>(
          `SELECT 
            t.ticketCode, t.price, t.status, t.checkedInAt,
            e.name as eventName, es.startsAt as sessionDate,
            o.buyerName, o.buyerEmail,
            CONCAT(COALESCE(vz.name, ''), ' - ', COALESCE(s.rowLabel, ''), ' ', COALESCE(s.label, COALESCE(pt.label, ''))) as seatInfo
           FROM Ticket t
           LEFT JOIN Seat s ON s.id = t.seatId
           LEFT JOIN VenueZone vz ON vz.id = s.zoneId
           LEFT JOIN EventPriceTier pt ON pt.id = t.tierId
           JOIN EventSession es ON es.id = t.sessionId
           JOIN Event e ON e.id = es.eventId
           LEFT JOIN \`Order\` o ON o.id = t.orderId
           ${whereClause}
           ORDER BY es.startsAt, e.name`,
          params
        );

        data = data.map((row: any) => ({
          ...row,
          price: `$${Number(row.price).toFixed(2)}`,
          checkedIn: row.checkedInAt ? "Sí" : "No",
          sessionDate: new Date(row.sessionDate).toLocaleString("es-MX"),
        }));
      }

      // Generate output based on format
      if (format === "csv") {
        const header = columns.map(c => escapeCSV(c.header)).join(",");
        const rows = data.map((row: any) =>
          columns.map(c => escapeCSV(row[c.key])).join(",")
        );
        const csv = [header, ...rows].join("\n");

        reply.header("Content-Type", "text/csv; charset=utf-8");
        reply.header("Content-Disposition", `attachment; filename="reporte-${type}-${new Date().toISOString().split('T')[0]}.csv"`);
        return reply.send(csv);
      }

      if (format === "pdf") {
        const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });
        const chunks: Buffer[] = [];

        doc.on("data", (chunk: Buffer) => chunks.push(chunk));
        
        return new Promise((resolve, reject) => {
          doc.on("end", () => {
            const buffer = Buffer.concat(chunks);
            reply.header("Content-Type", "application/pdf");
            reply.header("Content-Disposition", `attachment; filename="reporte-${type}-${new Date().toISOString().split('T')[0]}.pdf"`);
            resolve(reply.send(buffer));
          });
          doc.on("error", reject);

          // Header
          doc.fontSize(18).fillColor("#1a1a2e").text(title, { align: "center" });
          doc.moveDown(0.5);
          doc.fontSize(10).fillColor("#666").text(`Generado: ${new Date().toLocaleString("es-MX")}`, { align: "center" });
          doc.moveDown(1);

          // Simple table
          const pageWidth = doc.page.width - 80;
          const colWidth = pageWidth / columns.length;
          let y = doc.y;

          // Headers
          doc.fontSize(9).fillColor("#fff");
          doc.rect(40, y - 5, pageWidth, 18).fill("#1a1a2e");
          let x = 45;
          columns.forEach(col => {
            doc.fillColor("#fff").text(col.header, x, y, { width: colWidth - 10 });
            x += colWidth;
          });

          doc.moveDown(1);
          y = doc.y;

          // Rows
          doc.fontSize(8).fillColor("#333");
          data.slice(0, 50).forEach((row: any, i) => {
            if (i % 2 === 0) {
              doc.rect(40, y - 3, pageWidth, 14).fill("#f5f5f5");
            }
            x = 45;
            columns.forEach(col => {
              const val = String(row[col.key] ?? "").substring(0, 25);
              doc.fillColor("#333").text(val, x, y, { width: colWidth - 10 });
              x += colWidth;
            });
            y += 14;
            if (y > doc.page.height - 60) {
              doc.addPage();
              y = 40;
            }
          });

          doc.end();
        });
      }

      // Default: return JSON
      return reply.send({ success: true, data, columns });
    },
  });

  // ===========================
  // ADDITIONAL REPORTS
  // ===========================

  // GET /api/admin/reports/financial - Resumen financiero
  app.get("/api/admin/reports/financial", {
    preHandler: [requireOperator],
    handler: async (request, reply) => {
      const { startDate, endDate } = request.query as { startDate: string; endDate: string };
      const params = [startDate, endDate];

      // Ingresos brutos
      const [grossRevenue] = await query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(total), 0) as amount FROM \`Order\` 
         WHERE status = 'PAID' AND DATE(paidAt) >= ? AND DATE(paidAt) <= ?`,
        params
      );

      // Fees cobrados
      const [feesCollected] = await query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(fee), 0) as amount FROM \`Order\` 
         WHERE status = 'PAID' AND DATE(paidAt) >= ? AND DATE(paidAt) <= ?`,
        params
      );

      // Descuentos aplicados
      const [discounts] = await query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(discount), 0) as amount FROM \`Order\` 
         WHERE status = 'PAID' AND DATE(paidAt) >= ? AND DATE(paidAt) <= ?`,
        params
      );

      // Reembolsos
      const [refunds] = await query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(total), 0) as amount, COUNT(*) as count FROM \`Order\` 
         WHERE status = 'REFUNDED' AND DATE(refundedAt) >= ? AND DATE(refundedAt) <= ?`,
        params
      );

      // Órdenes canceladas
      const [cancelled] = await query<RowDataPacket[]>(
        `SELECT COUNT(*) as count FROM \`Order\` 
         WHERE status = 'CANCELLED' AND DATE(cancelledAt) >= ? AND DATE(cancelledAt) <= ?`,
        params
      );

      // Métodos de pago
      const paymentMethods = await query<RowDataPacket[]>(
        `SELECT 
          COALESCE(paymentMethod, 'Sin especificar') as method,
          COUNT(*) as count,
          COALESCE(SUM(total), 0) as amount
         FROM \`Order\`
         WHERE status = 'PAID' AND DATE(paidAt) >= ? AND DATE(paidAt) <= ?
         GROUP BY paymentMethod
         ORDER BY amount DESC`,
        params
      );

      // Ingresos por evento
      const revenueByEvent = await query<RowDataPacket[]>(
        `SELECT 
          e.id, e.name,
          COUNT(DISTINCT o.id) as orders,
          COUNT(t.id) as tickets,
          COALESCE(SUM(t.price), 0) as revenue
         FROM Event e
         JOIN EventSession es ON es.eventId = e.id
         JOIN Ticket t ON t.sessionId = es.id AND t.status IN ('SOLD', 'USED')
         JOIN \`Order\` o ON o.id = t.orderId AND o.status = 'PAID'
         WHERE DATE(o.paidAt) >= ? AND DATE(o.paidAt) <= ?
         GROUP BY e.id
         ORDER BY revenue DESC
         LIMIT 15`,
        params
      );

      const netRevenue = Number(grossRevenue?.amount || 0) - Number(refunds?.amount || 0);

      return reply.send({
        success: true,
        summary: {
          grossRevenue: Number(grossRevenue?.amount || 0),
          feesCollected: Number(feesCollected?.amount || 0),
          discountsApplied: Number(discounts?.amount || 0),
          refundsAmount: Number(refunds?.amount || 0),
          refundsCount: Number(refunds?.count || 0),
          cancelledCount: Number(cancelled?.count || 0),
          netRevenue,
        },
        paymentMethods: paymentMethods.map((m: any) => ({
          method: m.method,
          count: m.count,
          amount: Number(m.amount),
        })),
        revenueByEvent: revenueByEvent.map((e: any) => ({
          id: e.id,
          name: e.name,
          orders: e.orders,
          tickets: e.tickets,
          revenue: Number(e.revenue),
        })),
      });
    },
  });

  // GET /api/admin/reports/occupancy - Ocupación de venues
  app.get("/api/admin/reports/occupancy", {
    preHandler: [requireOperator],
    handler: async (request, reply) => {
      const { eventId } = request.query as { eventId?: string };

      let eventFilter = "";
      const params: any[] = [];

      if (eventId && eventId !== "all") {
        eventFilter = "AND e.id = ?";
        params.push(eventId);
      }

      // Ocupación por zona
      const occupancyByZone = await query<RowDataPacket[]>(
        `SELECT 
          vz.id as zoneId,
          vz.name as zoneName,
          e.name as eventName,
          COUNT(DISTINCT s.id) as totalSeats,
          SUM(CASE WHEN s.status = 'SOLD' THEN 1 ELSE 0 END) as soldSeats,
          SUM(CASE WHEN s.status = 'RESERVED' THEN 1 ELSE 0 END) as reservedSeats,
          SUM(CASE WHEN s.status = 'AVAILABLE' THEN 1 ELSE 0 END) as availableSeats,
          SUM(CASE WHEN s.status = 'BLOCKED' THEN 1 ELSE 0 END) as blockedSeats
         FROM VenueZone vz
         JOIN Venue v ON v.id = vz.venueId
         JOIN Event e ON e.venueId = v.id
         LEFT JOIN Seat s ON s.zoneId = vz.id
         WHERE e.status = 'PUBLISHED' ${eventFilter}
         GROUP BY vz.id, e.id
         ORDER BY e.name, vz.name`,
        params
      );

      // Ocupación por evento
      const occupancyByEvent = await query<RowDataPacket[]>(
        `SELECT 
          e.id as eventId,
          e.name as eventName,
          COUNT(DISTINCT s.id) as totalSeats,
          SUM(CASE WHEN t.status IN ('SOLD', 'USED') THEN 1 ELSE 0 END) as soldSeats,
          SUM(CASE WHEN t.status = 'RESERVED' THEN 1 ELSE 0 END) as reservedSeats
         FROM Event e
         JOIN EventSession es ON es.eventId = e.id
         LEFT JOIN Ticket t ON t.sessionId = es.id
         LEFT JOIN Seat s ON s.id = t.seatId
         WHERE e.status = 'PUBLISHED' ${eventFilter}
         GROUP BY e.id
         ORDER BY soldSeats DESC`,
        params
      );

      return reply.send({
        success: true,
        byZone: occupancyByZone.map((z: any) => ({
          zoneId: z.zoneId,
          zoneName: z.zoneName,
          eventName: z.eventName,
          totalSeats: z.totalSeats || 0,
          soldSeats: z.soldSeats || 0,
          reservedSeats: z.reservedSeats || 0,
          availableSeats: z.availableSeats || 0,
          blockedSeats: z.blockedSeats || 0,
          occupancyRate: z.totalSeats > 0 
            ? Math.round(((z.soldSeats + z.reservedSeats) / z.totalSeats) * 100) 
            : 0,
        })),
        byEvent: occupancyByEvent.map((e: any) => ({
          eventId: e.eventId,
          eventName: e.eventName,
          totalSeats: e.totalSeats || 0,
          soldSeats: e.soldSeats || 0,
          reservedSeats: e.reservedSeats || 0,
          occupancyRate: e.totalSeats > 0 
            ? Math.round((e.soldSeats / e.totalSeats) * 100) 
            : 0,
        })),
      });
    },
  });

  // GET /api/admin/reports/comparison - Comparativa de eventos
  app.get("/api/admin/reports/comparison", {
    preHandler: [requireOperator],
    handler: async (request, reply) => {
      // Comparativa de los últimos 10 eventos
      const comparison = await query<RowDataPacket[]>(
        `SELECT 
          e.id, e.name, e.thumbnailImage,
          MIN(es.startsAt) as eventDate,
          v.name as venueName,
          COUNT(DISTINCT t.id) as ticketsSold,
          COALESCE(SUM(t.price), 0) as revenue,
          COUNT(DISTINCT o.id) as orders,
          AVG(o.total) as avgOrderValue,
          SUM(CASE WHEN t.checkedInAt IS NOT NULL THEN 1 ELSE 0 END) as checkedIn
         FROM Event e
         LEFT JOIN Venue v ON v.id = e.venueId
         LEFT JOIN EventSession es ON es.eventId = e.id
         LEFT JOIN Ticket t ON t.sessionId = es.id AND t.status IN ('SOLD', 'USED')
         LEFT JOIN \`Order\` o ON o.id = t.orderId AND o.status = 'PAID'
         WHERE e.status IN ('PUBLISHED', 'ARCHIVED')
         GROUP BY e.id
         HAVING ticketsSold > 0
         ORDER BY eventDate DESC
         LIMIT 10`
      );

      // Calcular promedios para comparación
      const totals = comparison.reduce(
        (acc: any, e: any) => ({
          totalTickets: acc.totalTickets + (e.ticketsSold || 0),
          totalRevenue: acc.totalRevenue + Number(e.revenue || 0),
          totalOrders: acc.totalOrders + (e.orders || 0),
        }),
        { totalTickets: 0, totalRevenue: 0, totalOrders: 0 }
      );

      const avgTickets = comparison.length > 0 ? totals.totalTickets / comparison.length : 0;
      const avgRevenue = comparison.length > 0 ? totals.totalRevenue / comparison.length : 0;

      return reply.send({
        success: true,
        events: comparison.map((e: any) => ({
          id: e.id,
          name: e.name,
          image: e.thumbnailImage,
          date: e.eventDate,
          venue: e.venueName,
          ticketsSold: e.ticketsSold || 0,
          revenue: Number(e.revenue) || 0,
          orders: e.orders || 0,
          avgOrderValue: Number(e.avgOrderValue) || 0,
          checkedIn: e.checkedIn || 0,
          checkinRate: e.ticketsSold > 0 ? Math.round((e.checkedIn / e.ticketsSold) * 100) : 0,
          vsAvgTickets: avgTickets > 0 ? Math.round(((e.ticketsSold - avgTickets) / avgTickets) * 100) : 0,
          vsAvgRevenue: avgRevenue > 0 ? Math.round(((Number(e.revenue) - avgRevenue) / avgRevenue) * 100) : 0,
        })),
        averages: {
          avgTicketsPerEvent: Math.round(avgTickets),
          avgRevenuePerEvent: Math.round(avgRevenue),
          totalEvents: comparison.length,
        },
      });
    },
  });

  // GET /api/admin/reports/customers - Reporte de clientes
  app.get("/api/admin/reports/customers", {
    preHandler: [requireOperator],
    handler: async (request, reply) => {
      const { startDate, endDate } = request.query as { startDate: string; endDate: string };
      const params = [startDate, endDate];

      // Top compradores
      const topBuyers = await query<RowDataPacket[]>(
        `SELECT 
          o.buyerEmail,
          o.buyerName,
          COUNT(DISTINCT o.id) as totalOrders,
          COUNT(t.id) as totalTickets,
          COALESCE(SUM(o.total), 0) as totalSpent
         FROM \`Order\` o
         LEFT JOIN Ticket t ON t.orderId = o.id
         WHERE o.status = 'PAID' AND DATE(o.paidAt) >= ? AND DATE(o.paidAt) <= ?
         GROUP BY o.buyerEmail
         ORDER BY totalSpent DESC
         LIMIT 20`,
        params
      );

      // Nuevos vs recurrentes
      const [newVsReturning] = await query<RowDataPacket[]>(
        `SELECT 
          COUNT(DISTINCT CASE WHEN orderCount = 1 THEN buyerEmail END) as newCustomers,
          COUNT(DISTINCT CASE WHEN orderCount > 1 THEN buyerEmail END) as returningCustomers
         FROM (
           SELECT buyerEmail, COUNT(*) as orderCount
           FROM \`Order\`
           WHERE status = 'PAID'
           GROUP BY buyerEmail
         ) sub`
      );

      // Tickets por cliente promedio
      const [avgStats] = await query<RowDataPacket[]>(
        `SELECT 
          AVG(ticketsPerCustomer) as avgTickets,
          AVG(spentPerCustomer) as avgSpent
         FROM (
           SELECT 
             o.buyerEmail,
             COUNT(t.id) as ticketsPerCustomer,
             SUM(o.total) as spentPerCustomer
           FROM \`Order\` o
           LEFT JOIN Ticket t ON t.orderId = o.id
           WHERE o.status = 'PAID' AND DATE(o.paidAt) >= ? AND DATE(o.paidAt) <= ?
           GROUP BY o.buyerEmail
         ) sub`,
        params
      );

      return reply.send({
        success: true,
        topBuyers: topBuyers.map((b: any) => ({
          email: b.buyerEmail,
          name: b.buyerName,
          orders: b.totalOrders,
          tickets: b.totalTickets,
          spent: Number(b.totalSpent),
        })),
        customerStats: {
          newCustomers: newVsReturning?.newCustomers || 0,
          returningCustomers: newVsReturning?.returningCustomers || 0,
          avgTicketsPerCustomer: Math.round((avgStats?.avgTickets || 0) * 10) / 10,
          avgSpentPerCustomer: Math.round(Number(avgStats?.avgSpent || 0)),
        },
      });
    },
  });

  // GET /api/admin/reports/coupons - Reporte de cupones
  app.get("/api/admin/reports/coupons", {
    preHandler: [requireOperator],
    handler: async (request, reply) => {
      const { startDate, endDate } = request.query as { startDate: string; endDate: string };
      const params = [startDate, endDate];

      // Uso de cupones
      const couponUsage = await query<RowDataPacket[]>(
        `SELECT 
          c.id, c.code, c.discountType, c.discountValue, c.maxUses,
          COUNT(o.id) as timesUsed,
          COALESCE(SUM(o.discount), 0) as totalDiscounted,
          COALESCE(SUM(o.total), 0) as revenueWithCoupon
         FROM Coupon c
         LEFT JOIN \`Order\` o ON o.couponId = c.id AND o.status = 'PAID'
           AND DATE(o.paidAt) >= ? AND DATE(o.paidAt) <= ?
         GROUP BY c.id
         ORDER BY timesUsed DESC`,
        params
      );

      // Total ahorrado por clientes
      const [totalDiscounts] = await query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(discount), 0) as total FROM \`Order\`
         WHERE status = 'PAID' AND couponId IS NOT NULL
         AND DATE(paidAt) >= ? AND DATE(paidAt) <= ?`,
        params
      );

      return reply.send({
        success: true,
        coupons: couponUsage.map((c: any) => ({
          id: c.id,
          code: c.code,
          discountType: c.discountType,
          discountValue: Number(c.discountValue),
          maxUses: c.maxUses,
          timesUsed: c.timesUsed || 0,
          totalDiscounted: Number(c.totalDiscounted),
          revenueWithCoupon: Number(c.revenueWithCoupon),
        })),
        totalDiscounted: Number(totalDiscounts?.total || 0),
      });
    },
  });
}
