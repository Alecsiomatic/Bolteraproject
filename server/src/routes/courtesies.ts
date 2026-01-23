import { FastifyInstance, FastifyRequest } from "fastify";
import { RowDataPacket } from "mysql2";
import { randomUUID } from "crypto";
import { query, withTransaction } from "../lib/db";
import { z } from "zod";
import { requireAdmin } from "../lib/authMiddleware";

// Helper to format dates to ISO
const toISO = (d: Date | string | null) => (d ? new Date(d).toISOString() : null);

// Helper function to generate ticket code
function generateTicketCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default async function courtesyRoutes(app: FastifyInstance) {
  // GET /api/admin/courtesies - Lista todas las cortesías
  app.get("/api/admin/courtesies", {
    preHandler: [requireAdmin],
    handler: async (request, reply) => {
      const { eventId, status, page = "1", limit = "50" } = request.query as any;
      const pageNum = Math.max(1, parseInt(page, 10));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
      const offset = (pageNum - 1) * limitNum;

      let whereConditions = ["o.paymentMethod = 'COURTESY'"];
      const params: any[] = [];

      if (eventId) {
        whereConditions.push("e.id = ?");
        params.push(eventId);
      }

      if (status) {
        whereConditions.push("o.status = ?");
        params.push(status);
      }

      const whereSQL = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

      request.log.info({ whereSQL, params, pageNum, limitNum }, "Fetching courtesies");

      // Count total
      const [countResult] = await query<RowDataPacket[]>(
        `SELECT COUNT(DISTINCT o.id) as total
         FROM \`Order\` o
         LEFT JOIN Ticket t ON t.orderId = o.id
         LEFT JOIN EventSession es ON es.id = t.sessionId
         LEFT JOIN Event e ON e.id = es.eventId
         ${whereSQL}`,
        params
      );
      const total = countResult?.total || 0;

      request.log.info({ total }, "Courtesies count result");

      // Get courtesies with event info
      const courtesies = await query<RowDataPacket[]>(
        `SELECT DISTINCT
          o.id, o.orderNumber, o.buyerName, o.buyerEmail, o.buyerPhone,
          o.total, o.status, o.notes,
          o.createdAt, o.updatedAt,
          (SELECT COUNT(*) FROM Ticket WHERE orderId = o.id) as ticketCount,
          e.id as eventId, e.name as eventName, e.coverImage as eventImage,
          es.id as sessionId, es.startsAt as sessionDate,
          v.name as venueName,
          u.name as issuedByName, u.email as issuedByEmail
         FROM \`Order\` o
         LEFT JOIN Ticket t ON t.orderId = o.id
         LEFT JOIN EventSession es ON es.id = t.sessionId
         LEFT JOIN Event e ON e.id = es.eventId
         LEFT JOIN Venue v ON v.id = e.venueId
         LEFT JOIN User u ON u.id = o.userId
         ${whereSQL}
         ORDER BY o.createdAt DESC
         LIMIT ? OFFSET ?`,
        [...params, limitNum, offset]
      );

      request.log.info({ courtesiesFound: courtesies.length }, "Courtesies query result");

      return reply.send({
        success: true,
        courtesies: courtesies.map((c: any) => ({
          id: c.id,
          orderNumber: c.orderNumber,
          buyerName: c.buyerName,
          buyerEmail: c.buyerEmail,
          buyerPhone: c.buyerPhone,
          total: Number(c.total),
          status: c.status,
          notes: c.notes,
          ticketCount: c.ticketCount,
          eventId: c.eventId,
          eventName: c.eventName,
          eventImage: c.eventImage,
          sessionId: c.sessionId,
          sessionDate: toISO(c.sessionDate),
          venueName: c.venueName,
          issuedBy: c.issuedByName ? { name: c.issuedByName, email: c.issuedByEmail } : null,
          createdAt: toISO(c.createdAt),
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

  // GET /api/admin/courtesies/:orderId - Detalle de una cortesía
  app.get<{ Params: { orderId: string } }>("/api/admin/courtesies/:orderId", {
    preHandler: [requireAdmin],
    handler: async (request, reply) => {
      const { orderId } = request.params;

      const [order] = await query<RowDataPacket[]>(
        `SELECT o.*, u.name as issuedByName, u.email as issuedByEmail
         FROM \`Order\` o
         LEFT JOIN User u ON u.id = o.userId
         WHERE o.id = ? AND o.paymentMethod = 'COURTESY'`,
        [orderId]
      );

      if (!order) {
        return reply.status(404).send({ success: false, error: "Cortesía no encontrada" });
      }

      // Get tickets with all details
      const tickets = await query<RowDataPacket[]>(
        `SELECT 
          t.id, t.ticketCode as code, t.status, t.price,
          t.holderName, t.holderEmail, t.purchasedAt, t.checkedInAt,
          s.id as seatId, s.label as seatLabel, s.rowLabel,
          vz.name as zoneName, vz.color as zoneColor,
          pt.label as tierLabel,
          e.id as eventId, e.name as eventName, e.coverImage as eventImage,
          e.description as eventDescription,
          es.id as sessionId, es.startsAt as sessionDate,
          v.id as venueId, v.name as venueName, v.address as venueAddress, v.city as venueCity
         FROM Ticket t
         LEFT JOIN Seat s ON s.id = t.seatId
         LEFT JOIN VenueZone vz ON vz.id = s.zoneId
         LEFT JOIN EventPriceTier pt ON pt.id = t.tierId
         JOIN EventSession es ON es.id = t.sessionId
         JOIN Event e ON e.id = es.eventId
         LEFT JOIN Venue v ON v.id = e.venueId
         WHERE t.orderId = ?
         ORDER BY s.rowLabel, s.label`,
        [orderId]
      );

      return reply.send({
        success: true,
        courtesy: {
          id: order.id,
          orderNumber: order.orderNumber,
          buyerName: order.buyerName,
          buyerEmail: order.buyerEmail,
          buyerPhone: order.buyerPhone,
          total: Number(order.total),
          status: order.status,
          notes: order.notes,
          issuedBy: order.issuedByName ? { name: order.issuedByName, email: order.issuedByEmail } : null,
          createdAt: toISO(order.createdAt),
          tickets: tickets.map((t: any) => ({
            id: t.id,
            code: t.code,
            status: t.status,
            price: Number(t.price),
            holderName: t.holderName,
            holderEmail: t.holderEmail,
            purchasedAt: toISO(t.purchasedAt),
            checkedInAt: toISO(t.checkedInAt),
            seatId: t.seatId,
            seatLabel: t.seatLabel,
            rowLabel: t.rowLabel,
            zoneName: t.zoneName,
            zoneColor: t.zoneColor,
            tierLabel: t.tierLabel,
            event: {
              id: t.eventId,
              name: t.eventName,
              coverImage: t.eventImage,
              description: t.eventDescription,
            },
            session: {
              id: t.sessionId,
              startsAt: toISO(t.sessionDate),
            },
            venue: {
              id: t.venueId,
              name: t.venueName,
              address: t.venueAddress,
              city: t.venueCity,
            },
          })),
        },
      });
    },
  });

  // POST /api/admin/courtesies - Crear cortesía (emitir boletos de cortesía)
  app.post("/api/admin/courtesies", {
    preHandler: [requireAdmin],
    handler: async (request, reply) => {
      try {
        const schema = z.object({
          sessionId: z.string().min(1, "Se requiere sessionId"),
          recipientName: z.string().min(1, "Se requiere nombre del beneficiario"),
          recipientEmail: z.string().email("Email inválido"),
          recipientPhone: z.string().optional().nullable(),
          notes: z.string().optional().nullable(),
          // Para asientos numerados - acepta strings o números
          seatIds: z.array(z.union([z.string(), z.number()]).transform(v => String(v))).optional(),
          // Para admisión general
          tierId: z.string().optional().nullable(),
          quantity: z.number().int().min(1).max(50).optional().nullable(),
        });

        let body = request.body;
        if (typeof body === "string") {
          body = JSON.parse(body);
        }

        const payload = schema.parse(body);
        const user = (request as any).user;

        request.log.info({ payload, userId: user.id }, "Creating courtesy - received payload");

        // Validate session exists
        const [session] = await query<RowDataPacket[]>(
          `SELECT es.id, es.eventId, es.startsAt, e.name as eventName, e.venueId,
                  e.eventType
           FROM EventSession es
           JOIN Event e ON e.id = es.eventId
           WHERE es.id = ?`,
          [payload.sessionId]
        );

      if (!session) {
        return reply.status(404).send({ success: false, error: "Sesión no encontrada" });
      }

      request.log.info({ 
        sessionId: session.id, 
        eventId: session.eventId, 
        eventType: session.eventType,
        seatIds: payload.seatIds,
        tierId: payload.tierId,
        quantity: payload.quantity
      }, "Session found, validating input");

      const isSeatedEvent = session.eventType === "seated";
      
      // Validate input based on event type
      if (isSeatedEvent) {
        if (!payload.seatIds || payload.seatIds.length === 0) {
          return reply.status(400).send({ 
            success: false, 
            error: "Se requieren asientos para eventos con selección de asiento" 
          });
        }
      } else {
        if (!payload.tierId || !payload.quantity) {
          return reply.status(400).send({ 
            success: false, 
            error: "Se requiere tierId y quantity para admisión general" 
          });
        }
      }

        let ticketCodes: string[] = [];
        let orderId: string = "";
        let orderNumber: string = "";

        await withTransaction(async (connection) => {
          // Create order
          orderId = randomUUID();
          orderNumber = `CORT-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`;

          await connection.query(
            `INSERT INTO \`Order\` (id, userId, orderNumber, buyerName, buyerEmail, buyerPhone, subtotal, total, currency, status, paymentMethod, notes, paidAt, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, 0, 0, 'MXN', 'PAID', 'COURTESY', ?, NOW(), NOW(), NOW())`,
            [orderId, user.id, orderNumber, payload.recipientName, payload.recipientEmail, payload.recipientPhone || null, payload.notes || `Cortesía emitida por ${user.name}`]
          );

          if (isSeatedEvent && payload.seatIds) {
            // Validate all seats are available
            const seats = await query<RowDataPacket[]>(
              `SELECT s.id, s.label, s.status, s.zoneId,
                      lz.basePrice as price
               FROM Seat s
               LEFT JOIN LayoutZone lz ON lz.sourceZoneId = s.zoneId
               WHERE s.id IN (${payload.seatIds.map(() => '?').join(',')})`,
              payload.seatIds
            );

            request.log.info({ seatsFound: seats.length, expected: payload.seatIds.length, seatIds: payload.seatIds }, "Seats query result");

            if (seats.length !== payload.seatIds.length) {
              throw new Error(`Algunos asientos no existen. Encontrados: ${seats.length}, Esperados: ${payload.seatIds.length}`);
            }

            // Check for already SOLD seats (not RESERVED - we can override reservations for courtesies)
            const soldSeats = await query<RowDataPacket[]>(
              `SELECT t.seatId, t.status, t.orderId 
               FROM Ticket t
               WHERE t.seatId IN (${payload.seatIds.map(() => '?').join(',')})
               AND t.sessionId = ?
               AND t.status = 'SOLD'`,
              [...payload.seatIds, payload.sessionId]
            );

            request.log.info({ soldSeatsCount: soldSeats.length, soldSeats }, "Sold seats check");

            if (soldSeats.length > 0) {
              const soldIds = soldSeats.map(s => s.seatId).join(', ');
              throw new Error(`Los siguientes asientos ya están vendidos: ${soldIds}`);
            }

            // Cancel any existing RESERVED tickets for these seats (admin override)
            const reservedTickets = await query<RowDataPacket[]>(
              `SELECT t.id, t.seatId, t.orderId
               FROM Ticket t
               WHERE t.seatId IN (${payload.seatIds.map(() => '?').join(',')})
               AND t.sessionId = ?
               AND t.status = 'RESERVED'`,
              [...payload.seatIds, payload.sessionId]
            );

            if (reservedTickets.length > 0) {
              request.log.info({ reservedCount: reservedTickets.length }, "Cancelling reserved tickets for courtesy");
              
              // Cancel the reserved tickets
              await connection.query(
                `UPDATE Ticket SET status = 'CANCELLED', updatedAt = NOW() 
                 WHERE id IN (${reservedTickets.map(() => '?').join(',')})`,
                reservedTickets.map(t => t.id)
              );

              // Update seat status back to available (will be set to SOLD below)
              await connection.query(
                `UPDATE Seat SET status = 'AVAILABLE', updatedAt = NOW()
                 WHERE id IN (${reservedTickets.map(() => '?').join(',')})`,
                reservedTickets.map(t => t.seatId)
              );
            }

            // Create tickets for each seat
            for (const seat of seats) {
              const ticketId = randomUUID();
              const ticketCode = generateTicketCode();
              ticketCodes.push(ticketCode);

              // Get tier for this zone if exists
              const [tier] = await query<RowDataPacket[]>(
                `SELECT id, price FROM EventPriceTier WHERE eventId = ? AND zoneId = ? LIMIT 1`,
                [session.eventId, seat.zoneId]
              );

              await connection.query(
                `INSERT INTO Ticket (id, sessionId, seatId, tierId, price, currency, status, orderId, ticketCode, holderName, holderEmail, purchasedAt, createdAt, updatedAt)
                 VALUES (?, ?, ?, ?, 0, 'MXN', 'SOLD', ?, ?, ?, ?, NOW(), NOW(), NOW())`,
                [ticketId, payload.sessionId, seat.id, tier?.id || null, orderId, ticketCode, payload.recipientName, payload.recipientEmail]
              );

              // Update seat status
              await connection.query(
                `UPDATE Seat SET status = 'SOLD', updatedAt = NOW() WHERE id = ?`,
                [seat.id]
              );
            }
          } else if (payload.tierId && payload.quantity) {
            // General admission - validate tier
            const [tier] = await query<RowDataPacket[]>(
              `SELECT id, label, price FROM EventPriceTier WHERE id = ? AND eventId = ?`,
              [payload.tierId, session.eventId]
            );

            if (!tier) {
              throw new Error("Tipo de boleto no encontrado");
            }

            // Create tickets without seats
            for (let i = 0; i < payload.quantity; i++) {
              const ticketId = randomUUID();
              const ticketCode = generateTicketCode();
              ticketCodes.push(ticketCode);

              await connection.query(
                `INSERT INTO Ticket (id, sessionId, seatId, tierId, price, currency, status, orderId, ticketCode, holderName, holderEmail, purchasedAt, createdAt, updatedAt)
                 VALUES (?, ?, NULL, ?, 0, 'MXN', 'SOLD', ?, ?, ?, ?, NOW(), NOW(), NOW())`,
                [ticketId, payload.sessionId, payload.tierId, orderId, ticketCode, payload.recipientName, payload.recipientEmail]
              );
            }
          }
        });

        request.log.info({ orderId, ticketCount: ticketCodes.length }, "Courtesy created");

        return reply.send({
          success: true,
          courtesy: {
            id: orderId,
            orderNumber,
            recipientName: payload.recipientName,
            recipientEmail: payload.recipientEmail,
            ticketCount: ticketCodes.length,
            ticketCodes,
          },
        });
      } catch (error: any) {
        request.log.error({ error: error.message, stack: error.stack, name: error.name }, "Error creating courtesy");
        
        // Handle Zod validation errors
        if (error.name === 'ZodError') {
          const zodError = error as z.ZodError;
          const messages = zodError.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
          return reply.status(400).send({
            success: false,
            error: `Validación fallida: ${messages}`,
          });
        }
        
        return reply.status(400).send({
          success: false,
          error: error.message || "Error al crear la cortesía",
        });
      }
    },
  });

  // DELETE /api/admin/courtesies/:orderId - Cancelar cortesía
  app.delete<{ Params: { orderId: string } }>("/api/admin/courtesies/:orderId", {
    preHandler: [requireAdmin],
    handler: async (request, reply) => {
      const { orderId } = request.params;

      const [order] = await query<RowDataPacket[]>(
        `SELECT id, status FROM \`Order\` WHERE id = ? AND paymentMethod = 'COURTESY'`,
        [orderId]
      );

      if (!order) {
        return reply.status(404).send({ success: false, error: "Cortesía no encontrada" });
      }

      if (order.status === "CANCELLED") {
        return reply.status(400).send({ success: false, error: "La cortesía ya está cancelada" });
      }

      await withTransaction(async (connection) => {
        // Get tickets to release seats
        const tickets = await query<RowDataPacket[]>(
          `SELECT id, seatId FROM Ticket WHERE orderId = ?`,
          [orderId]
        );

        // Release seats
        for (const ticket of tickets) {
          if (ticket.seatId) {
            await connection.query(
              `UPDATE Seat SET status = 'AVAILABLE', updatedAt = NOW() WHERE id = ?`,
              [ticket.seatId]
            );
          }
        }

        // Cancel tickets
        await connection.query(
          `UPDATE Ticket SET status = 'CANCELLED', updatedAt = NOW() WHERE orderId = ?`,
          [orderId]
        );

        // Cancel order
        await connection.query(
          `UPDATE \`Order\` SET status = 'CANCELLED', cancelledAt = NOW(), updatedAt = NOW() WHERE id = ?`,
          [orderId]
        );
      });

      return reply.send({ success: true, message: "Cortesía cancelada" });
    },
  });

  // GET /api/admin/courtesies/stats - Estadísticas de cortesías
  app.get("/api/admin/courtesies/stats", {
    preHandler: [requireAdmin],
    handler: async (request, reply) => {
      const { eventId, startDate, endDate } = request.query as any;

      let whereConditions = ["o.paymentMethod = 'COURTESY'"];
      const params: any[] = [];

      if (eventId) {
        whereConditions.push("e.id = ?");
        params.push(eventId);
      }

      if (startDate) {
        whereConditions.push("o.createdAt >= ?");
        params.push(startDate);
      }

      if (endDate) {
        whereConditions.push("o.createdAt <= ?");
        params.push(endDate);
      }

      const whereSQL = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

      // Total stats
      const [totals] = await query<RowDataPacket[]>(
        `SELECT 
          COUNT(DISTINCT o.id) as totalOrders,
          COUNT(t.id) as totalTickets,
          SUM(CASE WHEN t.checkedInAt IS NOT NULL THEN 1 ELSE 0 END) as usedTickets
         FROM \`Order\` o
         LEFT JOIN Ticket t ON t.orderId = o.id
         LEFT JOIN EventSession es ON es.id = t.sessionId
         LEFT JOIN Event e ON e.id = es.eventId
         ${whereSQL}`,
        params
      );

      // By event
      const byEvent = await query<RowDataPacket[]>(
        `SELECT 
          e.id as eventId, e.name as eventName,
          COUNT(DISTINCT o.id) as orderCount,
          COUNT(t.id) as ticketCount
         FROM \`Order\` o
         LEFT JOIN Ticket t ON t.orderId = o.id
         LEFT JOIN EventSession es ON es.id = t.sessionId
         LEFT JOIN Event e ON e.id = es.eventId
         ${whereSQL}
         GROUP BY e.id, e.name
         ORDER BY ticketCount DESC
         LIMIT 10`,
        params
      );

      return reply.send({
        success: true,
        stats: {
          totalOrders: totals?.totalOrders || 0,
          totalTickets: totals?.totalTickets || 0,
          usedTickets: totals?.usedTickets || 0,
          unusedTickets: (totals?.totalTickets || 0) - (totals?.usedTickets || 0),
          byEvent: byEvent.map((e: any) => ({
            eventId: e.eventId,
            eventName: e.eventName,
            orderCount: e.orderCount,
            ticketCount: e.ticketCount,
          })),
        },
      });
    },
  });

  // GET /api/admin/courtesies/:orderId/tickets-pdf - Generar PDF de boletos
  app.get<{ Params: { orderId: string } }>("/api/admin/courtesies/:orderId/tickets-pdf", {
    preHandler: [requireAdmin],
    handler: async (request, reply) => {
      const { orderId } = request.params;

      // Get order with tickets
      const [order] = await query<RowDataPacket[]>(
        `SELECT o.*, u.name as issuedByName
         FROM \`Order\` o
         LEFT JOIN User u ON u.id = o.userId
         WHERE o.id = ? AND o.paymentMethod = 'COURTESY'`,
        [orderId]
      );

      if (!order) {
        return reply.status(404).send({ success: false, error: "Cortesía no encontrada" });
      }

      // Get tickets with all details
      const tickets = await query<RowDataPacket[]>(
        `SELECT 
          t.id, t.ticketCode as code, t.status, t.price,
          t.holderName, t.holderEmail,
          s.id as seatId, s.label as seatLabel, s.rowLabel,
          vz.name as zoneName, vz.color as zoneColor,
          pt.label as tierLabel,
          e.id as eventId, e.name as eventName, e.coverImage as eventImage,
          e.description as eventDescription,
          es.id as sessionId, es.startsAt as sessionDate,
          v.id as venueId, v.name as venueName, v.address as venueAddress, v.city as venueCity
         FROM Ticket t
         LEFT JOIN Seat s ON s.id = t.seatId
         LEFT JOIN VenueZone vz ON vz.id = s.zoneId
         LEFT JOIN EventPriceTier pt ON pt.id = t.tierId
         JOIN EventSession es ON es.id = t.sessionId
         JOIN Event e ON e.id = es.eventId
         LEFT JOIN Venue v ON v.id = e.venueId
         WHERE t.orderId = ?
         ORDER BY s.rowLabel, s.label`,
        [orderId]
      );

      // Get app config for branding (handle missing table gracefully)
      let config: Record<string, string> = {};
      try {
        const settings = await query<RowDataPacket[]>(
          `SELECT \`key\`, value FROM Setting WHERE \`key\` IN ('app.name', 'app.logo', 'app.primaryColor')`,
          []
        );
        for (const s of settings) {
          config[s.key] = s.value;
        }
      } catch (err) {
        // Setting table might not exist, use defaults
        request.log.warn({ err }, "Setting table not found, using defaults");
      }

      // Return data for PDF generation (frontend will generate the PDF)
      return reply.send({
        success: true,
        data: {
          order: {
            id: order.id,
            orderNumber: order.orderNumber,
            buyerName: order.buyerName,
            buyerEmail: order.buyerEmail,
            issuedBy: order.issuedByName,
            createdAt: toISO(order.createdAt),
          },
          tickets: tickets.map((t: any) => ({
            id: t.id,
            code: t.code,
            holderName: t.holderName,
            seatLabel: t.seatLabel,
            rowLabel: t.rowLabel,
            zoneName: t.zoneName,
            zoneColor: t.zoneColor,
            tierLabel: t.tierLabel,
            event: {
              name: t.eventName,
              coverImage: t.eventImage,
              description: t.eventDescription,
            },
            session: {
              startsAt: toISO(t.sessionDate),
            },
            venue: {
              name: t.venueName,
              address: t.venueAddress,
              city: t.venueCity,
            },
          })),
          branding: {
            appName: config['app.name'] || 'Boletera',
            appLogo: config['app.logo'] || null,
            primaryColor: config['app.primaryColor'] || '#F59E0B',
          },
        },
      });
    },
  });
}
