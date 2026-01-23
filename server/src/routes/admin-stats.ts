import { FastifyInstance } from "fastify";
import { RowDataPacket } from "mysql2";
import { query } from "../lib/db";
import { requireAdmin, requireAuth, requireOperator } from "../lib/authMiddleware";

export async function adminStatsRoutes(app: FastifyInstance) {
  
  // GET /api/public/stats - Estadísticas públicas para el landing (sin autenticación)
  app.get("/api/public/stats", async (request, reply) => {
    // Total de eventos publicados con sesiones futuras
    const [eventsCount] = await query<RowDataPacket[]>(
      `SELECT COUNT(DISTINCT e.id) as total 
       FROM Event e 
       JOIN EventSession es ON es.eventId = e.id
       WHERE e.status = 'PUBLISHED' AND es.startsAt > NOW()`
    );

    // Tickets vendidos (total histórico)
    const [ticketsCount] = await query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM Ticket WHERE status IN ('SOLD', 'USED')`
    );

    // Venues activos (con eventos)
    const [venuesCount] = await query<RowDataPacket[]>(
      `SELECT COUNT(DISTINCT v.id) as total 
       FROM Venue v 
       JOIN Event e ON e.venueId = v.id
       WHERE e.status = 'PUBLISHED'`
    );

    // Tickets vendidos este mes
    const [monthlyTickets] = await query<RowDataPacket[]>(
      `SELECT COUNT(*) as total 
       FROM Ticket t
       JOIN \`Order\` o ON o.id = t.orderId
       WHERE t.status IN ('SOLD', 'USED')
         AND MONTH(o.paidAt) = MONTH(NOW()) 
         AND YEAR(o.paidAt) = YEAR(NOW())`
    );

    // Formatear números para mostrar
    const formatNumber = (num: number): string => {
      if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
      if (num >= 1000) return (num / 1000).toFixed(1) + "K";
      return num.toString();
    };

    return reply.send({
      success: true,
      stats: {
        events: {
          value: eventsCount?.total || 0,
          label: "Eventos activos",
          sub: `${monthlyTickets?.total || 0} boletos este mes`,
        },
        tickets: {
          value: formatNumber(ticketsCount?.total || 0),
          label: "Boletos emitidos",
          sub: "Tiempo real",
        },
        venues: {
          value: venuesCount?.total || 0,
          label: "Venues conectados",
          sub: "Mapas 3D",
        },
      },
    });
  });

  // GET /api/admin/stats - Estadísticas generales del dashboard
  app.get("/api/admin/stats", {
    preHandler: [requireOperator],
    handler: async (request, reply) => {
      // Total de usuarios activos
      const [usersCount] = await query<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM User WHERE status = 'ACTIVE'`
      );

      // Nuevos usuarios este mes
      const [newUsersCount] = await query<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM User 
         WHERE status = 'ACTIVE' 
         AND MONTH(created_at) = MONTH(NOW()) 
         AND YEAR(created_at) = YEAR(NOW())`
      );

      // Total de eventos activos (publicados con sesiones futuras)
      const [activeEventsCount] = await query<RowDataPacket[]>(
        `SELECT COUNT(DISTINCT e.id) as total 
         FROM Event e 
         JOIN EventSession es ON es.eventId = e.id
         WHERE e.status = 'PUBLISHED' AND es.startsAt > NOW()`
      );

      // Eventos próximos (en los próximos 30 días)
      const [upcomingEventsCount] = await query<RowDataPacket[]>(
        `SELECT COUNT(DISTINCT e.id) as total 
         FROM Event e 
         JOIN EventSession es ON es.eventId = e.id
         WHERE e.status = 'PUBLISHED' 
         AND es.startsAt > NOW() 
         AND es.startsAt <= DATE_ADD(NOW(), INTERVAL 30 DAY)`
      );

      // Total de venues
      const [venuesCount] = await query<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM Venue`
      );

      // Venues con layouts
      const [venuesWithLayoutsCount] = await query<RowDataPacket[]>(
        `SELECT COUNT(DISTINCT venueId) as total FROM VenueLayout`
      );

      // Total de tickets vendidos (todos los tiempos)
      const [totalTicketsSold] = await query<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM Ticket WHERE status IN ('SOLD', 'USED')`
      );

      // Tickets vendidos este mes
      const [ticketsThisMonth] = await query<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM Ticket t
         JOIN \`Order\` o ON o.id = t.orderId
         WHERE t.status IN ('SOLD', 'USED')
           AND MONTH(o.paidAt) = MONTH(NOW()) 
           AND YEAR(o.paidAt) = YEAR(NOW())`
      );

      // Tickets vendidos mes anterior
      const [ticketsLastMonth] = await query<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM Ticket t
         JOIN \`Order\` o ON o.id = t.orderId
         WHERE t.status IN ('SOLD', 'USED')
           AND MONTH(o.paidAt) = MONTH(DATE_SUB(NOW(), INTERVAL 1 MONTH)) 
           AND YEAR(o.paidAt) = YEAR(DATE_SUB(NOW(), INTERVAL 1 MONTH))`
      );

      // Ingresos totales
      const [totalRevenue] = await query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(total), 0) as total FROM \`Order\` WHERE status = 'PAID'`
      );

      // Ingresos este mes
      const [revenueThisMonth] = await query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(total), 0) as total FROM \`Order\` 
         WHERE status = 'PAID' 
           AND MONTH(paidAt) = MONTH(NOW()) 
           AND YEAR(paidAt) = YEAR(NOW())`
      );

      // Ingresos mes anterior
      const [revenueLastMonth] = await query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(total), 0) as total FROM \`Order\` 
         WHERE status = 'PAID' 
           AND MONTH(paidAt) = MONTH(DATE_SUB(NOW(), INTERVAL 1 MONTH)) 
           AND YEAR(paidAt) = YEAR(DATE_SUB(NOW(), INTERVAL 1 MONTH))`
      );

      // Reservaciones activas - contar tickets en estado RESERVED
      let activeReservationsCount = 0;
      try {
        const [activeReservations] = await query<RowDataPacket[]>(
          `SELECT COUNT(*) as total FROM Ticket WHERE status = 'RESERVED'`
        );
        activeReservationsCount = activeReservations?.total || 0;
      } catch (e) {
        // Table might not exist
        activeReservationsCount = 0;
      }

      // Check-ins de hoy
      const [checkinsToday] = await query<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM Ticket 
         WHERE checkedInAt IS NOT NULL AND DATE(checkedInAt) = CURDATE()`
      );

      // Órdenes pendientes
      const [pendingOrders] = await query<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM \`Order\` WHERE status = 'PENDING'`
      );

      // Calcular porcentajes de crecimiento
      const currentTickets = Number(ticketsThisMonth?.total) || 0;
      const lastTickets = Number(ticketsLastMonth?.total) || 0;
      const ticketsGrowth = lastTickets > 0 
        ? ((currentTickets - lastTickets) / lastTickets) * 100 
        : currentTickets > 0 ? 100 : 0;

      const currentRevenue = Number(revenueThisMonth?.total) || 0;
      const lastRevenue = Number(revenueLastMonth?.total) || 0;
      const revenueGrowth = lastRevenue > 0 
        ? ((currentRevenue - lastRevenue) / lastRevenue) * 100 
        : currentRevenue > 0 ? 100 : 0;

      return reply.send({
        success: true,
        // Formato plano para el dashboard
        activeEvents: activeEventsCount?.total || 0,
        upcomingEvents: upcomingEventsCount?.total || 0,
        totalVenues: venuesCount?.total || 0,
        venuesWithLayouts: venuesWithLayoutsCount?.total || 0,
        totalTicketsSold: totalTicketsSold?.total || 0,
        ticketsThisMonth: currentTickets,
        ticketsGrowth: Math.round(ticketsGrowth * 10) / 10,
        totalRevenue: Number(totalRevenue?.total) || 0,
        revenueThisMonth: currentRevenue,
        revenueGrowth: Math.round(revenueGrowth * 10) / 10,
        activeReservations: activeReservationsCount,
        totalUsers: usersCount?.total || 0,
        newUsersThisMonth: newUsersCount?.total || 0,
        checkinsToday: checkinsToday?.total || 0,
        pendingOrders: pendingOrders?.total || 0,
      });
    },
  });

  // GET /api/admin/stats/sales-chart - Datos para gráfica de ventas
  app.get("/api/admin/stats/sales-chart", {
    preHandler: [requireOperator],
    handler: async (request, reply) => {
      const { days = "30" } = request.query as { days?: string };
      const numDays = parseInt(days);

      // Ventas por día con tickets vendidos
      const dailySales = await query<RowDataPacket[]>(
        `SELECT 
          DATE(o.paidAt) as date,
          COUNT(DISTINCT o.id) as orders,
          SUM(o.total) as revenue,
          COUNT(DISTINCT o.userId) as uniqueBuyers,
          (SELECT COUNT(*) FROM Ticket t WHERE t.orderId = o.id AND t.status IN ('SOLD', 'USED')) as tickets
         FROM \`Order\` o
         WHERE o.status = 'PAID' AND o.paidAt >= DATE_SUB(NOW(), INTERVAL ? DAY)
         GROUP BY DATE(o.paidAt)
         ORDER BY date ASC`,
        [numDays]
      );

      // Para días sin ventas, generar array completo
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - numDays);
      
      const dateMap = new Map();
      dailySales.forEach((row: any) => {
        const dateStr = new Date(row.date).toISOString().split('T')[0];
        dateMap.set(dateStr, {
          date: dateStr,
          orders: row.orders || 0,
          revenue: Number(row.revenue) || 0,
          sales: row.tickets || row.orders || 0, // sales = número de tickets
          uniqueBuyers: row.uniqueBuyers || 0,
        });
      });

      // Generar todos los días del período
      const chart = [];
      for (let i = 0; i <= numDays; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        
        chart.push(dateMap.get(dateStr) || {
          date: dateStr,
          orders: 0,
          revenue: 0,
          sales: 0,
          uniqueBuyers: 0,
        });
      }

      return reply.send({
        success: true,
        chart,
      });
    },
  });

  // GET /api/admin/stats/top-events - Eventos más vendidos
  app.get("/api/admin/stats/top-events", {
    preHandler: [requireOperator],
    handler: async (request, reply) => {
      const { limit = "10" } = request.query as { limit?: string };

      const topEvents = await query<RowDataPacket[]>(
        `SELECT 
          e.id, e.name, e.thumbnailImage,
          v.name as venueName,
          COUNT(t.id) as ticketsSold,
          COALESCE(SUM(t.price), 0) as revenue,
          MIN(es.startsAt) as nextSession
         FROM Event e
         LEFT JOIN Venue v ON v.id = e.venueId
         LEFT JOIN EventSession es ON es.eventId = e.id
         LEFT JOIN Ticket t ON t.sessionId = es.id AND t.status IN ('SOLD', 'USED')
         WHERE e.status = 'PUBLISHED'
         GROUP BY e.id
         ORDER BY ticketsSold DESC, revenue DESC
         LIMIT ?`,
        [parseInt(limit)]
      );

      return reply.send({
        success: true,
        events: topEvents.map((row: any) => ({
          id: row.id,
          name: row.name,
          thumbnailImage: row.thumbnailImage,
          venue: row.venueName,
          ticketsSold: row.ticketsSold || 0,
          revenue: Number(row.revenue) || 0,
          nextSession: row.nextSession,
        })),
      });
    },
  });

  // GET /api/admin/stats/recent-orders - Órdenes recientes
  app.get("/api/admin/stats/recent-orders", {
    preHandler: [requireOperator],
    handler: async (request, reply) => {
      const { limit = "10" } = request.query as { limit?: string };

      const recentOrders = await query<RowDataPacket[]>(
        `SELECT 
          o.id, o.orderNumber, o.buyerName, o.buyerEmail, o.total, o.currency, o.status, o.paidAt, o.createdAt,
          COUNT(t.id) as ticketCount,
          (SELECT e.name FROM Ticket t2 
           JOIN EventSession es2 ON es2.id = t2.sessionId 
           JOIN Event e ON e.id = es2.eventId 
           WHERE t2.orderId = o.id LIMIT 1) as eventName
         FROM \`Order\` o
         LEFT JOIN Ticket t ON t.orderId = o.id
         WHERE o.status IN ('PAID', 'PENDING')
         GROUP BY o.id
         ORDER BY o.createdAt DESC
         LIMIT ?`,
        [parseInt(limit)]
      );

      return reply.send({
        success: true,
        orders: recentOrders.map((row: any) => ({
          id: row.id,
          orderNumber: row.orderNumber,
          buyerName: row.buyerName,
          buyerEmail: row.buyerEmail,
          total: Number(row.total),
          currency: row.currency,
          status: row.status,
          ticketCount: row.ticketCount || 0,
          eventName: row.eventName || "Sin evento",
          paidAt: row.paidAt,
          createdAt: row.createdAt,
        })),
      });
    },
  });

  // GET /api/admin/stats/events/:eventId - Estadísticas de un evento específico
  app.get<{ Params: { eventId: string } }>("/api/admin/stats/events/:eventId", {
    preHandler: [requireOperator],
    handler: async (request, reply) => {
      const { eventId } = request.params;

      // Info del evento
      const [event] = await query<RowDataPacket[]>(
        `SELECT id, name, status, thumbnailImage FROM Event WHERE id = ?`,
        [eventId]
      );

      if (!event) {
        return reply.status(404).send({
          success: false,
          error: "Evento no encontrado",
        });
      }

      // Estadísticas de tickets
      const [ticketStats] = await query<RowDataPacket[]>(
        `SELECT 
          COUNT(*) as totalTickets,
          SUM(CASE WHEN t.status = 'SOLD' THEN 1 ELSE 0 END) as soldTickets,
          SUM(CASE WHEN t.status = 'RESERVED' THEN 1 ELSE 0 END) as reservedTickets,
          SUM(CASE WHEN t.status = 'SOLD' THEN t.price ELSE 0 END) as revenue,
          SUM(CASE WHEN t.checkedInAt IS NOT NULL THEN 1 ELSE 0 END) as checkedIn
         FROM EventSession es
         LEFT JOIN Ticket t ON t.sessionId = es.id
         WHERE es.eventId = ?`,
        [eventId]
      );

      // Ventas por sesión
      const sessionStats = await query<RowDataPacket[]>(
        `SELECT 
          es.id, es.startsAt,
          COUNT(t.id) as ticketsSold,
          SUM(t.price) as revenue
         FROM EventSession es
         LEFT JOIN Ticket t ON t.sessionId = es.id AND t.status = 'SOLD'
         WHERE es.eventId = ?
         GROUP BY es.id
         ORDER BY es.startsAt`,
        [eventId]
      );

      // Ventas por tier
      const tierStats = await query<RowDataPacket[]>(
        `SELECT 
          pt.id, pt.label as name, pt.price,
          COUNT(t.id) as ticketsSold,
          SUM(t.price) as revenue
         FROM EventPriceTier pt
         LEFT JOIN Ticket t ON t.tierId = pt.id AND t.status = 'SOLD'
         WHERE pt.eventId = ?
         GROUP BY pt.id
         ORDER BY pt.price DESC`,
        [eventId]
      );

      return reply.send({
        success: true,
        event: {
          id: event.id,
          name: event.name,
          status: event.status,
          image: event.thumbnailImage,
        },
        stats: {
          totalTickets: ticketStats?.totalTickets || 0,
          soldTickets: ticketStats?.soldTickets || 0,
          reservedTickets: ticketStats?.reservedTickets || 0,
          checkedIn: ticketStats?.checkedIn || 0,
          revenue: Number(ticketStats?.revenue) || 0,
        },
        sessions: sessionStats.map((s: any) => ({
          id: s.id,
          startsAt: s.startsAt,
          ticketsSold: s.ticketsSold || 0,
          revenue: Number(s.revenue) || 0,
        })),
        tiers: tierStats.map((t: any) => ({
          id: t.id,
          name: t.name,
          price: Number(t.price),
          ticketsSold: t.ticketsSold || 0,
          revenue: Number(t.revenue) || 0,
        })),
      });
    },
  });
}
