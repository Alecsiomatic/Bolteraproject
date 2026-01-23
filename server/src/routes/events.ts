import { randomUUID } from "crypto";
import { FastifyInstance } from "fastify";
import { RowDataPacket } from "mysql2";
import { z } from "zod";
import { query, withTransaction } from "../lib/db";
import { ensureUniqueSlug, slugify } from "../utils/slug";
import { requireAuth, requireAdmin, requireOperator } from "../lib/authMiddleware";

// Helper function to check if a point is inside a polygon (ray casting algorithm)
function pointInPolygon(x: number, y: number, polygon: Array<{ x: number; y: number }>): boolean {
  if (!polygon || polygon.length < 3) return false;
  
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

type EventListRow = RowDataPacket & {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  venueId: string | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  venueName: string | null;
  venueSlug: string | null;
  sessionCount: number;
  soldTickets: number;
  showRemainingTickets: number;
  firstSession: Date | null;
};

type EventDetailRow = RowDataPacket & {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  venueId: string | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  venueName: string | null;
  venueSlug: string | null;
  showRemainingTickets: number;
};
type SessionRow = RowDataPacket & {
  id: string;
  eventId: string;
  title: string | null;
  startsAt: Date;
  endsAt: Date | null;
  status: string;
  capacity: number | null;
  createdAt: Date;
  updatedAt: Date;
  ticketCount: number;
  soldTickets: number;
};

type TicketRow = RowDataPacket & {
  id: string;
  sessionId: string;
  seatId: string | null;
  tierId: string | null;
  price: number;
  currency: string;
  status: string;
  purchasedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type PriceTierRow = RowDataPacket & {
  id: string;
  eventId: string;
  sessionId: string | null;
  zoneId: string | null;
  sectionId: string | null;
  seatType: string | null;
  label: string;
  description: string | null;
  price: number;
  fee: number;
  currency: string;
  minQuantity: number | null;
  maxQuantity: number | null;
  capacity: number | null;
  isDefault: number;
  createdAt: Date;
  updatedAt: Date;
};

const toISO = (value: Date | string | null) => (value instanceof Date ? value.toISOString() : value);
// Convert ISO string to MySQL datetime format
const toMySQLDatetime = (isoString: string | null | undefined): string | null => {
  if (!isoString) return null;
  // Convert '2026-01-10T08:00:00.000Z' to '2026-01-10 08:00:00'
  return isoString.replace('T', ' ').replace(/\.\d{3}Z$/, '');
};
const seatTypes = ["STANDARD", "VIP", "ACCESSIBLE", "COMPANION"] as const;
const eventStatuses = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
const sessionStatuses = ["SCHEDULED", "SALES_OPEN", "SOLD_OUT", "CANCELLED"] as const;

const sessionSchema = z.object({
  clientId: z.string().optional(),
  title: z.string().optional(),
  startsAt: z.string().datetime({ message: "Indica una fecha válida" }),
  endsAt: z.string().datetime().optional(),
  status: z.enum(sessionStatuses).optional(),
  capacity: z.number().int().positive().optional(),
});

const tierSchema = z.object({
  clientId: z.string().optional(),
  label: z.string().min(1),
  description: z.string().optional(),
  price: z.number().nonnegative(),
  fee: z.number().nonnegative().default(0),
  currency: z.string().default("MXN"),
  zoneId: z.string().optional(),
  sectionId: z.string().optional(),
  seatType: z.enum(seatTypes).optional(),
  sessionKeys: z.array(z.string()).optional(),
  minQuantity: z.number().int().positive().optional(),
  maxQuantity: z.number().int().positive().optional(),
  capacity: z.number().int().positive().optional(),
  isDefault: z.boolean().optional(),
});

/**
 * Deduplicate price tiers by section, keeping the most recently updated row.
 * Assumes the incoming list is sorted so the latest entries appear first.
 */
const dedupeSectionTiers = <T extends { sectionId?: string | null }>(tiers: T[]): T[] => {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const tier of tiers) {
    if (tier.sectionId) {
      if (seen.has(tier.sectionId)) {
        continue;
      }
      seen.add(tier.sectionId);
    }
    result.push(tier);
  }

  return result;
};

const eventTypes = ["seated", "general"] as const;
const serviceFeeTypes = ["percentage", "fixed"] as const;

const createEventSchema = z.object({
  name: z.string().min(3),
  slug: z.string().optional(),
  description: z.string().optional(),
  shortDescription: z.string().max(200).optional(),
  status: z.enum(eventStatuses).default("DRAFT"),
  venueId: z.string().min(1),
  layoutId: z.string().optional(), // Layout específico a usar (si no se especifica, usa el default)
  categoryId: z.string().optional(),
  createdById: z.string().optional(),
  
  // Artist and Playlist relations
  artistId: z.string().optional(), // ID del artista del evento (obligatorio en UI, opcional en API)
  playlistId: z.string().optional(), // ID de la playlist asociada al evento
  
  // Event type and service fee
  eventType: z.enum(eventTypes).default("seated"), // "seated" = con mapa de asientos, "general" = admisión general
  serviceFeeType: z.enum(serviceFeeTypes).optional(), // "percentage" o "fixed"
  serviceFeeValue: z.number().nonnegative().optional(), // valor del cargo de servicio global
  showRemainingTickets: z.boolean().optional(),
  
  // Media
  coverImage: z.string().optional(),
  thumbnailImage: z.string().optional(),
  galleryImages: z.array(z.string()).optional(),
  videoUrl: z.string().url().optional().or(z.literal("")),
  
  // Event details
  organizer: z.string().optional(),
  organizerLogo: z.string().optional(),
  artistName: z.string().optional(),
  ageRestriction: z.string().optional(),
  doorTime: z.string().optional(),
  duration: z.string().optional(),
  
  // Policies
  policies: z.array(z.object({ title: z.string(), content: z.string() })).optional(),
  terms: z.string().optional(),
  refundPolicy: z.string().optional(),
  
  // SEO
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  seoImage: z.string().optional(),
  
  // Social
  socialLinks: z.object({
    facebook: z.string().optional(),
    instagram: z.string().optional(),
    twitter: z.string().optional(),
    website: z.string().optional(),
  }).optional(),
  hashtag: z.string().optional(),
  
  // Publishing
  isFeatured: z.boolean().optional(),
  salesStartAt: z.string().datetime().optional(),
  salesEndAt: z.string().datetime().optional(),
  
  sessions: z.array(sessionSchema).min(1, "Agrega al menos una función"),
  tiers: z.array(tierSchema).min(1, "Configura al menos un precio"),
});

export async function eventRoutes(app: FastifyInstance) {
  // GET /api/events - Listar eventos con filtros avanzados
  app.get("/api/events", async (request) => {
    const { 
      search, 
      categoryId, 
      venueId, 
      status,
      dateFrom, 
      dateTo, 
      featured,
      limit = "25", 
      offset = "0",
      sortBy = "date",
      sortOrder = "asc"
    } = request.query as {
      search?: string;
      categoryId?: string;
      venueId?: string;
      status?: string;
      dateFrom?: string;
      dateTo?: string;
      featured?: string;
      limit?: string;
      offset?: string;
      sortBy?: string;
      sortOrder?: string;
    };

    let sql = `
      SELECT
        e.id,
        e.name,
        e.slug,
        e.description,
        e.shortDescription,
        e.status,
        e.venueId,
        e.categoryId,
        e.thumbnailImage,
        e.coverImage,
        e.isFeatured,
        e.showRemainingTickets,
        e.createdById,
        e.createdAt,
        e.updatedAt,
        v.name AS venueName,
        v.slug AS venueSlug,
        v.city AS venueCity,
        c.name AS categoryName,
        c.slug AS categorySlug,
        COUNT(DISTINCT s.id) AS sessionCount,
        COUNT(t.id) AS totalTickets,
        SUM(CASE WHEN t.status = 'SOLD' THEN 1 ELSE 0 END) AS soldTickets,
        MIN(s.startsAt) AS firstSession,
        MIN(CASE WHEN pt.price > 0 THEN pt.price ELSE NULL END) AS minPrice,
        MAX(pt.price) AS maxPrice
      FROM Event e
      LEFT JOIN Venue v ON v.id = e.venueId
      LEFT JOIN Category c ON c.id = e.categoryId
      LEFT JOIN EventSession s ON s.eventId = e.id
      LEFT JOIN Ticket t ON t.sessionId = s.id
      LEFT JOIN EventPriceTier pt ON pt.eventId = e.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Filtro por búsqueda de texto
    if (search) {
      sql += ` AND (e.name LIKE ? OR e.description LIKE ? OR e.artistName LIKE ? OR v.name LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Filtro por categoría
    if (categoryId) {
      sql += ` AND e.categoryId = ?`;
      params.push(categoryId);
    }

    // Filtro por venue
    if (venueId) {
      sql += ` AND e.venueId = ?`;
      params.push(venueId);
    }

    // Filtro por status
    if (status) {
      sql += ` AND e.status = ?`;
      params.push(status);
    } else {
      // Por defecto, solo mostrar eventos publicados en público
      sql += ` AND e.status = 'PUBLISHED'`;
    }

    // Filtro por fecha
    if (dateFrom) {
      sql += ` AND s.startsAt >= ?`;
      params.push(dateFrom);
    }

    if (dateTo) {
      sql += ` AND s.startsAt <= ?`;
      params.push(dateTo);
    }

    // Por defecto, solo eventos futuros (a menos que se especifique includePast o all)
    const { includePast, all } = request.query as { includePast?: string; all?: string };
    if (!dateFrom && !dateTo && includePast !== "true" && all !== "true") {
      sql += ` AND (s.startsAt >= NOW() OR s.startsAt IS NULL)`;
    }

    // Filtro por destacados
    if (featured === "true") {
      sql += ` AND e.isFeatured = true`;
    }

    sql += ` GROUP BY e.id`;

    // Ordenamiento
    const orderMap: Record<string, string> = {
      date: "firstSession",
      name: "e.name",
      created: "e.createdAt",
      price: "minPrice",
    };
    const orderField = orderMap[sortBy] || "firstSession";
    const orderDir = sortOrder === "desc" ? "DESC" : "ASC";
    sql += ` ORDER BY ${orderField} ${orderDir}`;

    // Paginación
    sql += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const events = await query<EventListRow[]>(sql, params);

    // Contar total para paginación
    let countSql = `
      SELECT COUNT(DISTINCT e.id) as total
      FROM Event e
      LEFT JOIN Venue v ON v.id = e.venueId
      LEFT JOIN EventSession s ON s.eventId = e.id
      WHERE 1=1
    `;
    const countParams: any[] = [];

    if (search) {
      countSql += ` AND (e.name LIKE ? OR e.description LIKE ? OR e.artistName LIKE ? OR v.name LIKE ?)`;
      const searchTerm = `%${search}%`;
      countParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    if (categoryId) {
      countSql += ` AND e.categoryId = ?`;
      countParams.push(categoryId);
    }
    if (venueId) {
      countSql += ` AND e.venueId = ?`;
      countParams.push(venueId);
    }
    if (status) {
      countSql += ` AND e.status = ?`;
      countParams.push(status);
    } else {
      countSql += ` AND e.status = 'PUBLISHED'`;
    }
    if (dateFrom) {
      countSql += ` AND s.startsAt >= ?`;
      countParams.push(dateFrom);
    }
    if (dateTo) {
      countSql += ` AND s.startsAt <= ?`;
      countParams.push(dateTo);
    }
    if (!dateFrom && !dateTo) {
      countSql += ` AND s.startsAt >= NOW()`;
    }
    if (featured === "true") {
      countSql += ` AND e.isFeatured = true`;
    }

    const [countResult] = await query<RowDataPacket[]>(countSql, countParams);
    const total = countResult?.total || 0;

    return {
      events: events.map((event: any) => {
        const totalTickets = Number(event.totalTickets ?? 0);
        const soldTickets = Number(event.soldTickets ?? 0);
        const sessions = Number(event.sessionCount ?? 0);

        return {
          id: event.id,
          name: event.name,
          slug: event.slug,
          shortDescription: event.shortDescription,
          status: event.status,
          thumbnailImage: event.thumbnailImage,
          coverImage: event.coverImage,
          isFeatured: event.isFeatured,
          showRemainingTickets: Boolean(event.showRemainingTickets),
          venueId: event.venueId,
          categoryId: event.categoryId,
          createdAt: toISO(event.createdAt),
          updatedAt: toISO(event.updatedAt),
          venue: event.venueId
            ? {
                id: event.venueId,
                name: event.venueName,
                slug: event.venueSlug,
                city: event.venueCity,
              }
            : null,
          category: event.categoryId
            ? {
                id: event.categoryId,
                name: event.categoryName,
                slug: event.categorySlug,
              }
            : null,
          firstSession: event.firstSession ? toISO(event.firstSession) : null,
          priceRange: {
            min: Number(event.minPrice) || 0,
            max: Number(event.maxPrice) || 0,
          },
          stats: {
            sessions,
            totalTickets,
            soldTickets,
            progress: totalTickets > 0 ? Math.round((soldTickets / totalTickets) * 100) : 0,
          },
        };
      }),
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + events.length < total,
      },
    };
  });

  app.get("/api/events/:eventId", async (request, reply) => {
    const paramsSchema = z.object({ eventId: z.string().min(1, "ID de evento inválido") });
    const { eventId } = paramsSchema.parse(request.params);

    const [event] = await query<(EventDetailRow & { layoutId?: string; eventType?: string; serviceFeeType?: string; serviceFeeValue?: number })[]>(
      `SELECT
        e.id,
        e.name,
        e.slug,
        e.description,
        e.shortDescription,
        e.status,
        e.venueId,
        e.categoryId,
        e.artistName,
        e.organizer,
        e.ageRestriction,
        e.duration,
        e.isFeatured,
        e.coverImage,
        e.thumbnailImage,
        e.videoUrl,
        e.policies,
        e.terms,
        e.refundPolicy,
        e.seoTitle,
        e.seoDescription,
        e.seoImage,
        e.socialLinks,
        e.hashtag,
        e.salesStartAt,
        e.salesEndAt,
        e.eventType,
        e.serviceFeeType,
        e.serviceFeeValue,
        e.showRemainingTickets,
        e.artistId,
        e.playlistId,
        e.createdById,
        e.createdAt,
        e.updatedAt,
        v.name AS venueName,
        v.slug AS venueSlug,
        vl.id AS layoutId,
        a.name AS artistName2,
        a.slug AS artistSlug,
        a.profileImage AS artistImage,
        p.name AS playlistName,
        p.coverImage AS playlistCover
      FROM Event e
      LEFT JOIN Venue v ON v.id = e.venueId
      LEFT JOIN VenueLayout vl ON vl.eventId = e.id
      LEFT JOIN Artist a ON a.id = e.artistId
      LEFT JOIN Playlist p ON p.id = e.playlistId
      WHERE e.id = ? OR e.slug = ?
      LIMIT 1`,
      [eventId, eventId],
    );

    if (!event) {
      return reply.code(404).send({ message: "Evento no encontrado" });
    }

    const sessions = await query<SessionRow[]>(
      `SELECT
        s.id,
        s.eventId,
        s.title,
        s.startsAt,
        s.endsAt,
        s.status,
        s.capacity,
        s.createdAt,
        s.updatedAt,
        COUNT(t.id) AS ticketCount,
        SUM(CASE WHEN t.status = 'SOLD' THEN 1 ELSE 0 END) AS soldTickets
      FROM EventSession s
      LEFT JOIN Ticket t ON t.sessionId = s.id
      WHERE s.eventId = ?
      GROUP BY s.id
      ORDER BY s.startsAt ASC`,
      [event.id],
    );

    let tickets: TicketRow[] = [];
    if (sessions.length) {
      const sessionIds = sessions.map((session) => session.id);
      tickets = await query<TicketRow[]>(
        `SELECT
          t.id,
          t.sessionId,
          t.seatId,
          t.tierId,
          t.price,
          t.currency,
          t.status,
          t.purchasedAt,
          t.createdAt,
          t.updatedAt
        FROM Ticket t
        WHERE t.sessionId IN (${sessionIds.map(() => "?").join(", ")})
        ORDER BY t.createdAt ASC`,
        sessionIds,
      );
    }

    const tiers = await query<(PriceTierRow & { zoneName?: string; zoneColor?: string; sectionId?: string; sectionName?: string })[]>(
      `SELECT
        pt.id,
        pt.eventId,
        pt.sessionId,
        pt.zoneId,
        pt.sectionId,
        pt.seatType,
        pt.label,
        pt.description,
        pt.price,
        pt.fee,
        pt.currency,
        pt.minQuantity,
        pt.maxQuantity,
        pt.capacity,
        pt.isDefault,
        pt.createdAt,
        pt.updatedAt,
        vz.name AS zoneName,
        vz.color AS zoneColor,
        ls.name AS sectionName
      FROM EventPriceTier pt
      LEFT JOIN VenueZone vz ON vz.id = pt.zoneId
      LEFT JOIN LayoutSection ls ON ls.id = pt.sectionId
      WHERE pt.eventId = ?
        AND (
          pt.zoneId IS NULL 
          OR pt.sectionId IS NOT NULL
          OR EXISTS (
            SELECT 1 FROM Seat s 
            WHERE s.zoneId = pt.zoneId 
            AND s.layoutId = (SELECT id FROM VenueLayout WHERE eventId = ? LIMIT 1)
          )
        )
      ORDER BY pt.updatedAt DESC, pt.createdAt DESC`,
      [event.id, event.id],
    );

    const dedupedTiers = dedupeSectionTiers(tiers);

    const sessionMap = sessions.map((session) => ({
      id: session.id,
      eventId: session.eventId,
      title: session.title,
      startsAt: toISO(session.startsAt),
      endsAt: toISO(session.endsAt),
      status: session.status,
      capacity: session.capacity,
      createdAt: toISO(session.createdAt),
      updatedAt: toISO(session.updatedAt),
      stats: {
        totalTickets: Number(session.ticketCount ?? 0),
        soldTickets: Number(session.soldTickets ?? 0),
      },
      tickets: tickets
        .filter((ticket) => ticket.sessionId === session.id)
        .map((ticket) => ({
          id: ticket.id,
          sessionId: ticket.sessionId,
          seatId: ticket.seatId,
          tierId: ticket.tierId,
          price: Number(ticket.price),
          currency: ticket.currency,
          status: ticket.status,
          purchasedAt: toISO(ticket.purchasedAt),
          createdAt: toISO(ticket.createdAt),
          updatedAt: toISO(ticket.updatedAt),
        })),
    }));

    // Get venue zones with seat count
    const venueZones = event.venueId
      ? await query<RowDataPacket[]>(
          `SELECT
            vz.id,
            vz.name,
            vz.color,
            vz.createdAt,
            vz.updatedAt,
            (SELECT COUNT(*) FROM Seat WHERE zoneId = vz.id) AS seatCount
          FROM VenueZone vz
          WHERE vz.venueId = ?
          ORDER BY vz.createdAt ASC`,
          [event.venueId],
        )
      : [];

    return {
      id: event.id,
      name: event.name,
      slug: event.slug,
      description: event.description,
      shortDescription: event.shortDescription ?? null,
      status: event.status,
      venueId: event.venueId,
      categoryId: event.categoryId ?? null,
      artistName: event.artistName ?? null,
      organizer: event.organizer ?? null,
      ageRestriction: event.ageRestriction ?? null,
      duration: event.duration ?? null,
      isFeatured: Boolean(event.isFeatured),
      coverImage: event.coverImage ?? null,
      thumbnailImage: event.thumbnailImage ?? null,
      videoUrl: event.videoUrl ?? null,
      policies: event.policies ? JSON.parse(event.policies) : null,
      terms: event.terms ?? null,
      refundPolicy: event.refundPolicy ?? null,
      seoTitle: event.seoTitle ?? null,
      seoDescription: event.seoDescription ?? null,
      seoImage: event.seoImage ?? null,
      socialLinks: event.socialLinks ? JSON.parse(event.socialLinks) : null,
      hashtag: event.hashtag ?? null,
      salesStartAt: event.salesStartAt ? toISO(event.salesStartAt) : null,
      salesEndAt: event.salesEndAt ? toISO(event.salesEndAt) : null,
      layoutId: event.layoutId ?? null, // Event-specific layout
      eventType: event.eventType ?? "seated", // "seated" o "general"
      serviceFeeType: event.serviceFeeType ?? null, // "percentage" o "fixed"
      serviceFeeValue: event.serviceFeeValue ? Number(event.serviceFeeValue) : null,
      showRemainingTickets: Boolean(event.showRemainingTickets),
      artistId: event.artistId ?? null,
      playlistId: event.playlistId ?? null,
      artist: event.artistId ? {
        id: event.artistId,
        name: event.artistName2,
        slug: event.artistSlug,
        profileImage: event.artistImage,
      } : null,
      playlist: event.playlistId ? {
        id: event.playlistId,
        name: event.playlistName,
        coverUrl: event.playlistCover,
      } : null,
      createdById: event.createdById,
      createdAt: toISO(event.createdAt),
      updatedAt: toISO(event.updatedAt),
      venue: event.venueId
        ? {
            id: event.venueId,
            name: event.venueName,
            slug: event.venueSlug,
            zones: venueZones.map((zone) => ({
              id: zone.id,
              name: zone.name,
              color: zone.color,
              seatCount: Number(zone.seatCount ?? 0),
              createdAt: toISO(zone.createdAt),
              updatedAt: toISO(zone.updatedAt),
            })),
          }
        : null,
      sessions: sessionMap,
      priceTiers: dedupedTiers.map((tier) => ({
        id: tier.id,
        eventId: tier.eventId,
        sessionId: tier.sessionId,
        zoneId: tier.zoneId,
        zoneName: tier.zoneName ?? null,
        zoneColor: tier.zoneColor ?? null,
        sectionId: tier.sectionId ?? null,
        sectionName: tier.sectionName ?? null,
        seatType: tier.seatType,
        label: tier.label,
        description: tier.description,
        price: Number(tier.price),
        fee: Number(tier.fee),
        currency: tier.currency,
        minQuantity: tier.minQuantity,
        maxQuantity: tier.maxQuantity,
        capacity: tier.capacity,
        isDefault: Boolean(tier.isDefault),
        createdAt: toISO(tier.createdAt),
        updatedAt: toISO(tier.updatedAt),
      })),
    };
  });

  // Crear evento - Solo OPERATOR+
  app.post("/api/events", { preHandler: [requireOperator] }, async (request, reply) => {
    const payload = createEventSchema.parse(request.body);

    const [venue] = await query<RowDataPacket[]>(`SELECT id, capacity FROM Venue WHERE id = ? LIMIT 1`, [
      payload.venueId,
    ]);
    if (!venue) {
      return reply.code(404).send({ message: "Venue no encontrado" });
    }

    // Get the layout to use: specific layoutId or template/default
    let templateLayout: RowDataPacket | undefined;
    if (payload.layoutId) {
      // Use the specific layout requested
      const [specificLayout] = await query<RowDataPacket[]>(
        `SELECT id, layoutJson, metadata FROM VenueLayout 
         WHERE id = ? AND venueId = ? LIMIT 1`,
        [payload.layoutId, payload.venueId],
      );
      if (!specificLayout) {
        return reply.code(404).send({ message: "Layout no encontrado para este venue" });
      }
      templateLayout = specificLayout;
    } else {
      // Fallback: get venue's template or default layout
      const [defaultLayout] = await query<RowDataPacket[]>(
        `SELECT id, layoutJson, metadata FROM VenueLayout 
         WHERE venueId = ? AND (isTemplate = true OR isDefault = true) 
         ORDER BY isTemplate DESC, isDefault DESC LIMIT 1`,
        [payload.venueId],
      );
      templateLayout = defaultLayout;
    }

    // Get venue zones (from template)
    const zones = await query<RowDataPacket[]>(
      `SELECT id, name, color, basePrice, capacity, metadata FROM VenueZone WHERE venueId = ?`,
      [payload.venueId],
    );
    const zoneSet = new Set(zones.map((row) => row.id as string));

    // Validate no date conflicts for this venue
    const sessionDates = payload.sessions.map(s => new Date(s.startsAt));
    for (const sessionDate of sessionDates) {
      const startOfDay = new Date(sessionDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(sessionDate);
      endOfDay.setHours(23, 59, 59, 999);

      const [conflict] = await query<RowDataPacket[]>(
        `SELECT e.id, e.name, es.startsAt 
         FROM EventSession es
         JOIN Event e ON e.id = es.eventId
         WHERE e.venueId = ? AND es.startsAt BETWEEN ? AND ? AND es.status != 'CANCELLED'
         LIMIT 1`,
        [payload.venueId, startOfDay, endOfDay],
      );

      if (conflict) {
        return reply.code(409).send({
          message: `Ya existe un evento en este venue para el ${sessionDate.toLocaleDateString()}`,
          conflictEvent: { id: conflict.id, name: conflict.name, date: conflict.startsAt },
        });
      }
    }

    try {
      const result = await withTransaction(async (connection) => {
        const eventId = randomUUID();
        const baseSlug = slugify(payload.slug ?? payload.name);
        const desiredSlug = baseSlug.length > 0 ? baseSlug : `evento-${eventId.slice(0, 6)}`;
        const uniqueSlug = await ensureUniqueSlug(connection, "Event", desiredSlug);

        // 1. Create the event with all new fields
        await connection.query(
          `INSERT INTO Event (
            id, name, slug, description, shortDescription, status, venueId, categoryId, createdById,
            coverImage, thumbnailImage, galleryImages, videoUrl,
            organizer, organizerLogo, artistName, ageRestriction, doorTime, duration,
            policies, terms, refundPolicy,
            seoTitle, seoDescription, seoImage,
            socialLinks, hashtag,
            isFeatured, salesStartAt, salesEndAt,
            eventType, serviceFeeType, serviceFeeValue, showRemainingTickets,
            artistId, playlistId,
            createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            eventId,
            payload.name,
            uniqueSlug,
            payload.description ?? null,
            payload.shortDescription ?? null,
            payload.status ?? "DRAFT",
            payload.venueId,
            payload.categoryId ?? null,
            payload.createdById ?? null,
            payload.coverImage ?? null,
            payload.thumbnailImage ?? null,
            payload.galleryImages ? JSON.stringify(payload.galleryImages) : null,
            payload.videoUrl || null,
            payload.organizer ?? null,
            payload.organizerLogo ?? null,
            payload.artistName ?? null,
            payload.ageRestriction ?? null,
            payload.doorTime ?? null,
            payload.duration ?? null,
            payload.policies ? JSON.stringify(payload.policies) : null,
            payload.terms ?? null,
            payload.refundPolicy ?? null,
            payload.seoTitle ?? null,
            payload.seoDescription ?? null,
            payload.seoImage ?? null,
            payload.socialLinks ? JSON.stringify(payload.socialLinks) : null,
            payload.hashtag ?? null,
            payload.isFeatured ?? false,
            toMySQLDatetime(payload.salesStartAt),
            toMySQLDatetime(payload.salesEndAt),
            payload.eventType ?? "seated",
            payload.serviceFeeType ?? null,
            payload.serviceFeeValue ?? null,
            payload.showRemainingTickets ?? false,
            payload.artistId ?? null,
            payload.playlistId ?? null,
          ],
        );

        // 2. Copy layout for this event (if template exists)
        let eventLayoutId: string | null = null;
        if (templateLayout) {
          eventLayoutId = randomUUID();
          await connection.query(
            `INSERT INTO VenueLayout (id, venueId, eventId, name, version, layoutJson, metadata, isDefault, isTemplate, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, 1, ?, ?, false, false, NOW(), NOW())`,
            [
              eventLayoutId,
              payload.venueId,
              eventId,
              `Layout - ${payload.name}`,
              templateLayout.layoutJson,
              templateLayout.metadata,
            ],
          );

          // 3. Copy zones to LayoutZone for this event
          for (const zone of zones) {
            const layoutZoneId = randomUUID();
            await connection.query(
              `INSERT INTO LayoutZone (id, layoutId, sourceZoneId, name, color, basePrice, capacity, metadata, createdAt, updatedAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
              [layoutZoneId, eventLayoutId, zone.id, zone.name, zone.color, zone.basePrice, zone.capacity, zone.metadata],
            );
          }

          // 4. Copy seats from template layout to event layout
          const templateSeats = await query<RowDataPacket[]>(
            `SELECT id, zoneId, tableId, label, rowLabel, columnNumber, status, metadata 
             FROM Seat WHERE layoutId = ?`,
            [templateLayout.id],
          );

          for (const seat of templateSeats) {
            const newSeatId = randomUUID();
            await connection.query(
              `INSERT INTO Seat (id, venueId, layoutId, zoneId, tableId, label, rowLabel, columnNumber, status, metadata, createdAt, updatedAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE', ?, NOW(), NOW())`,
              [newSeatId, payload.venueId, eventLayoutId, seat.zoneId, seat.tableId, seat.label, seat.rowLabel, seat.columnNumber, seat.metadata],
            );
          }
        }

        // 5. Create sessions
        const sessionMap = new Map<string, string>();
        const sessionSummaries: Array<{
          id: string;
          title: string | undefined;
          startsAt: string;
        }> = [];

        for (const session of payload.sessions) {
          const sessionId = randomUUID();
          const startsAt = new Date(session.startsAt);
          const endsAt = session.endsAt ? new Date(session.endsAt) : null;

          await connection.query(
            `INSERT INTO EventSession
            (id, eventId, title, startsAt, endsAt, status, capacity, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [
              sessionId,
              eventId,
              session.title ?? null,
              startsAt,
              endsAt,
              session.status ?? "SCHEDULED",
              session.capacity ?? venue.capacity ?? null,
            ],
          );

          if (session.clientId) {
            sessionMap.set(session.clientId, sessionId);
          }
          sessionSummaries.push({ id: sessionId, title: session.title, startsAt: startsAt.toISOString() });
        }

        // 6. Create price tiers
        let tierCount = 0;
        for (const tier of payload.tiers) {
          if (tier.zoneId && !zoneSet.has(tier.zoneId)) {
            throw new Error("Zona inválida para la tarifa");
          }

          const targetSessions = tier.sessionKeys?.length
            ? tier.sessionKeys.map((key) => {
                const resolved = sessionMap.get(key);
                if (!resolved) {
                  throw new Error(`Sesión no encontrada para la tarifa: ${key}`);
                }
                return resolved;
              })
            : [null];

          for (const sessionId of targetSessions) {
            const tierId = randomUUID();
            await connection.query(
              `INSERT INTO EventPriceTier
              (id, eventId, sessionId, zoneId, sectionId, seatType, label, description, price, fee, currency, minQuantity, maxQuantity, capacity, isDefault, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
              [
                tierId,
                eventId,
                sessionId,
                tier.zoneId ?? null,
                tier.sectionId ?? null,
                tier.seatType ?? null,
                tier.label,
                tier.description ?? null,
                tier.price,
                tier.fee ?? 0,
                tier.currency ?? "MXN",
                tier.minQuantity ?? null,
                tier.maxQuantity ?? null,
                tier.capacity ?? null,
                tier.isDefault ? 1 : 0,
              ],
            );
            tierCount += 1;
          }
        }

        return {
          id: eventId,
          slug: uniqueSlug,
          status: payload.status ?? "DRAFT",
          venueId: payload.venueId,
          layoutId: eventLayoutId,
          sessionCount: sessionSummaries.length,
          tierCount,
        };
      });

      return reply.code(201).send(result);
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ message: "No se pudo crear el evento" });
    }
  });

  // ============================================
  // SESSION MANAGEMENT ENDPOINTS
  // ============================================

  const sessionCreateSchema = z.object({
    title: z.string().optional(),
    startsAt: z.string().datetime({ message: "Indica una fecha válida" }),
    endsAt: z.string().datetime().optional(),
    status: z.enum(sessionStatuses).optional().default("SCHEDULED"),
    capacity: z.number().int().positive().optional(),
  });

  const sessionUpdateSchema = sessionCreateSchema.partial();

  // GET /api/events/:eventId/sessions - List all sessions for an event
  app.get("/api/events/:eventId/sessions", async (request, reply) => {
    const paramsSchema = z.object({ eventId: z.string().min(1) });
    const { eventId } = paramsSchema.parse(request.params);

    const sessions = await query<SessionRow[]>(
      `SELECT
        s.id,
        s.eventId,
        s.title,
        s.startsAt,
        s.endsAt,
        s.status,
        s.capacity,
        s.createdAt,
        s.updatedAt,
        COUNT(t.id) AS ticketCount,
        SUM(CASE WHEN t.status = 'SOLD' THEN 1 ELSE 0 END) AS soldTickets
      FROM EventSession s
      LEFT JOIN Ticket t ON t.sessionId = s.id
      WHERE s.eventId = ?
      GROUP BY s.id
      ORDER BY s.startsAt ASC`,
      [eventId],
    );

    return sessions.map((session) => ({
      id: session.id,
      eventId: session.eventId,
      title: session.title,
      startsAt: toISO(session.startsAt),
      endsAt: toISO(session.endsAt),
      status: session.status,
      capacity: session.capacity,
      createdAt: toISO(session.createdAt),
      updatedAt: toISO(session.updatedAt),
      stats: {
        totalTickets: Number(session.ticketCount ?? 0),
        soldTickets: Number(session.soldTickets ?? 0),
      },
    }));
  });

  // POST /api/events/:eventId/sessions - Create a new session - Solo OPERATOR+
  app.post("/api/events/:eventId/sessions", { preHandler: [requireOperator] }, async (request, reply) => {
    const paramsSchema = z.object({ eventId: z.string().min(1) });
    const { eventId } = paramsSchema.parse(request.params);

    const payload = sessionCreateSchema.parse(request.body);

    // Get event and venue info
    const [event] = await query<RowDataPacket[]>(
      `SELECT e.id, e.venueId, v.capacity AS venueCapacity
       FROM Event e
       LEFT JOIN Venue v ON v.id = e.venueId
       WHERE e.id = ?
       LIMIT 1`,
      [eventId],
    );

    if (!event) {
      return reply.code(404).send({ message: "Evento no encontrado" });
    }

    // Validate no date conflicts for this venue
    const sessionDate = new Date(payload.startsAt);
    const startOfDay = new Date(sessionDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(sessionDate);
    endOfDay.setHours(23, 59, 59, 999);

    const [conflict] = await query<RowDataPacket[]>(
      `SELECT e.id, e.name, es.startsAt 
       FROM EventSession es
       JOIN Event e ON e.id = es.eventId
       WHERE e.venueId = ? AND es.startsAt BETWEEN ? AND ? AND es.status != 'CANCELLED' AND e.id != ?
       LIMIT 1`,
      [event.venueId, startOfDay, endOfDay, eventId],
    );

    if (conflict) {
      return reply.code(409).send({
        message: `Ya existe otro evento en este venue para el ${sessionDate.toLocaleDateString()}`,
        conflictEvent: { id: conflict.id, name: conflict.name, date: conflict.startsAt },
      });
    }

    try {
      const sessionId = randomUUID();
      const startsAt = new Date(payload.startsAt);
      const endsAt = payload.endsAt ? new Date(payload.endsAt) : null;

      await query(
        `INSERT INTO EventSession
        (id, eventId, title, startsAt, endsAt, status, capacity, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          sessionId,
          eventId,
          payload.title ?? null,
          startsAt,
          endsAt,
          payload.status ?? "SCHEDULED",
          payload.capacity ?? event.venueCapacity ?? null,
        ],
      );

      return reply.code(201).send({
        id: sessionId,
        eventId,
        title: payload.title ?? null,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt?.toISOString() ?? null,
        status: payload.status ?? "SCHEDULED",
        capacity: payload.capacity ?? event.venueCapacity ?? null,
        message: "Sesión creada exitosamente",
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ message: "No se pudo crear la sesión" });
    }
  });

  // PUT /api/events/:eventId/sessions/:sessionId - Update a session
  app.put("/api/events/:eventId/sessions/:sessionId", async (request, reply) => {
    const paramsSchema = z.object({
      eventId: z.string().min(1),
      sessionId: z.string().min(1),
    });
    const { eventId, sessionId } = paramsSchema.parse(request.params);

    const payload = sessionUpdateSchema.parse(request.body);

    // Verify session exists and belongs to event
    const [session] = await query<RowDataPacket[]>(
      `SELECT id, eventId FROM EventSession WHERE id = ? AND eventId = ? LIMIT 1`,
      [sessionId, eventId],
    );

    if (!session) {
      return reply.code(404).send({ message: "Sesión no encontrada" });
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];

    if (payload.title !== undefined) {
      updates.push("title = ?");
      values.push(payload.title);
    }
    if (payload.startsAt !== undefined) {
      updates.push("startsAt = ?");
      values.push(new Date(payload.startsAt));
    }
    if (payload.endsAt !== undefined) {
      updates.push("endsAt = ?");
      values.push(new Date(payload.endsAt));
    }
    if (payload.status !== undefined) {
      updates.push("status = ?");
      values.push(payload.status);
    }
    if (payload.capacity !== undefined) {
      updates.push("capacity = ?");
      values.push(payload.capacity);
    }

    if (updates.length === 0) {
      return reply.code(400).send({ message: "No hay campos para actualizar" });
    }

    updates.push("updatedAt = NOW()");
    values.push(sessionId);

    try {
      await query(
        `UPDATE EventSession SET ${updates.join(", ")} WHERE id = ?`,
        values,
      );

      return { message: "Sesión actualizada", sessionId };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ message: "No se pudo actualizar la sesión" });
    }
  });

  // DELETE /api/events/:eventId/sessions/:sessionId - Delete a session
  app.delete("/api/events/:eventId/sessions/:sessionId", async (request, reply) => {
    const paramsSchema = z.object({
      eventId: z.string().min(1),
      sessionId: z.string().min(1),
    });
    const { eventId, sessionId } = paramsSchema.parse(request.params);

    // Verify session exists and belongs to event
    const [session] = await query<RowDataPacket[]>(
      `SELECT id FROM EventSession WHERE id = ? AND eventId = ? LIMIT 1`,
      [sessionId, eventId],
    );

    if (!session) {
      return reply.code(404).send({ message: "Sesión no encontrada" });
    }

    // Check if there are sold tickets for this session
    const [soldTickets] = await query<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM Ticket WHERE sessionId = ? AND status = 'SOLD'`,
      [sessionId],
    );

    if (Number(soldTickets.count) > 0) {
      return reply.code(409).send({
        message: "No se puede eliminar una sesión con boletos vendidos",
        soldCount: Number(soldTickets.count),
      });
    }

    try {
      // Delete associated tickets (non-sold) first
      await query(`DELETE FROM Ticket WHERE sessionId = ?`, [sessionId]);
      // Delete the session
      await query(`DELETE FROM EventSession WHERE id = ?`, [sessionId]);

      return { message: "Sesión eliminada", sessionId };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ message: "No se pudo eliminar la sesión" });
    }
  });

  // PUT /api/events/:eventId/price-tiers - Update price tiers for an event
  // PUT /api/events/:eventId/price-tiers - Solo OPERATOR+
  app.put("/api/events/:eventId/price-tiers", { preHandler: [requireOperator] }, async (request, reply) => {
    const paramsSchema = z.object({ eventId: z.string().min(1, "ID de evento inválido") });
    const { eventId } = paramsSchema.parse(request.params);

    const bodySchema = z.object({
      tiers: z.array(z.object({
        zoneId: z.string().optional(),
        sectionId: z.string().optional(),
        seatType: z.string().optional(),
        label: z.string().min(1),
        price: z.number().nonnegative(),
        fee: z.number().nonnegative().optional(),
        currency: z.string().optional(),
      })).min(1, "Agrega al menos una tarifa"),
    });

    const payload = bodySchema.parse(request.body);

    // Verify event exists
    const [event] = await query<RowDataPacket[]>(
      `SELECT id FROM Event WHERE id = ? LIMIT 1`,
      [eventId],
    );

    if (!event) {
      return reply.code(404).send({ message: "Evento no encontrado" });
    }

    try {
      await withTransaction(async (connection) => {
        // Delete existing price tiers for this event
        await connection.query(
          `DELETE FROM EventPriceTier WHERE eventId = ?`,
          [eventId],
        );

        // Insert new price tiers
        for (const tier of payload.tiers) {
          const tierId = randomUUID();
          await connection.query(
            `INSERT INTO EventPriceTier
            (id, eventId, sessionId, zoneId, sectionId, seatType, label, description, price, fee, currency, isDefault, createdAt, updatedAt)
            VALUES (?, ?, NULL, ?, ?, ?, ?, NULL, ?, ?, ?, 0, NOW(), NOW())`,
            [
              tierId,
              eventId,
              tier.zoneId ?? null,
              tier.sectionId ?? null,
              tier.seatType ?? null,
              tier.label,
              tier.price,
              tier.fee ?? 0,
              tier.currency ?? "MXN",
            ],
          );
        }
      });

      return { message: "Precios actualizados", count: payload.tiers.length };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ message: "No se pudieron actualizar los precios" });
    }
  });

  // ============================================
  // TICKET PURCHASE ENDPOINTS
  // ============================================

  const purchaseSchema = z.object({
    sessionId: z.string().min(1, "Sesión requerida"),
    seatIds: z.array(z.string().min(1)).min(1, "Selecciona al menos un asiento"),
    customerEmail: z.string().email().optional(),
    customerName: z.string().optional(),
  });

  // POST /api/events/:eventId/purchase - Purchase tickets
  app.post("/api/events/:eventId/purchase", async (request, reply) => {
    const paramsSchema = z.object({ eventId: z.string().min(1, "ID de evento inválido") });
    const { eventId } = paramsSchema.parse(request.params);
    const payload = purchaseSchema.parse(request.body);

    // 1. Verify event and session exist
    const [event] = await query<RowDataPacket[]>(
      `SELECT e.id, e.venueId, e.status
       FROM Event e 
       WHERE e.id = ? LIMIT 1`,
      [eventId],
    );

    if (!event) {
      return reply.code(404).send({ message: "Evento no encontrado" });
    }

    if (event.status !== "PUBLISHED") {
      return reply.code(400).send({ message: "El evento no está publicado" });
    }

    const [session] = await query<RowDataPacket[]>(
      `SELECT id, status, capacity FROM EventSession WHERE id = ? AND eventId = ? LIMIT 1`,
      [payload.sessionId, eventId],
    );

    if (!session) {
      return reply.code(404).send({ message: "Sesión no encontrada" });
    }

    if (session.status !== "SALES_OPEN" && session.status !== "SCHEDULED") {
      return reply.code(400).send({ message: "La sesión no está disponible para venta" });
    }

    // 2. Verify all seats exist in DB and are available
    const seats = await query<RowDataPacket[]>(
      `SELECT s.id, s.zoneId, s.label, s.status, s.metadata
       FROM Seat s
       WHERE s.venueId = ? AND s.id IN (?)`,
      [event.venueId, payload.seatIds],
    );

    if (seats.length !== payload.seatIds.length) {
      const foundIds = new Set(seats.map(s => s.id));
      const missing = payload.seatIds.filter(id => !foundIds.has(id));
      return reply.code(400).send({ 
        message: "Algunos asientos no existen en el venue",
        missingSeats: missing,
      });
    }

    // Check if any seat already has a ticket for this session
    const existingTickets = await query<RowDataPacket[]>(
      `SELECT seatId FROM Ticket 
       WHERE sessionId = ? AND seatId IN (?) AND status IN ('SOLD', 'RESERVED')`,
      [payload.sessionId, payload.seatIds],
    );

    if (existingTickets.length > 0) {
      const soldSeatIds = existingTickets.map(t => t.seatId);
      return reply.code(409).send({
        message: "Algunos asientos ya están vendidos",
        soldSeats: soldSeatIds,
      });
    }

    // 3. Get price tiers for the event (by sectionId, zoneId, or default)
    const zoneIds = [...new Set(seats.map(s => s.zoneId).filter(Boolean))];
    // Extract sectionIds from seat metadata
    const sectionIds = seats.map(s => {
      try {
        const metadata = s.metadata ? JSON.parse(s.metadata) : null;
        return metadata?.sectionId;
      } catch { return null; }
    }).filter(Boolean);
    
    const priceTiers = await query<RowDataPacket[]>(
      `SELECT id, zoneId, sectionId, price, fee, currency FROM EventPriceTier 
       WHERE eventId = ?
       ORDER BY isDefault DESC`,
      [eventId],
    );

    // Build price maps by sectionId and zoneId
    const priceBySection = new Map<string, { tierId: string; price: number; fee: number; currency: string }>();
    const priceByZone = new Map<string | null, { tierId: string; price: number; fee: number; currency: string }>();
    for (const tier of priceTiers) {
      if (tier.sectionId && !priceBySection.has(tier.sectionId)) {
        priceBySection.set(tier.sectionId, {
          tierId: tier.id,
          price: Number(tier.price),
          fee: Number(tier.fee),
          currency: tier.currency,
        });
      }
      if (!priceByZone.has(tier.zoneId)) {
        priceByZone.set(tier.zoneId, {
          tierId: tier.id,
          price: Number(tier.price),
          fee: Number(tier.fee),
          currency: tier.currency,
        });
      }
    }

    // Fallback tier (global/default)
    const defaultTier = priceTiers.find(t => !t.zoneId && !t.sectionId) ?? priceTiers[0];
    if (!defaultTier) {
      return reply.code(400).send({ message: "No hay precios configurados para este evento" });
    }

    try {
      const result = await withTransaction(async (connection) => {
        const orderId = randomUUID();
        let totalAmount = 0;
        const ticketIds: string[] = [];

        // Create order
        await connection.query(
          `INSERT INTO \`Order\` (id, buyerName, buyerEmail, total, status, createdAt, updatedAt)
           VALUES (?, ?, ?, 0, 'PENDING', NOW(), NOW())`,
          [orderId, payload.customerName ?? 'Guest', payload.customerEmail ?? 'guest@example.com'],
        );

        // Create tickets for each seat
        for (const seat of seats) {
          // Extract sectionId from seat metadata
          let seatSectionId: string | null = null;
          try {
            const metadata = seat.metadata ? JSON.parse(seat.metadata) : null;
            seatSectionId = metadata?.sectionId || null;
          } catch {}

          // Get pricing: prefer sectionId, then zoneId, then default
          const pricing = (seatSectionId && priceBySection.get(seatSectionId)) 
            || priceByZone.get(seat.zoneId) 
            || {
                tierId: defaultTier.id,
                price: Number(defaultTier.price),
                fee: Number(defaultTier.fee),
                currency: defaultTier.currency,
              };

          const ticketId = randomUUID();
          ticketIds.push(ticketId);
          totalAmount += pricing.price + pricing.fee;

          await connection.query(
            `INSERT INTO Ticket (id, orderId, sessionId, seatId, tierId, price, currency, status, purchasedAt, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'SOLD', NOW(), NOW(), NOW())`,
            [ticketId, orderId, payload.sessionId, seat.id, pricing.tierId, pricing.price + pricing.fee, pricing.currency],
          );

          // Update seat status
          await connection.query(
            `UPDATE Seat SET status = 'sold', updatedAt = NOW() WHERE id = ?`,
            [seat.id],
          );

          // Record status history
          await connection.query(
            `INSERT INTO SeatStatusHistory (id, seatId, toStatus, changedById, reason, createdAt)
             VALUES (?, ?, 'sold', NULL, 'ticket_purchase', NOW())`,
            [randomUUID(), seat.id],
          );
        }

        // Update order total
        await connection.query(
          `UPDATE \`Order\` SET total = ?, status = 'COMPLETED', updatedAt = NOW() WHERE id = ?`,
          [totalAmount, orderId],
        );

        return { orderId, ticketIds, totalAmount };
      });

      return {
        success: true,
        orderId: result.orderId,
        tickets: result.ticketIds.length,
        totalAmount: result.totalAmount,
        message: `${result.ticketIds.length} boleto(s) comprado(s) exitosamente`,
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ message: "No se pudo completar la compra" });
    }
  });

  // GET /api/events/:eventId/sessions/:sessionId/availability
  app.get("/api/events/:eventId/sessions/:sessionId/availability", async (request, reply) => {
    const paramsSchema = z.object({
      eventId: z.string().min(1),
      sessionId: z.string().min(1),
    });
    const { eventId, sessionId } = paramsSchema.parse(request.params);

    // Get session and event layout - support both ID and slug
    const [session] = await query<RowDataPacket[]>(
      `SELECT s.id, e.venueId, e.id as eventId, e.eventType, e.showRemainingTickets
       FROM EventSession s
       JOIN Event e ON e.id = s.eventId
       WHERE s.id = ? AND (e.id = ? OR e.slug = ?)`,
      [sessionId, eventId, eventId],
    );

    if (!session) {
      return reply.code(404).send({ message: "Sesión no encontrada" });
    }

    // For general admission events, return tier availability instead of seats
    if (session.eventType === 'general') {
      const priceTierRows = await query<PriceTierRow[]>(
        `SELECT id, label, price, fee, capacity, minQuantity, maxQuantity, description, sessionId, sectionId, zoneId, updatedAt, createdAt
         FROM EventPriceTier 
         WHERE eventId = ? AND (sessionId IS NULL OR sessionId = ?)
         ORDER BY updatedAt DESC, createdAt DESC`,
        [session.eventId, sessionId],
      );

      const labelSeen = new Set<string>();
      const generalTiers = [] as RowDataPacket[];

      for (const tier of priceTierRows) {
        if (tier.sectionId || tier.zoneId) {
          continue;
        }
        const key = `${tier.sessionId ?? "global"}|${(tier.label || "").trim().toLowerCase()}`;
        if (labelSeen.has(key)) {
          continue;
        }
        labelSeen.add(key);
        generalTiers.push(tier);
      }

      const ticketCounts = await query<RowDataPacket[]>(
        `SELECT tierId, COUNT(*) as count 
         FROM Ticket 
         WHERE sessionId = ? AND status IN ('SOLD', 'RESERVED') AND tierId IS NOT NULL
         GROUP BY tierId`,
        [sessionId],
      );

      const countMap = new Map(ticketCounts.map(t => [t.tierId, Number(t.count)]));

      const tiersWithAvailability = generalTiers.map(tier => {
        const sold = countMap.get(tier.id) || 0;
        const capacity = tier.capacity !== null && tier.capacity !== undefined ? Number(tier.capacity) : null;
        const available = capacity !== null ? Math.max(0, capacity - sold) : null;

        return {
          id: tier.id,
          label: tier.label,
          description: tier.description || null,
          price: Number(tier.price),
          fee: Number(tier.fee) || 0,
          capacity,
          minQuantity: tier.minQuantity !== null && tier.minQuantity !== undefined ? Number(tier.minQuantity) : null,
          maxQuantity: tier.maxQuantity !== null && tier.maxQuantity !== undefined ? Number(tier.maxQuantity) : null,
          sold,
          available, // null means unlimited
        };
      });

      const totalSold = tiersWithAvailability.reduce((sum, t) => sum + (t.sold || 0), 0);
      const hasUnlimitedTier = tiersWithAvailability.some(t => t.capacity === null);
      const totalCapacity = hasUnlimitedTier
        ? null
        : tiersWithAvailability.reduce((sum, t) => sum + (t.capacity ?? 0), 0);

      return {
        sessionId,
        eventType: 'general',
        showRemainingTickets: Boolean(session.showRemainingTickets),
        tiers: tiersWithAvailability,
        stats: {
          totalTiers: tiersWithAvailability.length,
          totalCapacity,
          totalSold,
        },
      };
    }

    // Get the event's layout
    const [eventLayout] = await query<RowDataPacket[]>(
      `SELECT id, layoutJson, metadata
       FROM VenueLayout
       WHERE eventId = ?
       LIMIT 1`,
      [session.eventId],
    );

    let layoutId = eventLayout?.id;
    let layoutSource = 'event';
    
    // If event doesn't have specific layout, use venue's default layout
    if (!layoutId) {
      const [venueLayout] = await query<RowDataPacket[]>(
        `SELECT id FROM VenueLayout WHERE venueId = ? AND isDefault = 1 LIMIT 1`,
        [session.venueId],
      );
      layoutId = venueLayout?.id;
      layoutSource = 'venue-default';
    }
    
    request.log.info({ eventId: session.eventId, venueId: session.venueId, layoutId, layoutSource }, 'Availability - Layout resolution');

    if (!layoutId) {
      return reply.code(404).send({ message: "No se encontró layout para este evento" });
    }

    // Get all seats with their ticket status for this session
    const seats = await query<RowDataPacket[]>(
      `SELECT 
        s.id, s.zoneId, s.label, s.rowLabel, s.columnNumber, s.status as baseStatus, s.metadata,
        t.id as ticketId, t.status as ticketStatus
       FROM Seat s
       LEFT JOIN Ticket t ON t.seatId = s.id AND t.sessionId = ? AND t.status IN ('SOLD', 'RESERVED')
       WHERE s.layoutId = ?
       ORDER BY s.rowLabel, s.columnNumber`,
      [sessionId, layoutId],
    );
    
    request.log.info({ layoutId, totalSeatsFound: seats.length }, 'Availability - Seats query result');

    // Get zones for colors
    const zones = await query<RowDataPacket[]>(
      `SELECT id, name, color FROM VenueZone WHERE id IN (SELECT DISTINCT zoneId FROM Seat WHERE layoutId = ? AND zoneId IS NOT NULL)`,
      [layoutId],
    );

    const zonesMap = new Map(zones.map(z => [z.id, { name: z.name, color: z.color }]));

    // Get price tiers - use actual eventId not the slug
    // Include sectionId for section-based pricing
    const priceTierRows = await query<PriceTierRow[]>(
      `SELECT id, zoneId, sectionId, label, price, fee, updatedAt, createdAt 
       FROM EventPriceTier 
       WHERE eventId = ?
       ORDER BY updatedAt DESC, createdAt DESC`,
      [session.eventId],
    );

    const priceTiers = dedupeSectionTiers(priceTierRows);

    // DEBUG: Log all tiers for this event
    request.log.debug({ eventId: session.eventId, tiers: priceTiers }, '🔍 Price tiers loaded for event');

    // Build price maps by sectionId and zoneId - store separate price and fee
    interface PriceInfo { price: number; fee: number; }
    const priceBySection = new Map<string, PriceInfo>();
    const priceByZone = new Map<string | null, PriceInfo>();
    
    for (const tier of priceTiers) {
      const priceInfo: PriceInfo = {
        price: Number(tier.price),
        fee: Number(tier.fee) || 0
      };
      
      // Section-based pricing takes precedence
      if (tier.sectionId && !priceBySection.has(tier.sectionId)) {
        priceBySection.set(tier.sectionId, priceInfo);
        request.log.debug({ 
          sectionId: tier.sectionId, 
          label: tier.label, 
          price: priceInfo.price, 
          fee: priceInfo.fee,
          total: priceInfo.price + priceInfo.fee 
        }, '💰 Section price mapped');
      }
      // Zone-based pricing as fallback
      if (tier.zoneId && !priceByZone.has(tier.zoneId)) {
        priceByZone.set(tier.zoneId, priceInfo);
      }
      // Default pricing (no zone, no section)
      if (!tier.sectionId && !tier.zoneId && !priceByZone.has(null)) {
        priceByZone.set(null, priceInfo);
      }
    }
    const defaultPriceInfo = priceByZone.get(null) ?? { price: 0, fee: 0 };

    const availability = seats.map((seat) => {
      let metadata = null;
      try {
        metadata = seat.metadata ? JSON.parse(seat.metadata) : null;
      } catch (e) {
        metadata = seat.metadata;
      }
      
      const zone = seat.zoneId ? zonesMap.get(seat.zoneId) : null;
      
      // Extract sectionId from seat metadata
      const seatSectionId = metadata?.sectionId as string | undefined;

      // Get coordinates from canvas metadata structure
      // Structure: { canvas: { position: { x, y }, size: { width, height } }, seatType }
      let x = metadata?.canvas?.position?.x ?? metadata?.x;
      let y = metadata?.canvas?.position?.y ?? metadata?.y;
      const width = metadata?.canvas?.size?.width ?? metadata?.width ?? 40;
      const height = metadata?.canvas?.size?.height ?? metadata?.height ?? 40;
      const rotation = metadata?.canvas?.position?.angle ?? metadata?.rotation ?? 0;
      
      // If still no coordinates, generate fallback based on row and column
      if (x === undefined || y === undefined) {
        const rowIndex = seat.rowLabel ? seat.rowLabel.charCodeAt(0) - 65 : 0;
        const colIndex = seat.columnNumber || 0;
        x = 100 + (colIndex * 60);
        y = 150 + (rowIndex * 70);
      }

      // Price lookup priority: sectionId > zoneId > default
      const priceInfo: PriceInfo = (seatSectionId ? priceBySection.get(seatSectionId) : undefined) 
        ?? priceByZone.get(seat.zoneId) 
        ?? defaultPriceInfo;

      // DEBUG: Log price assignment for debugging
      if (seatSectionId) {
        request.log.debug({
          seatId: seat.id,
          seatLabel: seat.label,
          sectionId: seatSectionId,
          priceInfo,
          foundInMap: priceBySection.has(seatSectionId)
        }, '🎫 Seat price assignment');
      }

      return {
        id: seat.id,
        zoneId: seat.zoneId,
        sectionId: seatSectionId, // Include sectionId in response
        zoneName: zone?.name,
        zoneColor: zone?.color,
        label: seat.label,
        rowLabel: seat.rowLabel,
        columnNumber: seat.columnNumber,
        available: !seat.ticketId,
        status: seat.ticketId ? (seat.ticketStatus === 'SOLD' ? 'sold' : 'reserved') : 'available',
        price: priceInfo.price,  // Base price only
        fee: priceInfo.fee,       // Fee separately
        // Canvas position data
        x,
        y,
        width,
        height,
        rotation,
      };
    });

    const stats = {
      total: seats.length,
      available: availability.filter(s => s.available).length,
      sold: availability.filter(s => s.status === 'sold').length,
      reserved: availability.filter(s => s.status === 'reserved').length,
    };

    // Get layout dimensions from layoutJson
    let layoutData = null;
    try {
      layoutData = eventLayout?.layoutJson ? JSON.parse(eventLayout.layoutJson) : null;
    } catch (e) {
      layoutData = null;
    }

    return { 
      sessionId, 
      seats: availability, 
      stats,
      layout: {
        id: layoutId,
        canvas: layoutData?.canvas || { width: 1200, height: 800 },
        zones: Array.from(zonesMap.entries()).map(([id, zone]) => ({ id, ...zone })),
      },
      showRemainingTickets: Boolean(session.showRemainingTickets),
    };
  });

  // GET /api/events/:eventId/layout - Get the event's layout with zones and seats
  app.get("/api/events/:eventId/layout", async (request, reply) => {
    const paramsSchema = z.object({
      eventId: z.string().min(1, "ID de evento inválido"),
    });
    const { eventId } = paramsSchema.parse(request.params);

    // Get the event
    const [event] = await query<RowDataPacket[]>(
      `SELECT e.id, e.name, e.venueId, v.name AS venueName
       FROM Event e
       LEFT JOIN Venue v ON v.id = e.venueId
       WHERE e.id = ? OR e.slug = ?
       LIMIT 1`,
      [eventId, eventId],
    );

    if (!event) {
      return reply.code(404).send({ message: "Evento no encontrado" });
    }

    // Get the event's layout
    const [layout] = await query<RowDataPacket[]>(
      `SELECT id, venueId, name, version, layoutJson, metadata, isDefault, isTemplate, publishedAt, createdAt, updatedAt
       FROM VenueLayout
       WHERE eventId = ?
       LIMIT 1`,
      [event.id],
    );

    if (!layout) {
      return reply.code(404).send({ message: "Este evento no tiene un layout asignado" });
    }

    // Get the event's zones (from LayoutZone)
    const zones = await query<RowDataPacket[]>(
      `SELECT id, layoutId, sourceZoneId, name, color, price, metadata, createdAt, updatedAt
       FROM LayoutZone
       WHERE layoutId = ?
       ORDER BY createdAt ASC`,
      [layout.id],
    );

    // Get seats for this layout
    const seats = await query<RowDataPacket[]>(
      `SELECT id, venueId, layoutId, zoneId, tableId, label, rowLabel, columnNumber, status, metadata, createdAt, updatedAt
       FROM Seat
       WHERE layoutId = ?
       ORDER BY rowLabel ASC, columnNumber ASC`,
      [layout.id],
    );

    // Get ticket information for sold/reserved seats
    const seatIds = seats.map(s => s.id);
    let soldSeatMap = new Map<string, { ticketId: string; orderId: string | null; status: string }>();

    if (seatIds.length > 0) {
      const ticketRows = await query<RowDataPacket[]>(
        `SELECT t.seatId, t.id as ticketId, t.orderId, t.status
         FROM Ticket t
         WHERE t.seatId IN (?) AND t.status IN ('SOLD', 'RESERVED')`,
        [seatIds],
      );
      for (const row of ticketRows) {
        soldSeatMap.set(row.seatId, {
          ticketId: row.ticketId,
          orderId: row.orderId,
          status: row.status,
        });
      }
    }

    return {
      eventId: event.id,
      eventName: event.name,
      venueId: event.venueId,
      venueName: event.venueName,
      layout: {
        id: layout.id,
        venueId: layout.venueId,
        name: layout.name,
        version: layout.version,
        layoutJson: layout.layoutJson ? JSON.parse(layout.layoutJson) : null,
        metadata: layout.metadata ? JSON.parse(layout.metadata) : null,
        isDefault: Boolean(layout.isDefault),
        isTemplate: Boolean(layout.isTemplate),
        publishedAt: layout.publishedAt ? toISO(layout.publishedAt) : null,
        createdAt: toISO(layout.createdAt),
        updatedAt: toISO(layout.updatedAt),
      },
      zones: zones.map((zone) => ({
        id: zone.id,
        layoutId: zone.layoutId,
        sourceZoneId: zone.sourceZoneId,
        name: zone.name,
        color: zone.color,
        price: zone.price ? Number(zone.price) : null,
        metadata: zone.metadata ? JSON.parse(zone.metadata) : null,
        createdAt: toISO(zone.createdAt),
        updatedAt: toISO(zone.updatedAt),
      })),
      seats: seats.map((seat) => {
        const parsed = seat.metadata ? JSON.parse(seat.metadata) : {};
        const ticketInfo = soldSeatMap.get(seat.id);
        return {
          id: seat.id,
          venueId: seat.venueId,
          layoutId: seat.layoutId,
          zoneId: seat.zoneId,
          tableId: seat.tableId,
          label: seat.label,
          rowLabel: seat.rowLabel,
          columnNumber: seat.columnNumber,
          seatType: parsed.seatType ?? null,
          basePrice: parsed.price ?? null,
          status: ticketInfo 
            ? (ticketInfo.status === 'SOLD' ? 'sold' : 'reserved')
            : seat.status,
          hasTicket: Boolean(ticketInfo),
          ticketInfo: ticketInfo ?? null,
          metadata: parsed,
          createdAt: toISO(seat.createdAt),
          updatedAt: toISO(seat.updatedAt),
        };
      }),
    };
  });

  // ============================================
  // EVENT UPDATE ENDPOINTS
  // ============================================

  // PUT /api/events/:eventId - Update event details
  app.put("/api/events/:eventId", async (request, reply) => {
    const paramsSchema = z.object({ eventId: z.string().min(1) });
    const { eventId } = paramsSchema.parse(request.params);

    const updateSchema = z.object({
      name: z.string().min(1).optional(),
      description: z.string().nullable().optional(),
      shortDescription: z.string().nullable().optional(),
      status: z.enum(eventStatuses).optional(),
      isFeatured: z.boolean().optional(),
      categoryId: z.string().nullable().optional(),
      venueId: z.string().optional(),
      layoutId: z.string().nullable().optional(), // Cambiar el layout del evento
      thumbnailImage: z.string().nullable().optional(),
      coverImage: z.string().nullable().optional(),
      eventType: z.enum(eventTypes).optional(), // "seated" o "general"
      serviceFeeType: z.enum(serviceFeeTypes).nullable().optional(), // "percentage" o "fixed"
      serviceFeeValue: z.number().nonnegative().nullable().optional(), // valor del cargo de servicio global
      showRemainingTickets: z.boolean().optional(),
      artistId: z.string().nullable().optional(), // ID del artista asociado
      playlistId: z.string().nullable().optional(), // ID de la playlist asociada
    });

    const payload = updateSchema.parse(request.body);

    // Verify event exists
    const [event] = await query<RowDataPacket[]>(
      `SELECT id FROM Event WHERE id = ? LIMIT 1`,
      [eventId],
    );

    if (!event) {
      return reply.code(404).send({ message: "Evento no encontrado" });
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];

    if (payload.name !== undefined) {
      updates.push("name = ?");
      values.push(payload.name);
      // Update slug if name changes
      updates.push("slug = ?");
      values.push(slugify(payload.name));
    }
    if (payload.description !== undefined) {
      updates.push("description = ?");
      values.push(payload.description);
    }
    if (payload.shortDescription !== undefined) {
      updates.push("shortDescription = ?");
      values.push(payload.shortDescription);
    }
    if (payload.status !== undefined) {
      updates.push("status = ?");
      values.push(payload.status);
    }
    if (payload.isFeatured !== undefined) {
      updates.push("isFeatured = ?");
      values.push(payload.isFeatured);
    }
    if (payload.categoryId !== undefined) {
      updates.push("categoryId = ?");
      values.push(payload.categoryId);
    }
    if (payload.venueId !== undefined) {
      updates.push("venueId = ?");
      values.push(payload.venueId);
    }
    if (payload.thumbnailImage !== undefined) {
      updates.push("thumbnailImage = ?");
      values.push(payload.thumbnailImage);
    }
    if (payload.coverImage !== undefined) {
      updates.push("coverImage = ?");
      values.push(payload.coverImage);
    }
    if (payload.eventType !== undefined) {
      updates.push("eventType = ?");
      values.push(payload.eventType);
    }
    if (payload.serviceFeeType !== undefined) {
      updates.push("serviceFeeType = ?");
      values.push(payload.serviceFeeType);
    }
    if (payload.serviceFeeValue !== undefined) {
      updates.push("serviceFeeValue = ?");
      values.push(payload.serviceFeeValue);
    }
    if (payload.showRemainingTickets !== undefined) {
      updates.push("showRemainingTickets = ?");
      values.push(payload.showRemainingTickets);
    }
    if (payload.artistId !== undefined) {
      updates.push("artistId = ?");
      values.push(payload.artistId);
    }
    if (payload.playlistId !== undefined) {
      updates.push("playlistId = ?");
      values.push(payload.playlistId);
    }

    if (updates.length === 0) {
      return reply.code(400).send({ message: "No hay campos para actualizar" });
    }

    updates.push("updatedAt = NOW()");
    values.push(eventId);

    try {
      await query(
        `UPDATE Event SET ${updates.join(", ")} WHERE id = ?`,
        values,
      );

      if (payload.eventType === "general") {
        await query(
          `DELETE FROM EventPriceTier WHERE eventId = ? AND (sectionId IS NOT NULL OR zoneId IS NOT NULL)`,
          [eventId],
        );
      }

      // Si se cambió el layoutId, actualizar el VenueLayout asociado al evento
      if (payload.layoutId !== undefined) {
        // Primero desasociar cualquier layout existente del evento
        await query(
          `UPDATE VenueLayout SET eventId = NULL WHERE eventId = ?`,
          [eventId],
        );
        
        // Si se especifica un nuevo layoutId, asociarlo al evento
        if (payload.layoutId) {
          // Verificar que el layout existe y pertenece al venue del evento
          const [targetLayout] = await query<RowDataPacket[]>(
            `SELECT vl.id, vl.venueId, e.venueId as eventVenueId 
             FROM VenueLayout vl, Event e 
             WHERE vl.id = ? AND e.id = ? AND vl.venueId = e.venueId`,
            [payload.layoutId, eventId],
          );
          
          if (targetLayout) {
            await query(
              `UPDATE VenueLayout SET eventId = ? WHERE id = ?`,
              [eventId, payload.layoutId],
            );
          }
        }
      }

      return { message: "Evento actualizado", eventId };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ message: "No se pudo actualizar el evento" });
    }
  });

  // DELETE /api/events/:eventId - Delete an event and all related data
  app.delete("/api/events/:eventId", { preHandler: [requireOperator] }, async (request, reply) => {
    const paramsSchema = z.object({ eventId: z.string().min(1) });
    const { eventId } = paramsSchema.parse(request.params);

    // Verify event exists
    const [event] = await query<RowDataPacket[]>(
      `SELECT id, name FROM Event WHERE id = ? LIMIT 1`,
      [eventId],
    );

    if (!event) {
      return reply.code(404).send({ message: "Evento no encontrado" });
    }

    try {
      await withTransaction(async (connection) => {
        // 1. Delete all tickets for this event's sessions
        await connection.query(
          `DELETE t FROM Ticket t 
           INNER JOIN EventSession es ON t.sessionId = es.id 
           WHERE es.eventId = ?`,
          [eventId]
        );

        // 2. Delete all sessions
        await connection.query(
          `DELETE FROM EventSession WHERE eventId = ?`,
          [eventId]
        );

        // 3. Delete all price tiers
        await connection.query(
          `DELETE FROM EventPriceTier WHERE eventId = ?`,
          [eventId]
        );

        // 4. Delete the event itself
        await connection.query(
          `DELETE FROM Event WHERE id = ?`,
          [eventId]
        );
      });

      request.log.info({ eventId, eventName: event.name }, "Event deleted successfully");
      return { message: "Evento eliminado correctamente", eventId };
    } catch (error) {
      request.log.error(error, "Failed to delete event");
      return reply.code(500).send({ message: "No se pudo eliminar el evento" });
    }
  });

  // ============================================
  // INDIVIDUAL PRICE TIER ENDPOINTS
  // ============================================

  // POST /api/events/:eventId/tiers - Create a new price tier
  app.post("/api/events/:eventId/tiers", async (request, reply) => {
    const paramsSchema = z.object({ eventId: z.string().min(1) });
    const { eventId } = paramsSchema.parse(request.params);

    const tierSchema = z.object({
      label: z.string().min(1),
      description: z.string().nullable().optional(),
      price: z.number().nonnegative(),
      fee: z.number().nonnegative().optional(),
      currency: z.string().optional(),
      zoneId: z.string().nullable().optional(),
      sectionId: z.string().nullable().optional(),
      sessionId: z.string().nullable().optional(),
      minQuantity: z.number().int().nonnegative().nullable().optional(),
      maxQuantity: z.number().int().nonnegative().nullable().optional(),
      capacity: z.number().int().nonnegative().nullable().optional(),
      isDefault: z.boolean().optional(),
    });

    const payload = tierSchema.parse(request.body);

    // Verify event exists
    const [event] = await query<RowDataPacket[]>(
      `SELECT id FROM Event WHERE id = ? LIMIT 1`,
      [eventId],
    );

    if (!event) {
      return reply.code(404).send({ message: "Evento no encontrado" });
    }

    try {
      const tierId = randomUUID();
      await query(
        `INSERT INTO EventPriceTier
        (id, eventId, sessionId, zoneId, sectionId, seatType, label, description, price, fee, currency, minQuantity, maxQuantity, capacity, isDefault, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          tierId,
          eventId,
          payload.sessionId ?? null,
          payload.zoneId ?? null,
          payload.sectionId ?? null,
          payload.label,
          payload.description ?? null,
          payload.price,
          payload.fee ?? 0,
          payload.currency ?? "MXN",
          payload.minQuantity ?? null,
          payload.maxQuantity ?? null,
          payload.capacity ?? null,
          payload.isDefault ? 1 : 0,
        ],
      );

      return reply.code(201).send({
        id: tierId,
        eventId,
        ...payload,
        message: "Precio creado",
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ message: "No se pudo crear el precio" });
    }
  });

  // PUT /api/events/:eventId/tiers/:tierId - Update a price tier
  app.put("/api/events/:eventId/tiers/:tierId", async (request, reply) => {
    const paramsSchema = z.object({
      eventId: z.string().min(1),
      tierId: z.string().min(1),
    });
    const { eventId, tierId } = paramsSchema.parse(request.params);

    const tierSchema = z.object({
      label: z.string().min(1).optional(),
      description: z.string().nullable().optional(),
      price: z.number().nonnegative().optional(),
      fee: z.number().nonnegative().optional(),
      currency: z.string().optional(),
      zoneId: z.string().nullable().optional(),
      sectionId: z.string().nullable().optional(),
      sessionId: z.string().nullable().optional(),
      minQuantity: z.number().int().nonnegative().nullable().optional(),
      maxQuantity: z.number().int().nonnegative().nullable().optional(),
      capacity: z.number().int().nonnegative().nullable().optional(),
      isDefault: z.boolean().optional(),
    });

    const payload = tierSchema.parse(request.body);

    // Verify tier exists
    const [tier] = await query<RowDataPacket[]>(
      `SELECT id FROM EventPriceTier WHERE id = ? AND eventId = ? LIMIT 1`,
      [tierId, eventId],
    );

    if (!tier) {
      return reply.code(404).send({ message: "Precio no encontrado" });
    }

    // Build update
    const updates: string[] = [];
    const values: any[] = [];

    if (payload.label !== undefined) {
      updates.push("label = ?");
      values.push(payload.label);
    }
    if (payload.description !== undefined) {
      updates.push("description = ?");
      values.push(payload.description);
    }
    if (payload.price !== undefined) {
      updates.push("price = ?");
      values.push(payload.price);
    }
    if (payload.fee !== undefined) {
      updates.push("fee = ?");
      values.push(payload.fee);
    }
    if (payload.currency !== undefined) {
      updates.push("currency = ?");
      values.push(payload.currency);
    }
    if (payload.zoneId !== undefined) {
      updates.push("zoneId = ?");
      values.push(payload.zoneId);
    }
    if (payload.sectionId !== undefined) {
      updates.push("sectionId = ?");
      values.push(payload.sectionId);
    }
    if (payload.sessionId !== undefined) {
      updates.push("sessionId = ?");
      values.push(payload.sessionId);
    }
    if (payload.minQuantity !== undefined) {
      updates.push("minQuantity = ?");
      values.push(payload.minQuantity);
    }
    if (payload.maxQuantity !== undefined) {
      updates.push("maxQuantity = ?");
      values.push(payload.maxQuantity);
    }
    if (payload.capacity !== undefined) {
      updates.push("capacity = ?");
      values.push(payload.capacity);
    }
    if (payload.isDefault !== undefined) {
      updates.push("isDefault = ?");
      values.push(payload.isDefault ? 1 : 0);
    }

    if (updates.length === 0) {
      return reply.code(400).send({ message: "No hay campos para actualizar" });
    }

    updates.push("updatedAt = NOW()");
    values.push(tierId);

    try {
      await query(
        `UPDATE EventPriceTier SET ${updates.join(", ")} WHERE id = ?`,
        values,
      );

      return { message: "Precio actualizado", tierId };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ message: "No se pudo actualizar el precio" });
    }
  });

  // DELETE /api/events/:eventId/tiers/:tierId - Delete a price tier
  app.delete("/api/events/:eventId/tiers/:tierId", async (request, reply) => {
    const paramsSchema = z.object({
      eventId: z.string().min(1),
      tierId: z.string().min(1),
    });
    const { eventId, tierId } = paramsSchema.parse(request.params);

    // Verify tier exists
    const [tier] = await query<RowDataPacket[]>(
      `SELECT id FROM EventPriceTier WHERE id = ? AND eventId = ? LIMIT 1`,
      [tierId, eventId],
    );

    if (!tier) {
      return reply.code(404).send({ message: "Precio no encontrado" });
    }

    // Check if there are sold tickets with this tier
    const [soldTickets] = await query<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM Ticket WHERE tierId = ? AND status = 'SOLD'`,
      [tierId],
    );

    if (Number(soldTickets.count) > 0) {
      return reply.code(409).send({
        message: "No se puede eliminar un precio con boletos vendidos",
        soldCount: Number(soldTickets.count),
      });
    }

    try {
      await query(`DELETE FROM EventPriceTier WHERE id = ?`, [tierId]);
      return { message: "Precio eliminado", tierId };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ message: "No se pudo eliminar el precio" });
    }
  });

  // ============================================
  // GET /api/events/:eventId/sessions/:sessionId/sections - Get hierarchical sections for purchase
  // ============================================
  app.get("/api/events/:eventId/sessions/:sessionId/sections", async (request, reply) => {
    const paramsSchema = z.object({
      eventId: z.string().min(1),
      sessionId: z.string().min(1),
    });
    const { eventId, sessionId } = paramsSchema.parse(request.params);

    // Get session and event info
    const [session] = await query<RowDataPacket[]>(
      `SELECT s.id, e.id as eventId, e.venueId
       FROM EventSession s
       JOIN Event e ON e.id = s.eventId
       WHERE s.id = ? AND (e.id = ? OR e.slug = ?)`,
      [sessionId, eventId, eventId],
    );

    if (!session) {
      return reply.code(404).send({ message: "Sesión no encontrada" });
    }

    // Get event layout
    const [eventLayout] = await query<RowDataPacket[]>(
      `SELECT id, name, layoutType, layoutJson, metadata
       FROM VenueLayout
       WHERE eventId = ?
       LIMIT 1`,
      [session.eventId],
    );

    // If no event layout, get venue default
    let layoutId = eventLayout?.id;
    let layoutType = eventLayout?.layoutType || "flat";
    let layoutJson = eventLayout?.layoutJson;
    
    if (!layoutId) {
      const [venueLayout] = await query<RowDataPacket[]>(
        `SELECT id, name, layoutType, layoutJson, metadata FROM VenueLayout WHERE venueId = ? AND isDefault = 1 LIMIT 1`,
        [session.venueId],
      );
      if (venueLayout) {
        layoutId = venueLayout.id;
        layoutType = venueLayout.layoutType || "flat";
        layoutJson = venueLayout.layoutJson;
      }
    }

    if (!layoutId) {
      return reply.code(404).send({ message: "No se encontró layout para este evento" });
    }

    // Parse layoutJson to check for embedded sections
    let layoutData: any = null;
    try {
      layoutData = layoutJson ? JSON.parse(layoutJson) : null;
    } catch (e) {
      // Invalid JSON
    }

    // Check if layoutJson has sections (even if layoutType is "flat")
    const embeddedSections = layoutData?.sections || [];
    const hasEmbeddedSections = embeddedSections.length > 0;

    // If it's a flat layout with no embedded sections, return simple response
    if (layoutType === "flat" && !hasEmbeddedSections) {
      return { 
        sessionId,
        layoutId,
        layoutType: "flat",
        sections: [],
        message: "Layout plano sin secciones",
      };
    }

    // If we have embedded sections in layoutJson, use those instead of LayoutSection table
    if (hasEmbeddedSections) {
      // Get price tiers for the event
      const priceTierRows = await query<PriceTierRow[]>(
        `SELECT id, zoneId, sectionId, label, price, fee, updatedAt, createdAt
         FROM EventPriceTier 
         WHERE eventId = ?
         ORDER BY updatedAt DESC, createdAt DESC`,
        [session.eventId],
      );
      const priceTiers = dedupeSectionTiers(priceTierRows);
      const priceByZone = new Map<string | null, { price: number; fee: number }>();
      const priceBySection = new Map<string | null, { price: number; fee: number }>();
      for (const tier of priceTiers) {
        if (tier.sectionId) {
          priceBySection.set(tier.sectionId, { 
            price: Number(tier.price), 
            fee: Number(tier.fee) 
          });
        }
        if (tier.zoneId) {
          priceByZone.set(tier.zoneId, { 
            price: Number(tier.price), 
            fee: Number(tier.fee) 
          });
        }
        if (!tier.sectionId && !tier.zoneId) {
          priceByZone.set(null, { 
            price: Number(tier.price), 
            fee: Number(tier.fee) 
          });
        }
      }
      const defaultPrice = priceByZone.get(null) ?? { price: 0, fee: 0 };

      // Get all seats for this layout to compute stats per section
      const allSeats = await query<RowDataPacket[]>(
        `SELECT s.id, s.zoneId, s.label, s.metadata,
                t.id as ticketId, t.status as ticketStatus
         FROM Seat s
         LEFT JOIN Ticket t ON t.seatId = s.id AND t.sessionId = ? AND t.status IN ('SOLD', 'RESERVED')
         WHERE s.layoutId = ?`,
        [sessionId, layoutId],
      );

      // Get seat position from metadata
      function getSeatPosition(seat: any): { x: number; y: number } | null {
        try {
          const metadata = seat.metadata ? JSON.parse(seat.metadata) : null;
          const x = metadata?.canvas?.position?.x ?? metadata?.x;
          const y = metadata?.canvas?.position?.y ?? metadata?.y;
          if (x !== undefined && y !== undefined) {
            return { x, y };
          }
        } catch (e) {
          // Invalid metadata
        }
        return null;
      }

      // Map embedded sections to response format with accurate stats
      const sectionsWithStats = embeddedSections.map((section: any) => {
        const sectionZoneId = section.zoneId || null;
        const sectionId = section.id;
        // Prefer price by sectionId, then by zoneId, then default
        const sectionPrice = priceBySection.get(sectionId) 
          || (sectionZoneId ? priceByZone.get(sectionZoneId) : null) 
          || defaultPrice;
        const sectionPolygon = section.polygonPoints || section.points || [];

        // Count seats that belong to this section
        const sectionStats = { total: 0, available: 0, sold: 0, reserved: 0 };
        
        for (const seat of allSeats) {
          let belongsToSection = false;
          const pos = getSeatPosition(seat);
          
          // Check sectionId in metadata first (most reliable)
          let seatSectionId: string | undefined;
          try {
            const metadata = seat.metadata ? JSON.parse(seat.metadata) : null;
            seatSectionId = metadata?.sectionId;
          } catch (e) {}
          
          if (seatSectionId === sectionId) {
            belongsToSection = true;
          }
          // Check by zoneId
          else if (sectionZoneId && seat.zoneId === sectionZoneId) {
            belongsToSection = true;
          }
          // Check by position in polygon
          else if (sectionPolygon.length >= 3 && pos) {
            if (pointInPolygon(pos.x, pos.y, sectionPolygon)) {
              belongsToSection = true;
            }
          }

          if (belongsToSection) {
            sectionStats.total++;
            if (!seat.ticketId) {
              sectionStats.available++;
            } else if (seat.ticketStatus === 'SOLD') {
              sectionStats.sold++;
            } else if (seat.ticketStatus === 'RESERVED') {
              sectionStats.reserved++;
            }
          }
        }

        return {
          id: section.id,
          name: section.name,
          description: section.description || "",
          color: section.color || "#3B82F6",
          polygonPoints: sectionPolygon,
          labelPosition: section.labelPosition || null,
          displayOrder: section.displayOrder || 0,
          hoverColor: section.hoverColor || `${section.color || "#3B82F6"}90`,
          selectedColor: section.selectedColor || `${section.color || "#3B82F6"}B0`,
          thumbnailUrl: section.thumbnailUrl || null,
          zone: sectionZoneId ? {
            id: sectionZoneId,
            name: section.zoneName || section.name,
            color: section.color,
          } : null,
          pricing: {
            price: sectionPrice.price,
            fee: sectionPrice.fee,
            total: sectionPrice.price + sectionPrice.fee,
          },
          stats: sectionStats,
          childLayoutId: null, // No child layouts for embedded sections
          metadata: section.metadata || {},
        };
      });

      // Get canvas dimensions
      const canvas = layoutData?.canvas 
        ? { width: layoutData.canvas.width || 1200, height: layoutData.canvas.height || 800 }
        : { width: 1200, height: 800 };

      return {
        sessionId,
        layoutId,
        layoutType: "sections", // Override to indicate we have sections
        canvas,
        sections: sectionsWithStats,
        stats: {
          totalSections: sectionsWithStats.length,
          totalSeats: allSeats.length,
          availableSeats: allSeats.filter((s: any) => !s.ticketId).length,
        },
      };
    }

    // Get sections for this parent layout
    const sections = await query<RowDataPacket[]>(
      `SELECT 
        ls.id, ls.name, ls.description, ls.color, ls.polygonPoints, ls.labelPosition,
        ls.capacity, ls.displayOrder, ls.isActive, ls.hoverColor, ls.selectedColor,
        ls.thumbnailUrl, ls.zoneId, ls.metadata,
        lz.name as zoneName, lz.color as zoneColor, lz.basePrice
       FROM LayoutSection ls
       LEFT JOIN LayoutZone lz ON ls.zoneId = lz.id
       WHERE ls.parentLayoutId = ? AND ls.isActive = 1
       ORDER BY ls.displayOrder, ls.name`,
      [layoutId],
    );

    // Get price tiers for each zone and section
    const priceTierRows = await query<PriceTierRow[]>(
      `SELECT id, zoneId, sectionId, label, price, fee, updatedAt, createdAt 
       FROM EventPriceTier 
       WHERE eventId = ?
       ORDER BY updatedAt DESC, createdAt DESC`,
      [session.eventId],
    );
    const priceTiers = dedupeSectionTiers(priceTierRows);
    const priceByZone = new Map<string | null, { price: number; fee: number }>();
    const priceBySection = new Map<string | null, { price: number; fee: number }>();
    for (const tier of priceTiers) {
      if (tier.sectionId) {
        priceBySection.set(tier.sectionId, { 
          price: Number(tier.price), 
          fee: Number(tier.fee) 
        });
      }
      if (tier.zoneId) {
        priceByZone.set(tier.zoneId, { 
          price: Number(tier.price), 
          fee: Number(tier.fee) 
        });
      }
      if (!tier.sectionId && !tier.zoneId) {
        priceByZone.set(null, { 
          price: Number(tier.price), 
          fee: Number(tier.fee) 
        });
      }
    }
    const defaultPrice = priceByZone.get(null) ?? { price: 0, fee: 0 };

    // Get availability stats for each section's child layout
    const sectionsWithStats = await Promise.all(
      sections.map(async (section) => {
        // Get child layout for this section
        const [childLayout] = await query<RowDataPacket[]>(
          `SELECT id FROM VenueLayout WHERE sectionId = ? LIMIT 1`,
          [section.id],
        );

        let stats = { total: 0, available: 0, sold: 0, reserved: 0 };

        if (childLayout) {
          // Get seat stats from child layout
          const [seatStats] = await query<RowDataPacket[]>(
            `SELECT 
              COUNT(*) as total,
              SUM(CASE WHEN t.id IS NULL THEN 1 ELSE 0 END) as available,
              SUM(CASE WHEN t.status = 'SOLD' THEN 1 ELSE 0 END) as sold,
              SUM(CASE WHEN t.status = 'RESERVED' THEN 1 ELSE 0 END) as reserved
             FROM Seat s
             LEFT JOIN Ticket t ON t.seatId = s.id AND t.sessionId = ? AND t.status IN ('SOLD', 'RESERVED')
             WHERE s.layoutId = ?`,
            [sessionId, childLayout.id],
          );

          if (seatStats) {
            stats = {
              total: Number(seatStats.total) || 0,
              available: Number(seatStats.available) || 0,
              sold: Number(seatStats.sold) || 0,
              reserved: Number(seatStats.reserved) || 0,
            };
          }
        }

        // Parse JSON fields safely
        let polygonPoints = [];
        let labelPosition = null;
        let metadata = {};
        
        try {
          polygonPoints = section.polygonPoints ? JSON.parse(section.polygonPoints) : [];
          labelPosition = section.labelPosition ? JSON.parse(section.labelPosition) : null;
          metadata = section.metadata ? JSON.parse(section.metadata) : {};
        } catch (e) {
          // Keep defaults
        }

        // Get price for this section (prefer sectionId, then zoneId, then default)
        const sectionPrice = priceBySection.get(section.id) 
          || (section.zoneId ? priceByZone.get(section.zoneId) : null)
          || defaultPrice;

        return {
          id: section.id,
          name: section.name,
          description: section.description,
          color: section.color || section.zoneColor || "#3B82F6",
          polygonPoints,
          labelPosition,
          displayOrder: section.displayOrder,
          hoverColor: section.hoverColor || "#60A5FA",
          selectedColor: section.selectedColor || "#2563EB",
          thumbnailUrl: section.thumbnailUrl,
          zone: section.zoneId ? {
            id: section.zoneId,
            name: section.zoneName,
            color: section.zoneColor,
          } : null,
          pricing: {
            price: sectionPrice.price,
            fee: sectionPrice.fee,
            total: sectionPrice.price + sectionPrice.fee,
          },
          stats,
          childLayoutId: childLayout?.id || null,
          metadata,
        };
      })
    );

    // Get layout canvas dimensions
    let canvas = { width: 1200, height: 800 };
    try {
      const layoutData = eventLayout?.layoutJson ? JSON.parse(eventLayout.layoutJson) : null;
      if (layoutData?.canvas) {
        canvas = layoutData.canvas;
      }
    } catch (e) {
      // Use defaults
    }

    return {
      sessionId,
      layoutId,
      layoutType: "parent",
      canvas,
      sections: sectionsWithStats,
      stats: {
        totalSections: sectionsWithStats.length,
        totalSeats: sectionsWithStats.reduce((sum, s) => sum + s.stats.total, 0),
        availableSeats: sectionsWithStats.reduce((sum, s) => sum + s.stats.available, 0),
        soldSeats: sectionsWithStats.reduce((sum, s) => sum + s.stats.sold, 0),
      },
    };
  });

  // ============================================
  // GET /api/events/:eventId/sessions/:sessionId/sections/:sectionId - Get section detail with seats
  // ============================================
  app.get("/api/events/:eventId/sessions/:sessionId/sections/:sectionId", async (request, reply) => {
    const paramsSchema = z.object({
      eventId: z.string().min(1),
      sessionId: z.string().min(1),
      sectionId: z.string().min(1),
    });
    const { eventId, sessionId, sectionId } = paramsSchema.parse(request.params);

    // Get session info AND the event's layout
    const [session] = await query<RowDataPacket[]>(
      `SELECT s.id, e.id as eventId, e.venueId, vl.id as eventLayoutId
       FROM EventSession s
       JOIN Event e ON e.id = s.eventId
       LEFT JOIN VenueLayout vl ON vl.eventId = e.id
       WHERE s.id = ? AND (e.id = ? OR e.slug = ?)`,
      [sessionId, eventId, eventId],
    );

    if (!session) {
      return reply.code(404).send({ message: "Sesión no encontrada" });
    }

    // Get the layout to use (event-specific or venue default)
    let eventLayoutId = session.eventLayoutId;
    if (!eventLayoutId) {
      const [defaultLayout] = await query<RowDataPacket[]>(
        `SELECT id FROM VenueLayout WHERE venueId = ? AND isDefault = 1 LIMIT 1`,
        [session.venueId],
      );
      eventLayoutId = defaultLayout?.id;
    }

    // First try to get section from LayoutSection table
    // IMPORTANT: Verify section belongs to the event's layout
    const [dbSection] = await query<RowDataPacket[]>(
      `SELECT 
        ls.*, lz.name as zoneName, lz.color as zoneColor, lz.basePrice
       FROM LayoutSection ls
       LEFT JOIN LayoutZone lz ON ls.zoneId = lz.id
       WHERE ls.id = ? AND ls.parentLayoutId = ?`,
      [sectionId, eventLayoutId],
    );

    // If found in DB, use section data from LayoutSection table
    if (dbSection) {
      // Check if there's a child layout for this section (traditional hierarchical approach)
      const [childLayout] = await query<RowDataPacket[]>(
        `SELECT id, name, layoutJson, metadata FROM VenueLayout WHERE sectionId = ? LIMIT 1`,
        [sectionId],
      );

      // Determine which layout to use for seats: childLayout (if exists) or main layout
      const seatsLayoutId = childLayout?.id || eventLayoutId;
      
      // Parse section polygon from DB
      let polygonPoints: Array<{ x: number; y: number }> = [];
      let labelPosition = null;
      try {
        polygonPoints = dbSection.polygonPoints ? JSON.parse(dbSection.polygonPoints) : [];
        labelPosition = dbSection.labelPosition ? JSON.parse(dbSection.labelPosition) : null;
      } catch (e) {}

      request.log.info({
        sectionId,
        sectionName: dbSection.name,
        hasChildLayout: !!childLayout,
        seatsLayoutId,
        polygonPoints: polygonPoints.length,
        zoneId: dbSection.zoneId,
      }, 'Section detail - DB section found');

      // Get all seats from the determined layout
      const allSeats = await query<RowDataPacket[]>(
        `SELECT 
          s.id, s.zoneId, s.label, s.rowLabel, s.columnNumber, s.status as baseStatus, s.metadata,
          t.id as ticketId, t.status as ticketStatus
         FROM Seat s
         LEFT JOIN Ticket t ON t.seatId = s.id AND t.sessionId = ? AND t.status IN ('SOLD', 'RESERVED')
         WHERE s.layoutId = ?
         ORDER BY s.rowLabel, s.columnNumber`,
        [sessionId, seatsLayoutId],
      );

      // If using childLayout, all seats belong to this section
      // If using main layout, we need to filter by sectionId, zoneId, or polygon containment
      let filteredSeats = allSeats;
      
      if (!childLayout) {
        // Filter seats from main layout that belong to this section
        filteredSeats = allSeats.filter((seat) => {
          let metadata: any = null;
          try {
            metadata = seat.metadata ? JSON.parse(seat.metadata) : null;
          } catch (e) {}

          // Priority 1: Match by sectionId in metadata
          if (metadata?.sectionId === sectionId) {
            return true;
          }

          // Priority 2: Match by zoneId
          if (dbSection.zoneId && seat.zoneId === dbSection.zoneId) {
            return true;
          }

          // Priority 3: Check if seat position is inside section polygon
          if (polygonPoints.length >= 3) {
            const seatX = metadata?.canvas?.position?.x ?? metadata?.x;
            const seatY = metadata?.canvas?.position?.y ?? metadata?.y;

            if (seatX !== undefined && seatY !== undefined) {
              return pointInPolygon(seatX, seatY, polygonPoints);
            }
          }

          return false;
        });

        request.log.info({
          totalSeatsInLayout: allSeats.length,
          filteredSeats: filteredSeats.length,
          sampleLabels: filteredSeats.slice(0, 10).map(s => s.label),
        }, 'Section detail - seats filtered from main layout');
      }

      // Get price tiers - include sectionId for section-based pricing
      const priceTiers = await query<RowDataPacket[]>(
        `SELECT id, zoneId, sectionId, label, price, fee FROM EventPriceTier WHERE eventId = ?`,
        [session.eventId],
      );
      const priceBySection = new Map<string, number>();
      const priceByZone = new Map<string | null, number>();
      for (const tier of priceTiers) {
        if (tier.sectionId) {
          priceBySection.set(tier.sectionId, Number(tier.price) + Number(tier.fee));
        }
        if (tier.zoneId && !priceByZone.has(tier.zoneId)) {
          priceByZone.set(tier.zoneId, Number(tier.price) + Number(tier.fee));
        }
        if (!tier.sectionId && !tier.zoneId && !priceByZone.has(null)) {
          priceByZone.set(null, Number(tier.price) + Number(tier.fee));
        }
      }
      const defaultPrice = priceByZone.get(null) ?? 0;
      
      // Get the section's price (for this specific section)
      const sectionPrice = priceBySection.get(sectionId) 
        ?? (dbSection.zoneId ? priceByZone.get(dbSection.zoneId) : null) 
        ?? defaultPrice;

      // Get zones for colors
      const zones = await query<RowDataPacket[]>(
        `SELECT id, name, color FROM VenueZone WHERE venueId = ?`,
        [session.venueId],
      );
      const zonesMap = new Map(zones.map(z => [z.id, { name: z.name, color: z.color }]));

      // Map seats to response format
      const seatsList = filteredSeats.map((seat) => {
        let metadata = null;
        try {
          metadata = seat.metadata ? JSON.parse(seat.metadata) : null;
        } catch (e) {
          metadata = seat.metadata;
        }
        
        const zone = seat.zoneId ? zonesMap.get(seat.zoneId) : null;

        // Get coordinates
        let x = metadata?.canvas?.position?.x ?? metadata?.x;
        let y = metadata?.canvas?.position?.y ?? metadata?.y;
        const width = metadata?.canvas?.size?.width ?? metadata?.width ?? 40;
        const height = metadata?.canvas?.size?.height ?? metadata?.height ?? 40;
        const rotation = metadata?.canvas?.position?.angle ?? metadata?.rotation ?? 0;
        
        if (x === undefined || y === undefined) {
          const rowIndex = seat.rowLabel ? seat.rowLabel.charCodeAt(0) - 65 : 0;
          const colIndex = seat.columnNumber || 0;
          x = 100 + (colIndex * 60);
          y = 150 + (rowIndex * 70);
        }

        return {
          id: seat.id,
          zoneId: seat.zoneId,
          sectionId: sectionId, // Include sectionId
          zoneName: zone?.name,
          zoneColor: zone?.color || dbSection.zoneColor || dbSection.color,
          label: seat.label,
          rowLabel: seat.rowLabel,
          columnNumber: seat.columnNumber,
          available: !seat.ticketId,
          status: seat.ticketId ? (seat.ticketStatus === 'SOLD' ? 'sold' : 'reserved') : 'available',
          price: sectionPrice, // Use section-specific price
          x, y, width, height, rotation,
        };
      });

      // Get layout canvas dimensions
      let canvas = { width: 1200, height: 800 };
      try {
        const layoutSource = childLayout || await query<RowDataPacket[]>(
          `SELECT layoutJson FROM VenueLayout WHERE id = ?`, [eventLayoutId]
        ).then(r => r[0]);
        const layoutData = layoutSource?.layoutJson ? JSON.parse(layoutSource.layoutJson) : null;
        if (layoutData?.canvas) {
          canvas = { width: layoutData.canvas.width || 1200, height: layoutData.canvas.height || 800 };
        }
      } catch (e) {}

      return {
        sessionId,
        section: {
          id: dbSection.id,
          name: dbSection.name,
          description: dbSection.description,
          color: dbSection.color || dbSection.zoneColor,
          polygonPoints,
          labelPosition,
          zone: dbSection.zoneId ? {
            id: dbSection.zoneId,
            name: dbSection.zoneName,
            color: dbSection.zoneColor,
          } : null,
        },
        layout: {
          id: seatsLayoutId,
          name: childLayout?.name || "Layout principal",
          canvas,
        },
        seats: seatsList,
        stats: {
          total: seatsList.length,
          available: seatsList.filter(s => s.available).length,
          sold: seatsList.filter(s => s.status === 'sold').length,
          reserved: seatsList.filter(s => s.status === 'reserved').length,
        },
      };
    }

    // Section not in DB - check if it's an embedded section in layoutJson
    // Use the layout ID we already determined
    if (!eventLayoutId) {
      return reply.code(404).send({ message: "No se encontró el layout" });
    }

    const [layoutRecord] = await query<RowDataPacket[]>(
      `SELECT id, layoutJson FROM VenueLayout WHERE id = ?`,
      [eventLayoutId],
    );

    if (!layoutRecord) {
      return reply.code(404).send({ message: "No se encontró el layout" });
    }

    let layoutData: any = null;
    try {
      layoutData = layoutRecord.layoutJson ? JSON.parse(layoutRecord.layoutJson) : null;
    } catch (e) {
      return reply.code(500).send({ message: "Error parsing layout JSON" });
    }

    // Find the section in embedded sections
    const embeddedSection = layoutData?.sections?.find((s: any) => s.id === sectionId);
    if (!embeddedSection) {
      return reply.code(404).send({ message: "Sección no encontrada" });
    }

    // Get all seats for this layout
    const allSeats = await query<RowDataPacket[]>(
      `SELECT 
        s.id, s.zoneId, s.label, s.rowLabel, s.columnNumber, s.status as baseStatus, s.metadata,
        t.id as ticketId, t.status as ticketStatus
       FROM Seat s
       LEFT JOIN Ticket t ON t.seatId = s.id AND t.sessionId = ? AND t.status IN ('SOLD', 'RESERVED')
       WHERE s.layoutId = ?
       ORDER BY s.rowLabel, s.columnNumber`,
      [sessionId, layoutRecord.id],
    );

    // Get the section's polygon points
    const sectionPolygon = embeddedSection.polygonPoints || embeddedSection.points || [];
    const zoneId = embeddedSection.zoneId;

    // Debug logging
    request.log.info({
      sectionId,
      sectionName: embeddedSection.name,
      polygonPoints: sectionPolygon.length,
      totalSeatsInLayout: allSeats.length,
      zoneId,
    }, 'Section detail - filtering seats');

    // If polygon exists, compute its bounding box for reference
    if (sectionPolygon.length >= 3) {
      const xs = sectionPolygon.map((p: any) => p.x);
      const ys = sectionPolygon.map((p: any) => p.y);
      request.log.info({
        polygonBounds: {
          minX: Math.min(...xs),
          maxX: Math.max(...xs),
          minY: Math.min(...ys),
          maxY: Math.max(...ys),
        }
      }, 'Section polygon bounds');
    }

    // Filter seats that belong to this section
    // Priority: 1. Match by sectionId in metadata, 2. Match by zoneId, 3. Check if seat position is inside section polygon
    let seats = allSeats.filter((seat) => {
      let metadata: any = null;
      try {
        metadata = seat.metadata ? JSON.parse(seat.metadata) : null;
      } catch (e) {
        // Invalid metadata
      }

      // First check: If seat has sectionId in metadata and matches this section
      if (metadata?.sectionId === sectionId) {
        return true;
      }

      // Second check: If the section has a zoneId and the seat matches
      if (zoneId && seat.zoneId === zoneId) {
        return true;
      }

      // Third check: Check by position within polygon
      if (sectionPolygon.length >= 3) {
        const seatX = metadata?.canvas?.position?.x ?? metadata?.x;
        const seatY = metadata?.canvas?.position?.y ?? metadata?.y;

        if (seatX !== undefined && seatY !== undefined) {
          return pointInPolygon(seatX, seatY, sectionPolygon);
        }
      }

      // If section has zoneId and seat doesn't match and no polygon, exclude
      if (zoneId) {
        return false;
      }

      // Fallback: if section has no zoneId and no polygon, don't include
      return false;
    });

    // Log filtered result
    request.log.info({
      filteredSeats: seats.length,
      sampleSeatLabels: seats.slice(0, 10).map((s: any) => s.label),
    }, 'Section detail - seats after filtering');

    // Get price tiers - include sectionId for section-based pricing
    const priceTiers = await query<RowDataPacket[]>(
      `SELECT id, zoneId, sectionId, label, price, fee FROM EventPriceTier WHERE eventId = ?`,
      [session.eventId],
    );
    const priceBySection = new Map<string, number>();
    const priceByZone = new Map<string | null, number>();
    for (const tier of priceTiers) {
      if (tier.sectionId) {
        priceBySection.set(tier.sectionId, Number(tier.price) + Number(tier.fee));
      }
      if (tier.zoneId && !priceByZone.has(tier.zoneId)) {
        priceByZone.set(tier.zoneId, Number(tier.price) + Number(tier.fee));
      }
      if (!tier.sectionId && !tier.zoneId && !priceByZone.has(null)) {
        priceByZone.set(null, Number(tier.price) + Number(tier.fee));
      }
    }
    const defaultPrice = priceByZone.get(null) ?? 0;
    
    // Get the section's price (for this specific section)
    const embeddedSectionPrice = priceBySection.get(sectionId) 
      ?? (zoneId ? priceByZone.get(zoneId) : null) 
      ?? defaultPrice;

    // Get zones for colors
    const zones = await query<RowDataPacket[]>(
      `SELECT id, name, color FROM VenueZone WHERE venueId = ?`,
      [session.venueId],
    );
    const zonesMap = new Map(zones.map(z => [z.id, { name: z.name, color: z.color }]));

    // Map seats to response format
    const seatsList = seats.map((seat) => {
      let metadata = null;
      try {
        metadata = seat.metadata ? JSON.parse(seat.metadata) : null;
      } catch (e) {
        metadata = seat.metadata;
      }
      
      const zone = seat.zoneId ? zonesMap.get(seat.zoneId) : null;

      // Get coordinates
      let x = metadata?.canvas?.position?.x ?? metadata?.x;
      let y = metadata?.canvas?.position?.y ?? metadata?.y;
      const width = metadata?.canvas?.size?.width ?? metadata?.width ?? 40;
      const height = metadata?.canvas?.size?.height ?? metadata?.height ?? 40;
      const rotation = metadata?.canvas?.position?.angle ?? metadata?.rotation ?? 0;
      
      if (x === undefined || y === undefined) {
        const rowIndex = seat.rowLabel ? seat.rowLabel.charCodeAt(0) - 65 : 0;
        const colIndex = seat.columnNumber || 0;
        x = 100 + (colIndex * 60);
        y = 150 + (rowIndex * 70);
      }

      return {
        id: seat.id,
        zoneId: seat.zoneId,
        sectionId: sectionId, // Include sectionId
        zoneName: zone?.name,
        zoneColor: zone?.color || embeddedSection.color,
        label: seat.label,
        rowLabel: seat.rowLabel,
        columnNumber: seat.columnNumber,
        available: !seat.ticketId,
        status: seat.ticketId ? (seat.ticketStatus === 'SOLD' ? 'sold' : 'reserved') : 'available',
        price: embeddedSectionPrice, // Use section-specific price
        x, y, width, height, rotation,
      };
    });

    // Get canvas dimensions from layoutJson
    const canvas = layoutData?.canvas 
      ? { width: layoutData.canvas.width || 1200, height: layoutData.canvas.height || 800 }
      : { width: 1200, height: 800 };

    return {
      sessionId,
      section: {
        id: embeddedSection.id,
        name: embeddedSection.name,
        description: embeddedSection.description || "",
        color: embeddedSection.color,
        polygonPoints: embeddedSection.polygonPoints || embeddedSection.points || [],
        labelPosition: embeddedSection.labelPosition || null,
        zone: zoneId ? {
          id: zoneId,
          name: embeddedSection.name,
          color: embeddedSection.color,
        } : null,
      },
      layout: {
        id: layoutRecord.id,
        name: "Layout principal",
        canvas,
      },
      seats: seatsList,
      stats: {
        total: seatsList.length,
        available: seatsList.filter(s => s.available).length,
        sold: seatsList.filter(s => s.status === 'sold').length,
        reserved: seatsList.filter(s => s.status === 'reserved').length,
      },
    };
  });
}
