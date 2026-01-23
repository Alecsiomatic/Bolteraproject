import { FastifyInstance } from "fastify";
import { RowDataPacket } from "mysql2";
import { query } from "../lib/db";
import { requireAuth, requireOperator } from "../lib/authMiddleware";

interface TicketForCheckin extends RowDataPacket {
  id: string;
  ticketCode: string;
  status: string;
  holderName: string | null;
  holderEmail: string | null;
  checkedInAt: Date | null;
  checkedInBy: string | null;
  // Seat info
  seatLabel: string | null;
  seatRow: string | null;
  zoneName: string | null;
  // Event info
  eventId: string;
  eventName: string;
  sessionId: string;
  sessionStartsAt: Date;
  // Tier
  tierName: string | null;
}

export async function checkinRoutes(app: FastifyInstance) {
  
  // POST /api/checkin/:ticketCode - Marcar entrada de un ticket
  app.post<{ Params: { ticketCode: string } }>("/api/checkin/:ticketCode", {
    preHandler: [requireOperator],
    handler: async (request, reply) => {
      const { ticketCode } = request.params;
      const operator = (request as any).user;

      // Buscar el ticket
      const [ticket] = await query<TicketForCheckin[]>(
        `SELECT 
          t.id, t.ticketCode, t.status, t.holderName, t.holderEmail, t.checkedInAt, t.checkedInBy,
          s.label as seatLabel, s.rowLabel as seatRow,
          vz.name as zoneName,
          pt.label as tierName,
          e.id as eventId, e.name as eventName,
          es.id as sessionId, es.startsAt as sessionStartsAt
         FROM Ticket t
         LEFT JOIN Seat s ON s.id = t.seatId
         LEFT JOIN VenueZone vz ON vz.id = s.zoneId
         LEFT JOIN EventPriceTier pt ON pt.id = t.tierId
         JOIN EventSession es ON es.id = t.sessionId
         JOIN Event e ON e.id = es.eventId
         WHERE t.ticketCode = ?`,
        [ticketCode]
      );

      if (!ticket) {
        return reply.status(404).send({
          success: false,
          error: "Ticket no encontrado",
          code: "TICKET_NOT_FOUND",
        });
      }

      // Verificar estado del ticket
      if (ticket.status === "CANCELLED" || ticket.status === "REFUNDED") {
        return reply.status(400).send({
          success: false,
          error: "Este ticket ha sido cancelado o reembolsado",
          code: "TICKET_CANCELLED",
          ticket: {
            ticketCode: ticket.ticketCode,
            status: ticket.status,
          },
        });
      }

      if (ticket.status !== "SOLD") {
        return reply.status(400).send({
          success: false,
          error: "Este ticket no está en estado vendido",
          code: "TICKET_NOT_SOLD",
          ticket: {
            ticketCode: ticket.ticketCode,
            status: ticket.status,
          },
        });
      }

      // Verificar si ya hizo check-in
      if (ticket.checkedInAt) {
        return reply.status(409).send({
          success: false,
          error: "Este ticket ya registró entrada",
          code: "ALREADY_CHECKED_IN",
          ticket: {
            ticketCode: ticket.ticketCode,
            checkedInAt: ticket.checkedInAt,
            checkedInBy: ticket.checkedInBy,
            eventName: ticket.eventName,
            holderName: ticket.holderName,
          },
        });
      }

      // Verificar que el evento no haya pasado (permitir hasta 4 horas después)
      const sessionDate = new Date(ticket.sessionStartsAt);
      const maxCheckinTime = new Date(sessionDate.getTime() + 4 * 60 * 60 * 1000);
      const now = new Date();

      if (now > maxCheckinTime) {
        return reply.status(400).send({
          success: false,
          error: "El período de check-in para este evento ha terminado",
          code: "EVENT_ENDED",
          ticket: {
            ticketCode: ticket.ticketCode,
            eventName: ticket.eventName,
            eventDate: sessionDate,
          },
        });
      }

      // Verificar que el evento no sea muy anticipado (no más de 3 horas antes)
      const minCheckinTime = new Date(sessionDate.getTime() - 3 * 60 * 60 * 1000);
      if (now < minCheckinTime) {
        return reply.status(400).send({
          success: false,
          error: "El check-in aún no está disponible para este evento",
          code: "CHECKIN_NOT_STARTED",
          ticket: {
            ticketCode: ticket.ticketCode,
            eventName: ticket.eventName,
            eventDate: sessionDate,
            checkinOpensAt: minCheckinTime,
          },
        });
      }

      // Realizar el check-in
      await query(
        `UPDATE Ticket SET checkedInAt = NOW(), checkedInBy = ?, updatedAt = NOW() WHERE id = ?`,
        [operator.id, ticket.id]
      );

      return reply.send({
        success: true,
        message: "Check-in exitoso",
        ticket: {
          ticketCode: ticket.ticketCode,
          holderName: ticket.holderName || "Sin nombre",
          holderEmail: ticket.holderEmail,
          eventName: ticket.eventName,
          eventDate: ticket.sessionStartsAt,
          tier: ticket.tierName || "General",
          seat: ticket.seatLabel
            ? {
                label: ticket.seatLabel,
                row: ticket.seatRow,
                zone: ticket.zoneName,
              }
            : null,
          checkedInAt: new Date(),
          checkedInBy: operator.name,
        },
      });
    },
  });

  // GET /api/checkin/:ticketCode - Verificar un ticket sin hacer check-in
  app.get<{ Params: { ticketCode: string } }>("/api/checkin/:ticketCode", {
    preHandler: [requireOperator],
    handler: async (request, reply) => {
      const { ticketCode } = request.params;

      const [ticket] = await query<TicketForCheckin[]>(
        `SELECT 
          t.id, t.ticketCode, t.status, t.holderName, t.holderEmail, t.checkedInAt, t.checkedInBy,
          s.label as seatLabel, s.rowLabel as seatRow,
          vz.name as zoneName,
          pt.label as tierName,
          e.id as eventId, e.name as eventName,
          es.id as sessionId, es.startsAt as sessionStartsAt,
          v.name as venueName
         FROM Ticket t
         LEFT JOIN Seat s ON s.id = t.seatId
         LEFT JOIN VenueZone vz ON vz.id = s.zoneId
         LEFT JOIN EventPriceTier pt ON pt.id = t.tierId
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
          valid: false,
        });
      }

      const canCheckin =
        ticket.status === "SOLD" &&
        !ticket.checkedInAt;

      return reply.send({
        success: true,
        valid: canCheckin,
        ticket: {
          ticketCode: ticket.ticketCode,
          status: ticket.status,
          holderName: ticket.holderName || "Sin nombre",
          holderEmail: ticket.holderEmail,
          eventName: ticket.eventName,
          eventDate: ticket.sessionStartsAt,
          tier: ticket.tierName || "General",
          seat: ticket.seatLabel
            ? {
                label: ticket.seatLabel,
                row: ticket.seatRow,
                zone: ticket.zoneName,
              }
            : null,
          checkedInAt: ticket.checkedInAt,
          checkedInBy: ticket.checkedInBy,
        },
      });
    },
  });

  // GET /api/checkin/session/:sessionId/stats - Estadísticas de check-in de una sesión
  app.get<{ Params: { sessionId: string } }>("/api/checkin/session/:sessionId/stats", {
    preHandler: [requireOperator],
    handler: async (request, reply) => {
      const { sessionId } = request.params;

      // Verificar que la sesión existe
      const [session] = await query<RowDataPacket[]>(
        `SELECT es.id, es.startsAt, e.name as eventName, v.name as venueName
         FROM EventSession es
         JOIN Event e ON e.id = es.eventId
         JOIN Venue v ON v.id = e.venueId
         WHERE es.id = ?`,
        [sessionId]
      );

      if (!session) {
        return reply.status(404).send({
          success: false,
          error: "Sesión no encontrada",
        });
      }

      // Obtener estadísticas
      const [stats] = await query<RowDataPacket[]>(
        `SELECT 
          COUNT(*) as totalTickets,
          SUM(CASE WHEN status = 'SOLD' THEN 1 ELSE 0 END) as soldTickets,
          SUM(CASE WHEN checkedInAt IS NOT NULL THEN 1 ELSE 0 END) as checkedInTickets
         FROM Ticket
         WHERE sessionId = ?`,
        [sessionId]
      );

      // Obtener últimos check-ins
      const recentCheckins = await query<RowDataPacket[]>(
        `SELECT t.ticketCode, t.holderName, t.checkedInAt, u.name as operatorName
         FROM Ticket t
         LEFT JOIN User u ON u.id = t.checkedInBy
         WHERE t.sessionId = ? AND t.checkedInAt IS NOT NULL
         ORDER BY t.checkedInAt DESC
         LIMIT 10`,
        [sessionId]
      );

      return reply.send({
        success: true,
        session: {
          id: session.id,
          eventName: session.eventName,
          venueName: session.venueName,
          startsAt: session.startsAt,
        },
        stats: {
          totalTickets: stats?.totalTickets || 0,
          soldTickets: stats?.soldTickets || 0,
          checkedInTickets: stats?.checkedInTickets || 0,
          pendingCheckin: (stats?.soldTickets || 0) - (stats?.checkedInTickets || 0),
          checkinPercentage:
            stats?.soldTickets > 0
              ? Math.round((stats.checkedInTickets / stats.soldTickets) * 100)
              : 0,
        },
        recentCheckins: recentCheckins.map((c: any) => ({
          ticketCode: c.ticketCode,
          holderName: c.holderName || "Sin nombre",
          checkedInAt: c.checkedInAt,
          operatorName: c.operatorName,
        })),
      });
    },
  });

  // DELETE /api/checkin/:ticketCode - Revertir check-in (admin only)
  app.delete<{ Params: { ticketCode: string } }>("/api/checkin/:ticketCode", {
    preHandler: [requireOperator],
    handler: async (request, reply) => {
      const { ticketCode } = request.params;
      const user = (request as any).user;

      // Solo admins pueden revertir check-in
      if (user.role !== "ADMIN") {
        return reply.status(403).send({
          success: false,
          error: "Solo administradores pueden revertir check-ins",
        });
      }

      const [ticket] = await query<RowDataPacket[]>(
        `SELECT id, ticketCode, checkedInAt FROM Ticket WHERE ticketCode = ?`,
        [ticketCode]
      );

      if (!ticket) {
        return reply.status(404).send({
          success: false,
          error: "Ticket no encontrado",
        });
      }

      if (!ticket.checkedInAt) {
        return reply.status(400).send({
          success: false,
          error: "Este ticket no tiene check-in registrado",
        });
      }

      await query(
        `UPDATE Ticket SET checkedInAt = NULL, checkedInBy = NULL, updatedAt = NOW() WHERE id = ?`,
        [ticket.id]
      );

      return reply.send({
        success: true,
        message: "Check-in revertido exitosamente",
      });
    },
  });
}
