import { FastifyInstance } from "fastify";
import { RowDataPacket } from "mysql2";
import { query } from "../lib/db";
import { requireAuth, requireOperator } from "../lib/authMiddleware";
import { generateTicketPDF, generateMultipleTicketsPDF, TicketPDFData, generateQRCode } from "../lib/pdfGenerator";

interface TicketWithDetails extends RowDataPacket {
  id: string;
  ticketCode: string;
  price: number;
  currency: string;
  status: string;
  holderName: string | null;
  holderEmail: string | null;
  purchasedAt: Date | null;
  // Seat info
  seatLabel: string | null;
  seatRow: string | null;
  seatColumn: number | null;
  zoneName: string | null;
  // Tier info
  tierName: string | null;
  // Event info
  eventName: string;
  eventDate: Date;
  // Venue info
  venueName: string;
  venueAddress: string | null;
  // Order info
  orderNumber: string;
  buyerName: string | null;
  buyerEmail: string | null;
}

export async function ticketsRoutes(app: FastifyInstance) {
  
  // GET /api/tickets/:ticketCode/pdf - Descargar PDF de un ticket
  app.get<{ Params: { ticketCode: string } }>("/api/tickets/:ticketCode/pdf", {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { ticketCode } = request.params;
      const user = (request as any).user;

      // Obtener el ticket con todos sus detalles
      const [ticket] = await query<TicketWithDetails[]>(
        `SELECT 
          t.id, t.ticketCode, t.price, t.currency, t.status, t.holderName, t.holderEmail, t.purchasedAt,
          s.label as seatLabel, s.rowLabel as seatRow, s.columnNumber as seatColumn,
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
         JOIN Venue v ON v.id = e.venueId
         LEFT JOIN \`Order\` o ON o.id = t.orderId
         WHERE t.ticketCode = ?`,
        [ticketCode]
      );

      if (!ticket) {
        return reply.status(404).send({
          success: false,
          error: "Ticket no encontrado",
        });
      }

      // Verificar que el usuario tiene acceso al ticket
      const isAdmin = user.role === "ADMIN" || user.role === "OPERATOR";
      const isOwner = ticket.holderEmail === user.email || ticket.buyerEmail === user.email;

      if (!isAdmin && !isOwner) {
        return reply.status(403).send({
          success: false,
          error: "No tienes acceso a este ticket",
        });
      }

      // Solo generar PDF para tickets vendidos
      if (ticket.status !== "SOLD") {
        return reply.status(400).send({
          success: false,
          error: "Solo se pueden generar PDFs para tickets vendidos",
        });
      }

      const pdfData: TicketPDFData = {
        ticketCode: ticket.ticketCode,
        eventName: ticket.eventName,
        eventDate: ticket.eventDate,
        venueName: ticket.venueName,
        venueAddress: ticket.venueAddress || undefined,
        seatInfo: {
          zone: ticket.zoneName || undefined,
          row: ticket.seatRow || undefined,
          seat: ticket.seatLabel || (ticket.seatColumn ? `${ticket.seatColumn}` : undefined),
        },
        tierName: ticket.tierName || undefined,
        price: Number(ticket.price),
        currency: ticket.currency,
        holderName: ticket.holderName || ticket.buyerName || undefined,
        holderEmail: ticket.holderEmail || ticket.buyerEmail || undefined,
        orderNumber: ticket.orderNumber,
        purchasedAt: ticket.purchasedAt || undefined,
      };

      const pdfBuffer = await generateTicketPDF(pdfData);

      reply.header("Content-Type", "application/pdf");
      reply.header("Content-Disposition", `attachment; filename="ticket-${ticketCode}.pdf"`);
      
      return reply.send(pdfBuffer);
    },
  });

  // GET /api/tickets/:ticketCode/qr - Obtener solo el código QR como imagen
  app.get<{ Params: { ticketCode: string } }>("/api/tickets/:ticketCode/qr", {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { ticketCode } = request.params;
      const user = (request as any).user;

      // Verificar que el ticket existe
      const [ticket] = await query<RowDataPacket[]>(
        `SELECT t.id, t.ticketCode, t.holderEmail, o.buyerEmail
         FROM Ticket t
         LEFT JOIN \`Order\` o ON o.id = t.orderId
         WHERE t.ticketCode = ?`,
        [ticketCode]
      );

      if (!ticket) {
        return reply.status(404).send({
          success: false,
          error: "Ticket no encontrado",
        });
      }

      // Verificar acceso
      const isAdmin = user.role === "ADMIN" || user.role === "OPERATOR";
      const isOwner = ticket.holderEmail === user.email || ticket.buyerEmail === user.email;

      if (!isAdmin && !isOwner) {
        return reply.status(403).send({
          success: false,
          error: "No tienes acceso a este ticket",
        });
      }

      const qrBuffer = await generateQRCode(ticketCode, 300);

      reply.header("Content-Type", "image/png");
      reply.header("Content-Disposition", `inline; filename="qr-${ticketCode}.png"`);
      
      return reply.send(qrBuffer);
    },
  });

  // GET /api/orders/:orderNumber/pdf - Descargar todos los tickets de una orden en un PDF
  app.get<{ Params: { orderNumber: string } }>("/api/orders/:orderNumber/pdf", {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { orderNumber } = request.params;
      const user = (request as any).user;

      // Verificar acceso a la orden
      const [order] = await query<RowDataPacket[]>(
        `SELECT id, userId, buyerEmail FROM \`Order\` WHERE orderNumber = ?`,
        [orderNumber]
      );

      if (!order) {
        return reply.status(404).send({
          success: false,
          error: "Orden no encontrada",
        });
      }

      const isAdmin = user.role === "ADMIN" || user.role === "OPERATOR";
      const isOwner = order.userId === user.id || order.buyerEmail === user.email;

      if (!isAdmin && !isOwner) {
        return reply.status(403).send({
          success: false,
          error: "No tienes acceso a esta orden",
        });
      }

      // Obtener todos los tickets de la orden
      const tickets = await query<TicketWithDetails[]>(
        `SELECT 
          t.id, t.ticketCode, t.price, t.currency, t.status, t.holderName, t.holderEmail, t.purchasedAt,
          s.label as seatLabel, s.rowLabel as seatRow, s.columnNumber as seatColumn,
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
         JOIN Venue v ON v.id = e.venueId
         JOIN \`Order\` o ON o.id = t.orderId
         WHERE o.orderNumber = ? AND t.status = 'SOLD'
         ORDER BY t.createdAt`,
        [orderNumber]
      );

      if (tickets.length === 0) {
        return reply.status(404).send({
          success: false,
          error: "No hay tickets vendidos en esta orden",
        });
      }

      const pdfDataArray: TicketPDFData[] = tickets.map((ticket) => ({
        ticketCode: ticket.ticketCode,
        eventName: ticket.eventName,
        eventDate: ticket.eventDate,
        venueName: ticket.venueName,
        venueAddress: ticket.venueAddress || undefined,
        seatInfo: {
          zone: ticket.zoneName || undefined,
          row: ticket.seatRow || undefined,
          seat: ticket.seatLabel || (ticket.seatColumn ? `${ticket.seatColumn}` : undefined),
        },
        tierName: ticket.tierName || undefined,
        price: Number(ticket.price),
        currency: ticket.currency,
        holderName: ticket.holderName || ticket.buyerName || undefined,
        holderEmail: ticket.holderEmail || ticket.buyerEmail || undefined,
        orderNumber: ticket.orderNumber,
        purchasedAt: ticket.purchasedAt || undefined,
      }));

      const pdfBuffer = await generateMultipleTicketsPDF(pdfDataArray);

      reply.header("Content-Type", "application/pdf");
      reply.header("Content-Disposition", `attachment; filename="tickets-${orderNumber}.pdf"`);
      
      return reply.send(pdfBuffer);
    },
  });

  // GET /api/tickets/:ticketCode - Obtener detalles de un ticket (para mostrar en app)
  app.get<{ Params: { ticketCode: string } }>("/api/tickets/:ticketCode", {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { ticketCode } = request.params;
      const user = (request as any).user;

      const [ticket] = await query<TicketWithDetails[]>(
        `SELECT 
          t.id, t.ticketCode, t.price, t.currency, t.status, t.holderName, t.holderEmail, 
          t.purchasedAt, t.checkedInAt, t.checkedInBy,
          s.label as seatLabel, s.rowLabel as seatRow, s.columnNumber as seatColumn,
          vz.name as zoneName,
          pt.label as tierName,
          e.id as eventId, e.name as eventName, e.thumbnailImage as eventImage,
          es.id as sessionId, es.startsAt as eventDate,
          v.id as venueId, v.name as venueName, v.address as venueAddress,
          o.orderNumber, o.buyerName, o.buyerEmail
         FROM Ticket t
         LEFT JOIN Seat s ON s.id = t.seatId
         LEFT JOIN VenueZone vz ON vz.id = s.zoneId
         LEFT JOIN EventPriceTier pt ON pt.id = t.tierId
         JOIN EventSession es ON es.id = t.sessionId
         JOIN Event e ON e.id = es.eventId
         JOIN Venue v ON v.id = e.venueId
         LEFT JOIN \`Order\` o ON o.id = t.orderId
         WHERE t.ticketCode = ?`,
        [ticketCode]
      );

      if (!ticket) {
        return reply.status(404).send({
          success: false,
          error: "Ticket no encontrado",
        });
      }

      // Verificar acceso
      const isAdmin = user.role === "ADMIN" || user.role === "OPERATOR";
      const isOwner = ticket.holderEmail === user.email || ticket.buyerEmail === user.email;

      if (!isAdmin && !isOwner) {
        return reply.status(403).send({
          success: false,
          error: "No tienes acceso a este ticket",
        });
      }

      return reply.send({
        success: true,
        ticket: {
          id: ticket.id,
          ticketCode: ticket.ticketCode,
          status: ticket.status,
          price: Number(ticket.price),
          currency: ticket.currency,
          holderName: ticket.holderName,
          holderEmail: ticket.holderEmail,
          purchasedAt: ticket.purchasedAt,
          checkedInAt: ticket.checkedInAt,
          checkedInBy: ticket.checkedInBy,
          seat: ticket.seatLabel
            ? {
                label: ticket.seatLabel,
                row: ticket.seatRow,
                column: ticket.seatColumn,
                zone: ticket.zoneName,
              }
            : null,
          tier: ticket.tierName,
          event: {
            id: ticket.eventId,
            name: ticket.eventName,
            image: ticket.eventImage,
            date: ticket.eventDate,
            sessionId: ticket.sessionId,
          },
          venue: {
            id: ticket.venueId,
            name: ticket.venueName,
            address: ticket.venueAddress,
          },
          order: ticket.orderNumber
            ? {
                orderNumber: ticket.orderNumber,
                buyerName: ticket.buyerName,
                buyerEmail: ticket.buyerEmail,
              }
            : null,
        },
      });
    },
  });

  // POST /api/tickets/:ticketCode/transfer - Transferir un boleto a otro usuario
  app.post<{ Params: { ticketCode: string } }>("/api/tickets/:ticketCode/transfer", {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { ticketCode } = request.params;
      const user = (request as any).user;
      const { newHolderName, newHolderEmail, message } = request.body as {
        newHolderName: string;
        newHolderEmail: string;
        message?: string;
      };

      if (!newHolderName || !newHolderEmail) {
        return reply.status(400).send({
          success: false,
          error: "Nombre y email del nuevo titular son requeridos",
        });
      }

      // Validar formato de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newHolderEmail)) {
        return reply.status(400).send({
          success: false,
          error: "El email proporcionado no es válido",
        });
      }

      // Obtener el ticket
      const [ticket] = await query<RowDataPacket[]>(
        `SELECT t.id, t.ticketCode, t.status, t.holderEmail, t.holderName, t.sessionId,
                o.buyerEmail, o.userId,
                e.name as eventName, es.startsAt as eventDate, v.name as venueName
         FROM Ticket t
         LEFT JOIN \`Order\` o ON o.id = t.orderId
         JOIN EventSession es ON es.id = t.sessionId
         JOIN Event e ON e.id = es.eventId
         JOIN Venue v ON v.id = e.venueId
         WHERE t.ticketCode = ?`,
        [ticketCode]
      );

      if (!ticket) {
        return reply.status(404).send({
          success: false,
          error: "Ticket no encontrado",
        });
      }

      // Verificar que el usuario es el dueño del ticket
      const isOwner = ticket.holderEmail === user.email || ticket.buyerEmail === user.email || ticket.userId === user.id;
      const isAdmin = user.role === "ADMIN";

      if (!isOwner && !isAdmin) {
        return reply.status(403).send({
          success: false,
          error: "No tienes permiso para transferir este ticket",
        });
      }

      // Verificar que el ticket está en estado SOLD (no refunded, cancelled, etc.)
      if (ticket.status !== "SOLD") {
        return reply.status(400).send({
          success: false,
          error: "Solo se pueden transferir tickets vendidos activos",
        });
      }

      // Verificar que el evento aún no ha pasado
      const eventDate = new Date(ticket.eventDate);
      if (eventDate < new Date()) {
        return reply.status(400).send({
          success: false,
          error: "No se pueden transferir tickets de eventos pasados",
        });
      }

      // No permitir transferir a uno mismo
      if (newHolderEmail.toLowerCase() === user.email.toLowerCase()) {
        return reply.status(400).send({
          success: false,
          error: "No puedes transferir el ticket a ti mismo",
        });
      }

      // Guardar información del titular anterior para el registro
      const previousHolderName = ticket.holderName;
      const previousHolderEmail = ticket.holderEmail;

      // Actualizar el ticket con el nuevo titular
      await query(
        `UPDATE Ticket SET holderName = ?, holderEmail = ?, updatedAt = NOW() WHERE ticketCode = ?`,
        [newHolderName, newHolderEmail.toLowerCase(), ticketCode]
      );

      // Obtener información adicional del asiento si existe
      const [seatInfo] = await query<RowDataPacket[]>(
        `SELECT s.label, s.rowLabel, s.columnNumber, vz.name as zoneName
         FROM Ticket t
         LEFT JOIN Seat s ON s.id = t.seatId
         LEFT JOIN VenueZone vz ON vz.id = s.zoneId
         WHERE t.ticketCode = ?`,
        [ticketCode]
      );

      const seatLabel = seatInfo?.label 
        ? `${seatInfo.zoneName ? seatInfo.zoneName + ' - ' : ''}${seatInfo.label}`
        : undefined;

      // Enviar notificación por email al nuevo titular
      const { sendTicketTransferEmail } = await import("../lib/emailService");
      sendTicketTransferEmail({
        newHolderName,
        newHolderEmail: newHolderEmail.toLowerCase(),
        previousHolderName: previousHolderName || user.name || "Usuario",
        previousHolderEmail: previousHolderEmail || user.email,
        ticketCode,
        eventName: ticket.eventName,
        eventDate: new Date(ticket.eventDate),
        venueName: ticket.venueName,
        seatInfo: seatLabel,
        personalMessage: message,
      }).catch((err: any) => {
        console.error("[Transfer] Error sending email:", err);
      });

      return reply.send({
        success: true,
        message: "Ticket transferido exitosamente",
        transfer: {
          ticketCode,
          previousHolder: {
            name: previousHolderName,
            email: previousHolderEmail,
          },
          newHolder: {
            name: newHolderName,
            email: newHolderEmail.toLowerCase(),
          },
          transferredAt: new Date().toISOString(),
          transferredBy: user.email,
        },
      });
    },
  });
}
