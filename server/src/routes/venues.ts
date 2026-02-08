import { randomUUID } from "crypto";
import { FastifyInstance } from "fastify";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { z } from "zod";
import { query, withTransaction } from "../lib/db";
import { ensureUniqueSlug, slugify } from "../utils/slug";
import { requireAdmin, requireOperator } from "../lib/authMiddleware";

type VenueListRow = RowDataPacket & {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  capacity: number | null;
  description: string | null;
  layoutJson: string | null;
  defaultLayoutId: string | null;
  createdAt: Date;
  updatedAt: Date;
  zoneCount: number;
  seatCount: number;
  availableSeats: number;
  blockedSeats: number;
  eventCount: number;
};

type VenueRow = RowDataPacket & {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  capacity: number | null;
  description: string | null;
  layoutJson: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ZoneRow = RowDataPacket & {
  id: string;
  venueId: string;
  name: string;
  color: string | null;
  basePrice: number | null;
  metadata: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type SeatRow = RowDataPacket & {
  id: string;
  venueId: string;
  layoutId: string | null;
  zoneId: string | null;
  tableId: string | null;
  label: string;
  rowLabel: string | null;
  columnNumber: number | null;
  status: string;
  metadata: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type VenueLayoutRow = RowDataPacket & {
  id: string;
  venueId: string;
  name: string;
  version: number;
  layoutJson: string | null;
  metadata: string | null;
  isDefault: number;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const toISO = (value: Date | string | null) => (value instanceof Date ? value.toISOString() : value);
const seatTypes = ["STANDARD", "VIP", "ACCESSIBLE", "COMPANION"] as const;

const normalizeSeatType = (value?: string | null): (typeof seatTypes)[number] | null => {
  if (!value) return null;
  switch (value.toLowerCase()) {
    case "regular":
    case "standard":
      return "STANDARD";
    case "vip":
      return "VIP";
    case "accessible":
      return "ACCESSIBLE";
    case "blocked":
    case "companion":
      return "COMPANION";
    default:
      return null;
  }
};

const normalizeSeatStatus = (value?: string | null): "AVAILABLE" | "RESERVED" | "SOLD" | "BLOCKED" => {
  if (!value) return "AVAILABLE";
  switch (value.toLowerCase()) {
    case "available":
      return "AVAILABLE";
    case "reserved":
      return "RESERVED";
    case "sold":
      return "SOLD";
    case "blocked":
      return "BLOCKED";
    case "selected":
      return "AVAILABLE";
    default:
      return "AVAILABLE";
  }
};

const parseSeatLabel = (label: string) => {
  const trimmed = label.trim();
  const match = trimmed.match(/^([A-Za-z]+)(\d+)$/);
  if (!match) {
    return { rowLabel: null, columnNumber: null };
  }
  return {
    rowLabel: match[1].toUpperCase(),
    columnNumber: Number(match[2]),
  };
};

const createVenueSchema = z.object({
  name: z.string().min(3, "El nombre es obligatorio"),
  slug: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
  capacity: z.number().int().positive().optional(),
  description: z.string().optional(),
  layout: z
    .object({
      name: z.string().min(3, "El layout requiere un nombre"),
      version: z.number().int().positive().default(1),
      json: z.record(z.any()).optional(),
      metadata: z.record(z.any()).optional(),
      isDefault: z.boolean().optional(),
    })
    .optional(),
  zones: z
    .array(
      z.object({
        clientId: z.string().optional(),
        name: z.string().min(1),
        color: z.string().optional(),
        basePrice: z.number().nonnegative().optional(),
        metadata: z.record(z.any()).optional(),
      }),
    )
    .optional()
    .default([]),
  seats: z
    .array(
      z.object({
        label: z.string().min(1),
        rowLabel: z.string().optional(),
        columnNumber: z.number().int().nonnegative().optional(),
        zoneId: z.string().optional(),
        zoneKey: z.string().optional(),
        seatType: z.enum(seatTypes).optional(),
        basePrice: z.number().nonnegative().optional(),
        status: z.enum(["AVAILABLE", "RESERVED", "SOLD", "BLOCKED"]).optional(),
        metadata: z.record(z.any()).optional(),
      }),
    )
    .optional()
    .default([]),
});

const layoutZoneSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  color: z.string().optional(),
  price: z.number().nonnegative().optional(),
  capacity: z.number().int().nonnegative().optional(),
  type: z.string().optional(),
  visible: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
}).transform((zone, ctx) => ({
  ...zone,
  id: zone.id || `zone-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  name: zone.name || `Zona ${ctx.path[1] !== undefined ? (ctx.path[1] as number) + 1 : 1}`,
}));

const layoutSeatSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  name: z.string().optional(),
  rowLabel: z.string().optional(),
  columnNumber: z.number().int().nonnegative().optional(),
  zoneId: z.string().nullable().optional(), // Aceptar null y undefined
  sectionId: z.string().nullable().optional(), // Section this seat belongs to
  seatType: z.string().optional(),
  status: z.string().optional(),
  price: z.number().nonnegative().optional(),
  tableId: z.string().nullable().optional(),
  position: z
    .object({
      x: z.number(),
      y: z.number(),
      angle: z.number().optional(),
    })
    .optional(),
  size: z
    .object({
      width: z.number(),
      height: z.number(),
    })
    .optional(),
  metadata: z.record(z.any()).optional(),
});

const layoutTableSchema = z.object({
  id: z.string().min(1),
  shape: z.enum(["circle", "rectangle", "square"]).default("circle"),
  centerX: z.number(),
  centerY: z.number(),
  rotation: z.number().default(0),
  seatCount: z.number().int().positive().default(4),
  zoneId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const saveVenueLayoutSchema = z.object({
  layoutId: z.string().min(1, "El layout es obligatorio"),
  layoutJson: z.record(z.any()),
  metadata: z.record(z.any()).optional(),
  zones: z.array(layoutZoneSchema).optional(),
  seats: z.array(layoutSeatSchema).optional(),
  tables: z.array(layoutTableSchema).optional(),
});

type LayoutZonePayload = z.infer<typeof layoutZoneSchema>;
type LayoutSeatPayload = z.infer<typeof layoutSeatSchema>;
type LayoutTablePayload = z.infer<typeof layoutTableSchema>;

const buildZoneMetadata = (zone: LayoutZonePayload) => {
  const metadata: Record<string, unknown> = { ...(zone.metadata ?? {}) };
  const canvasMeta: Record<string, unknown> = {};

  if (zone.type) canvasMeta.type = zone.type;
  if (typeof zone.capacity === "number") canvasMeta.capacity = zone.capacity;
  if (typeof zone.visible === "boolean") canvasMeta.visible = zone.visible;

  if (Object.keys(canvasMeta).length > 0) {
    metadata.canvas = canvasMeta;
  }

  return metadata;
};

const buildSeatMetadata = (seat: LayoutSeatPayload) => {
  const metadata: Record<string, unknown> = { ...(seat.metadata ?? {}) };
  const canvasMeta: Record<string, unknown> = {};

  if (seat.position) canvasMeta.position = seat.position;
  if (seat.size) canvasMeta.size = seat.size;
  if (seat.name ?? seat.label) canvasMeta.label = seat.name ?? seat.label;

  if (Object.keys(canvasMeta).length > 0) {
    metadata.canvas = canvasMeta;
  }

  const normalizedSeatType = normalizeSeatType(seat.seatType);
  if (normalizedSeatType) {
    metadata.seatType = normalizedSeatType;
  } else if (seat.seatType) {
    metadata.seatType = seat.seatType;
  }

  if (typeof seat.price === "number") {
    metadata.price = seat.price;
  }

  if (seat.tableId) {
    metadata.tableId = seat.tableId;
  }

  // IMPORTANTE: Guardar sectionId en metadata para poder filtrar por sección
  if (seat.sectionId) {
    metadata.sectionId = seat.sectionId;
  }

  return metadata;
};

type ParsedSeatMetadata = {
  data: Record<string, unknown> | null;
  seatType: string | null;
  basePrice: number | null;
};

const parseSeatMetadata = (metadata: string | null): ParsedSeatMetadata => {
  if (!metadata) {
    return { data: null, seatType: null, basePrice: null };
  }

  try {
    const parsed = JSON.parse(metadata) as Record<string, unknown>;
    const seatType = typeof parsed.seatType === "string" ? parsed.seatType : null;
    const basePrice = typeof parsed.price === "number" ? Number(parsed.price) : null;
    return { data: parsed, seatType, basePrice };
  } catch {
    return { data: null, seatType: null, basePrice: null };
  }
};

export async function venueRoutes(app: FastifyInstance) {
  app.get("/api/venues", async () => {
    // Get basic venue info
    const venues = await query<VenueListRow[]>(
      `SELECT
        v.id,
        v.name,
        v.slug,
        v.address,
        v.city,
        v.state,
        v.country,
        v.postalCode,
        v.capacity,
        v.description,
        v.layoutJson,
        v.createdAt,
        v.updatedAt,
        (SELECT id FROM VenueLayout WHERE venueId = v.id ORDER BY 
          CASE WHEN layoutJson IS NOT NULL AND layoutJson != '{}' AND layoutJson != '' THEN 0 ELSE 1 END,
          isDefault DESC, createdAt DESC LIMIT 1) AS defaultLayoutId,
        (SELECT COUNT(*) FROM VenueZone WHERE venueId = v.id) AS zoneCount,
        (SELECT COUNT(*) FROM Event WHERE venueId = v.id) AS eventCount
      FROM Venue v
      ORDER BY v.createdAt DESC`,
    );

    // For each venue, calculate seat stats from the best layout
    const venuesWithStats = await Promise.all(venues.map(async (venue) => {
      let seatCount = 0;
      let availableSeats = 0;
      let blockedSeats = 0;

      if (venue.defaultLayoutId) {
        // Get seats from the default layout
        const seatStats = await query<RowDataPacket[]>(
          `SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'AVAILABLE' THEN 1 ELSE 0 END) as available,
            SUM(CASE WHEN status = 'BLOCKED' THEN 1 ELSE 0 END) as blocked
          FROM Seat WHERE layoutId = ?`,
          [venue.defaultLayoutId],
        );
        
        if (seatStats[0]) {
          seatCount = Number(seatStats[0].total ?? 0);
          availableSeats = Number(seatStats[0].available ?? 0);
          blockedSeats = Number(seatStats[0].blocked ?? 0);
        }

        // If no seats in DB, try to count from layoutJson
        if (seatCount === 0) {
          const [layoutRow] = await query<RowDataPacket[]>(
            `SELECT layoutJson FROM VenueLayout WHERE id = ?`,
            [venue.defaultLayoutId],
          );
          if (layoutRow?.layoutJson) {
            try {
              const layoutData = typeof layoutRow.layoutJson === 'string' 
                ? JSON.parse(layoutRow.layoutJson) 
                : layoutRow.layoutJson;
              const objects = layoutData?.canvas?.objects ?? [];
              // Count circles as seats (common pattern in canvas)
              seatCount = objects.filter((o: any) => o.type === 'Circle' || o._customType === 'seat').length;
              availableSeats = seatCount; // Assume all available if not in DB
            } catch {
              // Ignore JSON parse errors
            }
          }
        }
      }

      return {
        id: venue.id,
        name: venue.name,
        slug: venue.slug,
        address: venue.address,
        city: venue.city,
        state: venue.state,
        country: venue.country,
        postalCode: venue.postalCode,
        capacity: venue.capacity,
        description: venue.description,
        layoutJson: venue.layoutJson ? JSON.parse(venue.layoutJson) : null,
        defaultLayoutId: venue.defaultLayoutId ?? null,
        createdAt: toISO(venue.createdAt),
        updatedAt: toISO(venue.updatedAt),
        stats: {
          zones: Number(venue.zoneCount ?? 0),
          totalSeats: seatCount,
          available: availableSeats,
          blocked: blockedSeats,
          events: Number(venue.eventCount ?? 0),
        },
      };
    }));

    return venuesWithStats;
  });

  app.get("/api/venues/:venueId", async (request, reply) => {
    const paramsSchema = z.object({ venueId: z.string().min(1, "ID de venue inválido") });
    const { venueId } = paramsSchema.parse(request.params);

    const [venue] = await query<VenueRow[]>(
      `SELECT
        v.id,
        v.name,
        v.slug,
        v.address,
        v.city,
        v.state,
        v.country,
        v.postalCode,
        v.capacity,
        v.description,
        v.layoutJson,
        v.createdAt,
        v.updatedAt,
        (SELECT id FROM VenueLayout WHERE venueId = v.id ORDER BY 
          CASE WHEN layoutJson IS NOT NULL AND layoutJson != '{}' AND layoutJson != '' THEN 0 ELSE 1 END,
          isDefault DESC, createdAt DESC LIMIT 1) AS defaultLayoutId
      FROM Venue v
      WHERE v.id = ? OR v.slug = ?
      LIMIT 1`,
      [venueId, venueId],
    );

    if (!venue) {
      return reply.code(404).send({ message: "Venue no encontrado" });
    }

    const zones = await query<(ZoneRow & { seatCount: number })[]>(
      `SELECT z.id, z.venueId, z.name, z.color, z.basePrice, z.metadata, z.createdAt, z.updatedAt,
        (SELECT COUNT(*) FROM Seat s WHERE s.zoneId = z.id) AS seatCount
      FROM VenueZone z
      WHERE z.venueId = ?
      ORDER BY z.createdAt ASC`,
      [venue.id],
    );

    // Get the default layout for this venue (prioritize layouts with content)
    const [defaultLayout] = await query<(RowDataPacket & { id: string })[]>(
      `SELECT id FROM VenueLayout WHERE venueId = ? ORDER BY 
        CASE WHEN layoutJson IS NOT NULL AND layoutJson != '{}' AND layoutJson != '' THEN 0 ELSE 1 END,
        isDefault DESC, createdAt DESC LIMIT 1`,
      [venue.id],
    );

    const seats = defaultLayout
      ? await query<SeatRow[]>(
          `SELECT id, venueId, layoutId, zoneId, label, rowLabel, columnNumber, status, metadata, createdAt, updatedAt
          FROM Seat
          WHERE layoutId = ?
          ORDER BY rowLabel ASC, columnNumber ASC`,
          [defaultLayout.id],
        )
      : [];

    return {
      id: venue.id,
      name: venue.name,
      slug: venue.slug,
      address: venue.address,
      city: venue.city,
      state: venue.state,
      country: venue.country,
      postalCode: venue.postalCode,
      capacity: venue.capacity,
      description: venue.description,
      layoutJson: venue.layoutJson ? JSON.parse(venue.layoutJson) : null,
      defaultLayoutId: (venue as VenueRow & { defaultLayoutId?: string }).defaultLayoutId ?? null,
      createdAt: toISO(venue.createdAt),
      updatedAt: toISO(venue.updatedAt),
      zones: zones.map((zone) => ({
        id: zone.id,
        venueId: zone.venueId,
        name: zone.name,
        color: zone.color,
        basePrice: zone.basePrice ? Number(zone.basePrice) : null,
        seatCount: Number(zone.seatCount ?? 0),
        metadata: zone.metadata ? JSON.parse(zone.metadata) : null,
        createdAt: toISO(zone.createdAt),
        updatedAt: toISO(zone.updatedAt),
      })),
      seats: seats.map((seat) => {
        const parsed = parseSeatMetadata(seat.metadata);
        return {
          id: seat.id,
          venueId: seat.venueId,
          zoneId: seat.zoneId,
          label: seat.label,
          rowLabel: seat.rowLabel,
          columnNumber: seat.columnNumber,
          seatType: parsed.seatType,
          basePrice: parsed.basePrice,
          status: seat.status,
          metadata: parsed.data,
          createdAt: toISO(seat.createdAt),
          updatedAt: toISO(seat.updatedAt),
        };
      }),
    };
  });

  // Crear venue - Solo ADMIN
  app.post("/api/venues", { preHandler: [requireAdmin] }, async (request, reply) => {
    const payload = createVenueSchema.parse(request.body);

    try {
      const result = await withTransaction(async (connection) => {
        const venueId = randomUUID();
        const baseSlugValue = slugify(payload.slug ?? payload.name);
        const desiredSlug = baseSlugValue.length > 0 ? baseSlugValue : `venue-${venueId.slice(0, 6)}`;
        const uniqueSlug = await ensureUniqueSlug(connection, "Venue", desiredSlug);

        const seatCount = payload.seats?.length ?? 0;
        const zoneCount = payload.zones?.length ?? 0;
        const capacity = payload.capacity ?? (seatCount > 0 ? seatCount : null);
        const layoutPayload = payload.layout ?? {
          name: `${payload.name} Layout`,
          version: 1,
          json: {},
          metadata: null,
          isDefault: true,
        };
        await connection.query(
          `INSERT INTO Venue (id, name, slug, address, city, state, country, postalCode, capacity, description, layoutJson, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            venueId,
            payload.name,
            uniqueSlug,
            payload.address ?? null,
            payload.city ?? null,
            payload.state ?? null,
            payload.country ?? null,
            payload.postalCode ?? null,
            capacity,
            payload.description ?? null,
            JSON.stringify(layoutPayload.json ?? {}),
          ],
        );

        const layoutId = randomUUID();
        await connection.query(
          `INSERT INTO VenueLayout (id, venueId, name, version, layoutJson, metadata, isDefault, publishedAt, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            layoutId,
            venueId,
            layoutPayload.name,
            layoutPayload.version ?? 1,
            JSON.stringify(layoutPayload.json ?? {}),
            layoutPayload.metadata ? JSON.stringify(layoutPayload.metadata) : null,
            layoutPayload.isDefault ? 1 : 0,
            layoutPayload.isDefault ? new Date() : null,
          ],
        );

        const zoneMap = new Map<string, string>();
        for (const zone of payload.zones ?? []) {
          const zoneId = randomUUID();
          const key = zone.clientId ?? zone.name;
          zoneMap.set(key, zoneId);

          await connection.query(
            `INSERT INTO VenueZone (id, venueId, name, color, basePrice, metadata, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [
              zoneId,
              venueId,
              zone.name,
              zone.color ?? null,
              zone.basePrice ?? null,
              zone.metadata ? JSON.stringify(zone.metadata) : null,
            ],
          );
        }

        for (const seat of payload.seats ?? []) {
          const seatId = randomUUID();
          const zoneId = seat.zoneId ?? (seat.zoneKey ? zoneMap.get(seat.zoneKey) ?? null : null);
          const seatMetadata = { ...(seat.metadata ?? {}) } as Record<string, unknown>;

          const normalizedSeatType = normalizeSeatType(seat.seatType);
          if (normalizedSeatType) {
            seatMetadata.seatType = normalizedSeatType;
          }

          if (typeof seat.basePrice === "number") {
            seatMetadata.price = seat.basePrice;
          }

          const serializedSeatMetadata = Object.keys(seatMetadata).length > 0 ? JSON.stringify(seatMetadata) : null;

          await connection.query(
            `INSERT INTO Seat (id, venueId, layoutId, zoneId, label, rowLabel, columnNumber, status, metadata, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [
              seatId,
              venueId,
              layoutId,
              zoneId,
              seat.label,
              seat.rowLabel ?? null,
              seat.columnNumber ?? null,
              seat.status ?? "AVAILABLE",
              serializedSeatMetadata,
            ],
          );
        }

        return {
          id: venueId,
          slug: uniqueSlug,
          layoutId,
          zoneCount,
          seatCount,
          capacity,
          pendingLayout: seatCount === 0,
        };
      });

      return reply.code(201).send(result);
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ message: "No se pudo crear el venue" });
    }
  });

  // PUT /api/venues/:venueId - Update venue basic info - Solo ADMIN
  app.put("/api/venues/:venueId", { preHandler: [requireAdmin] }, async (request, reply) => {
    const paramsSchema = z.object({ venueId: z.string().min(1, "ID de venue inválido") });
    const { venueId } = paramsSchema.parse(request.params);

    const updateSchema = z.object({
      name: z.string().min(1).optional(),
      slug: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      postalCode: z.string().optional(),
      capacity: z.number().int().nonnegative().optional(),
      description: z.string().optional(),
    });

    const payload = updateSchema.parse(request.body);

    // Find venue
    const [venue] = await query<VenueRow[]>(
      `SELECT id, name, slug FROM Venue WHERE id = ? OR slug = ? LIMIT 1`,
      [venueId, venueId],
    );

    if (!venue) {
      return reply.code(404).send({ message: "Venue no encontrado" });
    }

    try {
      const updates: string[] = [];
      const values: any[] = [];

      if (payload.name !== undefined) {
        updates.push("name = ?");
        values.push(payload.name);
      }

      if (payload.slug !== undefined) {
        // Check slug uniqueness
        const newSlug = slugify(payload.slug);
        const [existing] = await query<RowDataPacket[]>(
          `SELECT id FROM Venue WHERE slug = ? AND id != ? LIMIT 1`,
          [newSlug, venue.id]
        );
        if (existing) {
          return reply.code(400).send({ message: "El slug ya está en uso" });
        }
        updates.push("slug = ?");
        values.push(newSlug);
      }

      if (payload.address !== undefined) {
        updates.push("address = ?");
        values.push(payload.address || null);
      }

      if (payload.city !== undefined) {
        updates.push("city = ?");
        values.push(payload.city || null);
      }

      if (payload.state !== undefined) {
        updates.push("state = ?");
        values.push(payload.state || null);
      }

      if (payload.country !== undefined) {
        updates.push("country = ?");
        values.push(payload.country || null);
      }

      if (payload.postalCode !== undefined) {
        updates.push("postalCode = ?");
        values.push(payload.postalCode || null);
      }

      if (payload.capacity !== undefined) {
        updates.push("capacity = ?");
        values.push(payload.capacity);
      }

      if (payload.description !== undefined) {
        updates.push("description = ?");
        values.push(payload.description || null);
      }

      if (updates.length === 0) {
        return reply.code(400).send({ message: "No hay cambios para guardar" });
      }

      updates.push("updatedAt = NOW()");
      values.push(venue.id);

      await query(
        `UPDATE Venue SET ${updates.join(", ")} WHERE id = ?`,
        values
      );

      // Return updated venue
      const [updated] = await query<VenueRow[]>(
        `SELECT * FROM Venue WHERE id = ?`,
        [venue.id]
      );

      return {
        success: true,
        venue: {
          id: updated.id,
          name: updated.name,
          slug: updated.slug,
          address: updated.address,
          city: updated.city,
          state: updated.state,
          country: updated.country,
          postalCode: updated.postalCode,
          capacity: updated.capacity,
          description: updated.description,
          createdAt: toISO(updated.createdAt),
          updatedAt: toISO(updated.updatedAt),
        },
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ message: "No se pudo actualizar el venue" });
    }
  });

  // DELETE /api/venues/:venueId - Delete venue and all related data - Solo ADMIN
  app.delete("/api/venues/:venueId", { preHandler: [requireAdmin] }, async (request, reply) => {
    const paramsSchema = z.object({ venueId: z.string().min(1, "ID de venue inválido") });
    const { venueId } = paramsSchema.parse(request.params);

    const [venue] = await query<VenueRow[]>(
      `SELECT id, name FROM Venue WHERE id = ? OR slug = ? LIMIT 1`,
      [venueId, venueId],
    );

    if (!venue) {
      return reply.code(404).send({ message: "Venue no encontrado" });
    }

    // Check if venue has events with sold tickets (through sessions)
    const [eventWithTickets] = await query<RowDataPacket[]>(
      `SELECT e.id, e.name FROM Event e
       INNER JOIN EventSession es ON es.eventId = e.id
       INNER JOIN Ticket t ON t.sessionId = es.id
       WHERE e.venueId = ? AND t.status IN ('SOLD', 'RESERVED')
       LIMIT 1`,
      [venue.id],
    );

    if (eventWithTickets) {
      return reply.code(400).send({ 
        message: `No se puede eliminar: el evento "${eventWithTickets.name}" tiene tickets vendidos` 
      });
    }

    try {
      await withTransaction(async (connection) => {
        // Delete in correct order to respect foreign keys
        // 1. Delete tickets (through sessions)
        await connection.query(
          `DELETE FROM Ticket WHERE sessionId IN (
            SELECT es.id FROM EventSession es 
            INNER JOIN Event e ON es.eventId = e.id 
            WHERE e.venueId = ?
          )`, [venue.id]);
        
        // 2. Delete event sessions
        await connection.query(
          `DELETE FROM EventSession WHERE eventId IN (SELECT id FROM Event WHERE venueId = ?)`, [venue.id]);
        
        // 3. Delete event price tiers
        await connection.query(
          `DELETE FROM EventPriceTier WHERE eventId IN (SELECT id FROM Event WHERE venueId = ?)`, [venue.id]);
        
        // 4. Delete events
        await connection.query(`DELETE FROM Event WHERE venueId = ?`, [venue.id]);
        
        // 5. Delete seats
        await connection.query(`DELETE FROM Seat WHERE venueId = ?`, [venue.id]);
        
        // 6. Delete venue tables
        await connection.query(`DELETE FROM VenueTable WHERE venueId = ?`, [venue.id]);
        
        // 7. Delete venue zones
        await connection.query(`DELETE FROM VenueZone WHERE venueId = ?`, [venue.id]);
        
        // 8. Delete venue layouts
        await connection.query(`DELETE FROM VenueLayout WHERE venueId = ?`, [venue.id]);
        
        // 9. Delete venue alerts
        await connection.query(`DELETE FROM VenueAlert WHERE venueId = ?`, [venue.id]);
        
        // 10. Delete venue products
        await connection.query(`DELETE FROM VenueProduct WHERE venueId = ?`, [venue.id]);
        
        // 11. Finally delete the venue
        await connection.query(`DELETE FROM Venue WHERE id = ?`, [venue.id]);
      });

      return { success: true, message: `Venue "${venue.name}" eliminado correctamente` };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ message: "No se pudo eliminar el venue" });
    }
  });

  app.get("/api/venues/:venueId/layouts/:layoutId", async (request, reply) => {
    const paramsSchema = z.object({
      venueId: z.string().min(1, "ID de venue inválido"),
      layoutId: z.string().min(1, "ID de layout inválido"),
    });
    const { venueId, layoutId } = paramsSchema.parse(request.params);

    const [venue] = await query<VenueRow[]>(
      `SELECT id FROM Venue WHERE id = ? OR slug = ? LIMIT 1`,
      [venueId, venueId],
    );

    if (!venue) {
      return reply.code(404).send({ message: "Venue no encontrado" });
    }

    const [layout] = await query<VenueLayoutRow[]>(
      `SELECT id, venueId, name, version, layoutJson, metadata, isDefault, publishedAt, createdAt, updatedAt
      FROM VenueLayout
      WHERE id = ? AND venueId = ?
      LIMIT 1`,
      [layoutId, venue.id],
    );

    if (!layout) {
      return reply.code(404).send({ message: "Layout no encontrado para este venue" });
    }

    // Leer zonas desde LayoutZone (específicas del layout)
    const layoutZones = await query<RowDataPacket[]>(
      `SELECT id, layoutId, sourceZoneId, name, color, basePrice, capacity, metadata, createdAt, updatedAt
      FROM LayoutZone
      WHERE layoutId = ?
      ORDER BY createdAt ASC`,
      [layoutId],
    );
    
    // Fallback a VenueZone si no hay LayoutZone (layouts legacy)
    const zones = layoutZones.length > 0 
      ? layoutZones.map(z => ({
          id: z.sourceZoneId || z.id, // Usar sourceZoneId para compatibilidad con asientos
          layoutZoneId: z.id,
          venueId: venue.id,
          name: z.name,
          color: z.color,
          basePrice: z.basePrice,
          capacity: z.capacity,
          metadata: z.metadata,
          createdAt: z.createdAt,
          updatedAt: z.updatedAt,
        }))
      : await query<ZoneRow[]>(
          `SELECT id, venueId, name, color, basePrice, metadata, createdAt, updatedAt
          FROM VenueZone
          WHERE venueId = ?
          ORDER BY createdAt ASC`,
          [venue.id],
        );

    const seats = await query<SeatRow[]>(
      `SELECT id, venueId, layoutId, zoneId, tableId, label, rowLabel, columnNumber, status, metadata, createdAt, updatedAt
      FROM Seat
      WHERE layoutId = ?
      ORDER BY rowLabel ASC, columnNumber ASC`,
      [layoutId],
    );

    // Get tickets for seats to determine which are sold
    const seatIdsForTicketQuery = seats.map(s => s.id);
    let soldSeatMap = new Map<string, { ticketId: string; orderId: string | null; status: string }>();
    
    if (seatIdsForTicketQuery.length > 0) {
      const ticketRows = await query<RowDataPacket[]>(
        `SELECT t.seatId, t.id as ticketId, t.orderId, t.status
         FROM Ticket t
         WHERE t.seatId IN (?) AND t.status IN ('SOLD', 'RESERVED')`,
        [seatIdsForTicketQuery],
      );
      for (const row of ticketRows) {
        soldSeatMap.set(row.seatId, {
          ticketId: row.ticketId,
          orderId: row.orderId,
          status: row.status,
        });
      }
    }

    // Obtener secciones del layout
    const layoutSections = await query<RowDataPacket[]>(
      `SELECT id, parentLayoutId, name, description, color, zoneId, polygonPoints, labelPosition, metadata, createdAt, updatedAt
       FROM LayoutSection
       WHERE parentLayoutId = ?
       ORDER BY name ASC`,
      [layoutId],
    );

    // También extraer secciones del layoutJson si existen
    let embeddedSections: any[] = [];
    try {
      const layoutData = layout.layoutJson ? JSON.parse(layout.layoutJson) : null;
      if (layoutData?.sections && Array.isArray(layoutData.sections)) {
        embeddedSections = layoutData.sections;
      }
    } catch (e) {}

    // Combinar secciones de DB y embebidas (priorizando DB)
    const dbSectionIds = new Set(layoutSections.map(s => s.id));
    const allSections = [
      ...layoutSections.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        color: s.color,
        zoneId: s.zoneId,
        polygonPoints: s.polygonPoints ? JSON.parse(s.polygonPoints) : [],
        labelPosition: s.labelPosition ? JSON.parse(s.labelPosition) : null,
        metadata: s.metadata ? JSON.parse(s.metadata) : null,
        seatCount: seats.filter(seat => {
          const seatMeta = parseSeatMetadata(seat.metadata);
          return seatMeta.data?.sectionId === s.id;
        }).length,
        source: 'db',
      })),
      ...embeddedSections.filter(s => !dbSectionIds.has(s.id)).map(s => ({
        id: s.id,
        name: s.name,
        description: s.description || '',
        color: s.color,
        zoneId: s.zoneId,
        polygonPoints: s.polygonPoints || s.points || [],
        labelPosition: s.labelPosition,
        metadata: null,
        seatCount: seats.filter(seat => {
          const seatMeta = parseSeatMetadata(seat.metadata);
          return seatMeta.data?.sectionId === s.id;
        }).length,
        source: 'embedded',
      })),
    ];

    return {
      id: layout.id,
      venueId: layout.venueId,
      name: layout.name,
      version: layout.version,
      layoutJson: layout.layoutJson ? JSON.parse(layout.layoutJson) : null,
      metadata: layout.metadata ? JSON.parse(layout.metadata) : null,
      isDefault: Boolean(layout.isDefault),
      publishedAt: layout.publishedAt ? toISO(layout.publishedAt) : null,
      createdAt: toISO(layout.createdAt),
      updatedAt: toISO(layout.updatedAt),
      sections: allSections,
      zones: zones.map((zone: any) => ({
        id: zone.id,
        layoutZoneId: zone.layoutZoneId || null,
        venueId: zone.venueId,
        name: zone.name,
        color: zone.color,
        basePrice: zone.basePrice ? Number(zone.basePrice) : null,
        capacity: zone.capacity ?? null,
        metadata: zone.metadata ? (typeof zone.metadata === 'string' ? JSON.parse(zone.metadata) : zone.metadata) : null,
        createdAt: toISO(zone.createdAt),
        updatedAt: toISO(zone.updatedAt),
      })),
      seats: seats.map((seat) => {
        const parsed = parseSeatMetadata(seat.metadata);
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
          seatType: parsed.seatType,
          basePrice: parsed.basePrice,
          // Combine DB status with ticket status
          status: ticketInfo 
            ? (ticketInfo.status === 'SOLD' ? 'sold' : 'reserved')
            : seat.status,
          hasTicket: Boolean(ticketInfo),
          ticketInfo: ticketInfo ?? null,
          metadata: parsed.data,
          createdAt: toISO(seat.createdAt),
          updatedAt: toISO(seat.updatedAt),
        };
      }),
    };
  });

  // GET /api/venues/:venueId/layouts - List all layouts for a venue
  app.get("/api/venues/:venueId/layouts", async (request, reply) => {
    const paramsSchema = z.object({ venueId: z.string().min(1, "ID de venue inválido") });
    const { venueId } = paramsSchema.parse(request.params);

    // Check if venue exists
    const [venue] = await query<VenueRow[]>(
      `SELECT id, name FROM Venue WHERE id = ? OR slug = ? LIMIT 1`,
      [venueId, venueId],
    );

    if (!venue) {
      return reply.code(404).send({ message: "Venue no encontrado" });
    }

    // Get layouts with seat and zone counts
    const layouts = await query<(VenueLayoutRow & { seatCount: number; zoneCount: number })[]>(
      `SELECT 
         vl.id, vl.venueId, vl.eventId, vl.name, vl.version, vl.layoutJson, vl.metadata, 
         vl.isDefault, vl.isTemplate, vl.publishedAt, vl.createdAt, vl.updatedAt,
         (SELECT COUNT(*) FROM Seat s WHERE s.layoutId = vl.id) AS seatCount,
         (SELECT COUNT(*) FROM LayoutZone lz WHERE lz.layoutId = vl.id) AS zoneCount
       FROM VenueLayout vl
       WHERE vl.venueId = ?
       ORDER BY vl.isDefault DESC, vl.createdAt DESC`,
      [venue.id],
    );

    return layouts.map((layout) => {
      // Count seats from layoutJson as fallback/alternative
      let jsonSeatCount = 0;
      if (layout.layoutJson) {
        try {
          const parsed = typeof layout.layoutJson === 'string' 
            ? JSON.parse(layout.layoutJson) 
            : layout.layoutJson;
          const objects = parsed?.canvas?.objects || [];
          jsonSeatCount = objects.filter((o: any) => 
            o.type === 'Circle' || o._customType === 'seat' || o.customType === 'seat'
          ).length;
        } catch {}
      }
      
      // Use the higher count (DB or JSON) since they might not be synced
      const dbCount = Number(layout.seatCount) || 0;
      const effectiveSeatCount = Math.max(dbCount, jsonSeatCount);
      
      return {
        id: layout.id,
        venueId: layout.venueId,
        eventId: layout.eventId ?? null,
        name: layout.name,
        version: layout.version,
        isDefault: Boolean(layout.isDefault),
        isTemplate: Boolean(layout.isTemplate),
        publishedAt: layout.publishedAt ? toISO(layout.publishedAt) : null,
        createdAt: toISO(layout.createdAt),
        updatedAt: toISO(layout.updatedAt),
        seatCount: effectiveSeatCount,
        zoneCount: Number(layout.zoneCount) || 0,
      };
    });
  });

  // POST /api/venues/:venueId/layouts - Create new layout - Solo OPERATOR+
  app.post("/api/venues/:venueId/layouts", { preHandler: [requireOperator] }, async (request, reply) => {
    const paramsSchema = z.object({ venueId: z.string().min(1, "ID de venue inválido") });
    const { venueId } = paramsSchema.parse(request.params);

    const bodySchema = z.object({
      name: z.string().optional(),
      isDefault: z.boolean().optional().default(false),
      copyFromLayoutId: z.string().optional(),
    });
    const body = bodySchema.parse(request.body ?? {});

    // Check if venue exists
    const [venue] = await query<VenueRow[]>(
      `SELECT id, name FROM Venue WHERE id = ? OR slug = ? LIMIT 1`,
      [venueId, venueId],
    );

    if (!venue) {
      return reply.code(404).send({ message: "Venue no encontrado" });
    }

    try {
      const layoutId = randomUUID();
      let layoutJson = "{}";
      let metadata = null;
      
      // If copying from another layout, get its data
      if (body.copyFromLayoutId) {
        const [sourceLayout] = await query<VenueLayoutRow[]>(
          `SELECT layoutJson, metadata FROM VenueLayout WHERE id = ? AND venueId = ? LIMIT 1`,
          [body.copyFromLayoutId, venue.id],
        );
        if (sourceLayout) {
          layoutJson = typeof sourceLayout.layoutJson === "string" 
            ? sourceLayout.layoutJson 
            : JSON.stringify(sourceLayout.layoutJson ?? {});
          metadata = sourceLayout.metadata 
            ? (typeof sourceLayout.metadata === "string" ? sourceLayout.metadata : JSON.stringify(sourceLayout.metadata))
            : null;
        }
      }
      
      const layoutName = body.name || `${venue.name} Layout`;

      await query(
        `INSERT INTO VenueLayout (id, venueId, name, version, layoutJson, metadata, isDefault, publishedAt, createdAt, updatedAt)
        VALUES (?, ?, ?, 1, ?, ?, ?, ?, NOW(), NOW())`,
        [layoutId, venue.id, layoutName, layoutJson, metadata, body.isDefault ? 1 : 0, body.isDefault ? new Date() : null],
      );

      // Initialize layout version on venue if first layout
      await query(
        `UPDATE Venue SET layoutVersion = COALESCE(layoutVersion, 0) + 1, updatedAt = NOW() WHERE id = ?`,
        [venue.id],
      );

      return reply.code(201).send({
        layoutId,
        venueId: venue.id,
        name: layoutName,
        version: 1,
        message: "Layout creado exitosamente",
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ message: "No se pudo crear el layout" });
    }
  });

  // POST /api/venues/:venueId/layouts/:layoutId/duplicate - Duplicate a layout
  app.post("/api/venues/:venueId/layouts/:layoutId/duplicate", async (request, reply) => {
    const paramsSchema = z.object({ 
      venueId: z.string().min(1), 
      layoutId: z.string().min(1) 
    });
    const { venueId, layoutId } = paramsSchema.parse(request.params);
    const bodySchema = z.object({ name: z.string().optional() });
    const body = bodySchema.parse(request.body ?? {});

    const [venue] = await query<VenueRow[]>(
      `SELECT id, name FROM Venue WHERE id = ? OR slug = ? LIMIT 1`,
      [venueId, venueId],
    );
    if (!venue) {
      return reply.code(404).send({ message: "Venue no encontrado" });
    }

    const [sourceLayout] = await query<VenueLayoutRow[]>(
      `SELECT * FROM VenueLayout WHERE id = ? AND venueId = ? LIMIT 1`,
      [layoutId, venue.id],
    );
    if (!sourceLayout) {
      return reply.code(404).send({ message: "Layout no encontrado" });
    }

    try {
      const newLayoutId = randomUUID();
      const newName = body.name || `${sourceLayout.name} (copia)`;
      const layoutJson = typeof sourceLayout.layoutJson === "string" 
        ? sourceLayout.layoutJson 
        : JSON.stringify(sourceLayout.layoutJson ?? {});

      await query(
        `INSERT INTO VenueLayout (id, venueId, name, version, layoutJson, metadata, isDefault, isTemplate, createdAt, updatedAt)
         VALUES (?, ?, ?, 1, ?, ?, 0, 0, NOW(), NOW())`,
        [newLayoutId, venue.id, newName, layoutJson, sourceLayout.metadata],
      );

      // Copy seats from source layout
      const sourceSeats = await query<RowDataPacket[]>(
        `SELECT * FROM Seat WHERE layoutId = ?`,
        [layoutId],
      );
      
      for (const seat of sourceSeats) {
        const newSeatId = randomUUID();
        await query(
          `INSERT INTO Seat (id, venueId, layoutId, zoneId, tableId, label, rowLabel, columnNumber, status, metadata, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE', ?, NOW(), NOW())`,
          [newSeatId, venue.id, newLayoutId, seat.zoneId, seat.tableId, seat.label, seat.rowLabel, seat.columnNumber, seat.metadata],
        );
      }

      // Copy layout zones
      const sourceZones = await query<RowDataPacket[]>(
        `SELECT * FROM LayoutZone WHERE layoutId = ?`,
        [layoutId],
      );
      
      for (const zone of sourceZones) {
        const newZoneId = randomUUID();
        await query(
          `INSERT INTO LayoutZone (id, layoutId, sourceZoneId, name, color, basePrice, capacity, metadata, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [newZoneId, newLayoutId, zone.sourceZoneId, zone.name, zone.color, zone.basePrice, zone.capacity, zone.metadata],
        );
      }

      return reply.code(201).send({
        layoutId: newLayoutId,
        venueId: venue.id,
        name: newName,
        version: 1,
        message: "Layout duplicado exitosamente",
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ message: "No se pudo duplicar el layout" });
    }
  });

  // POST /api/venues/:venueId/layouts/:layoutId/set-default - Set layout as default
  app.post("/api/venues/:venueId/layouts/:layoutId/set-default", async (request, reply) => {
    const paramsSchema = z.object({ 
      venueId: z.string().min(1), 
      layoutId: z.string().min(1) 
    });
    const { venueId, layoutId } = paramsSchema.parse(request.params);

    const [venue] = await query<VenueRow[]>(
      `SELECT id FROM Venue WHERE id = ? OR slug = ? LIMIT 1`,
      [venueId, venueId],
    );
    if (!venue) {
      return reply.code(404).send({ message: "Venue no encontrado" });
    }

    const [layout] = await query<VenueLayoutRow[]>(
      `SELECT id FROM VenueLayout WHERE id = ? AND venueId = ? LIMIT 1`,
      [layoutId, venue.id],
    );
    if (!layout) {
      return reply.code(404).send({ message: "Layout no encontrado" });
    }

    try {
      // Remove default from all layouts of this venue
      await query(
        `UPDATE VenueLayout SET isDefault = 0, updatedAt = NOW() WHERE venueId = ?`,
        [venue.id],
      );
      
      // Set the selected layout as default
      await query(
        `UPDATE VenueLayout SET isDefault = 1, publishedAt = NOW(), updatedAt = NOW() WHERE id = ?`,
        [layoutId],
      );

      return { success: true, message: "Layout establecido como predeterminado" };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ message: "No se pudo establecer el layout como predeterminado" });
    }
  });

  // DELETE /api/venues/:venueId/layouts/:layoutId - Delete a layout - OPERATOR+
  app.delete("/api/venues/:venueId/layouts/:layoutId", { preHandler: [requireOperator] }, async (request, reply) => {
    const paramsSchema = z.object({ 
      venueId: z.string().min(1), 
      layoutId: z.string().min(1) 
    });
    const { venueId, layoutId } = paramsSchema.parse(request.params);

    const [venue] = await query<VenueRow[]>(
      `SELECT id FROM Venue WHERE id = ? OR slug = ? LIMIT 1`,
      [venueId, venueId],
    );
    if (!venue) {
      return reply.code(404).send({ message: "Venue no encontrado" });
    }

    const [layout] = await query<VenueLayoutRow[]>(
      `SELECT id, eventId, isDefault FROM VenueLayout WHERE id = ? AND venueId = ? LIMIT 1`,
      [layoutId, venue.id],
    );
    if (!layout) {
      return reply.code(404).send({ message: "Layout no encontrado" });
    }

    // Check if it's linked to an event
    if (layout.eventId) {
      return reply.code(400).send({ message: "No se puede eliminar un layout asociado a un evento" });
    }

    // Check if it's the only layout
    const [layoutCount] = await query<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM VenueLayout WHERE venueId = ?`,
      [venue.id],
    );
    if (Number(layoutCount.count) <= 1) {
      return reply.code(400).send({ message: "No se puede eliminar el único layout del venue" });
    }

    try {
      // Delete associated seats first
      await query(`DELETE FROM Seat WHERE layoutId = ?`, [layoutId]);
      
      // Delete layout zones
      await query(`DELETE FROM LayoutZone WHERE layoutId = ?`, [layoutId]);
      
      // Delete the layout
      await query(`DELETE FROM VenueLayout WHERE id = ?`, [layoutId]);

      // If it was the default, set another one as default
      if (layout.isDefault) {
        await query(
          `UPDATE VenueLayout SET isDefault = 1, updatedAt = NOW() 
           WHERE venueId = ? ORDER BY createdAt DESC LIMIT 1`,
          [venue.id],
        );
      }

      return { success: true, message: "Layout eliminado exitosamente" };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ message: "No se pudo eliminar el layout" });
    }
  });

  app.put("/api/venues/:venueId/layout", async (request, reply) => {
    const paramsSchema = z.object({ venueId: z.string().min(1, "ID de venue inválido") });
    const { venueId } = paramsSchema.parse(request.params);
    
    // Debug: verificar qué tipo de body llega
    let body = request.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return reply.code(400).send({ error: "Invalid JSON body" });
      }
    }
    
    const payload = saveVenueLayoutSchema.parse(body);
    const zonesPayload = payload.zones ?? [];
    const seatsPayload = payload.seats ?? [];
    const tablesPayload = payload.tables ?? [];
    const layoutJsonString = JSON.stringify(payload.layoutJson ?? {});
    const metadataString = payload.metadata ? JSON.stringify(payload.metadata) : null;

    // Version control: check If-Match header
    const ifMatchHeader = request.headers["if-match"];
    const forceOverwrite = request.headers["x-force-overwrite"] === "true";
    const requestedVersion = ifMatchHeader ? parseInt(ifMatchHeader, 10) : null;

    const [venue] = await query<RowDataPacket[]>(
      `SELECT id, lastEditedBy FROM Venue WHERE id = ? LIMIT 1`,
      [venueId],
    );

    if (!venue) {
      return reply.code(404).send({ message: "Venue no encontrado" });
    }

    let [layout] = await query<RowDataPacket[]>(
      `SELECT id, version, eventId FROM VenueLayout WHERE id = ? AND venueId = ? LIMIT 1`,
      [payload.layoutId, venueId],
    );

    // Si el layout no existe, lo creamos automáticamente
    if (!layout) {
      request.log.info(`[Layout Save] Layout ${payload.layoutId} no existe, creándolo...`);
      await query(
        `INSERT INTO VenueLayout (id, venueId, name, version, layoutJson, metadata, isDefault, publishedAt, createdAt, updatedAt)
         VALUES (?, ?, 'Layout Principal', 1, '{}', NULL, 1, NOW(), NOW(), NOW())`,
        [payload.layoutId, venueId],
      );
      // Re-fetch el layout recién creado
      [layout] = await query<RowDataPacket[]>(
        `SELECT id, version, eventId FROM VenueLayout WHERE id = ? AND venueId = ? LIMIT 1`,
        [payload.layoutId, venueId],
      );
    }

    const layoutId = layout.id;
    const isEventLayout = Boolean(layout.eventId);
    const currentVersion = Number(layout.version ?? 1);

    // Allow force overwrite to skip version check (for admins)
    if (!forceOverwrite && requestedVersion !== null && requestedVersion !== currentVersion) {
      return reply.code(409).send({
        error: "version_conflict",
        message: "El layout fue modificado por otro usuario",
        currentVersion,
        requestedVersion,
        lastEditedBy: venue.lastEditedBy,
      });
    }

    // Get seats with sold tickets to protect them (for this specific layout)
    const seatsWithTickets = await query<RowDataPacket[]>(
      `SELECT DISTINCT s.id FROM Seat s
       INNER JOIN Ticket t ON t.seatId = s.id
       WHERE s.layoutId = ? AND t.status IN ('SOLD', 'RESERVED')`,
      [layoutId],
    );
    const protectedSeatIds = new Set(seatsWithTickets.map(s => s.id));

    // Get zones with price tiers to track (but not necessarily protect)
    const zonesWithPriceTiers = await query<RowDataPacket[]>(
      `SELECT DISTINCT zoneId FROM EventPriceTier WHERE zoneId IS NOT NULL`,
      [],
    );
    const zonesInUse = new Set(zonesWithPriceTiers.map(z => z.zoneId));

    // DEBUG: Log incoming payload stats
    const sectionsFromPayload = (payload.layoutJson as any)?.sections || [];
    request.log.info(`[Layout Save] Layout: ${layoutId}, Seats: ${seatsPayload.length}, Zones: ${zonesPayload.length}, Sections: ${sectionsFromPayload.length}, Tables: ${tablesPayload.length}`);

    try {
      const syncStats = {
        zones: { created: 0, updated: 0, deleted: 0, protected: 0 },
        seats: { created: 0, updated: 0, deleted: 0, protected: 0 },
        tables: { created: 0, updated: 0, deleted: 0 },
        sections: { synced: 0 }, // Track sections synced
      };

      await withTransaction(async (connection) => {
        // 1. Update layout JSON and version
        const newVersion = currentVersion + 1;
        const [layoutUpdateResult] = await connection.query<ResultSetHeader>(
          `UPDATE VenueLayout SET layoutJson = ?, metadata = ?, version = ?, updatedAt = NOW() WHERE id = ? AND venueId = ?`,
          [layoutJsonString, metadataString, newVersion, payload.layoutId, venueId],
        );

        // Validate that the VenueLayout was actually updated
        if (layoutUpdateResult.affectedRows === 0) {
          request.log.warn(`[Layout Save] VenueLayout UPDATE affected 0 rows! layoutId=${payload.layoutId}, venueId=${venueId}`);
          throw new Error(`VenueLayout no encontrado o no pertenece al venue (layoutId=${payload.layoutId})`);
        }

        // Also update Venue for backwards compatibility
        await connection.query(
          `UPDATE Venue SET layoutJson = ?, layoutVersion = ?, lastEditedBy = ?, updatedAt = NOW() WHERE id = ?`,
          [layoutJsonString, newVersion, request.headers["x-user-id"] ?? null, venueId],
        );

        // 2. Sync zones - Ahora usamos LayoutZone (específico por layout) en lugar de VenueZone (global)
        const zoneIds = new Set<string>();
        
        // Primero obtener las LayoutZones existentes para este layout
        const [existingLayoutZones] = await connection.query<RowDataPacket[]>(
          `SELECT id, sourceZoneId FROM LayoutZone WHERE layoutId = ?`,
          [layoutId],
        );
        const existingZoneMap = new Map<string, string>(); // sourceZoneId -> layoutZoneId
        for (const ez of existingLayoutZones as RowDataPacket[]) {
          if (ez.sourceZoneId) {
            existingZoneMap.set(ez.sourceZoneId, ez.id);
          }
        }
        
        for (const zone of zonesPayload) {
          zoneIds.add(zone.id);
          
          // Check if zone exists in LayoutZone for this layout
          const existingLayoutZoneId = existingZoneMap.get(zone.id);
          const [existingZone] = await connection.query<RowDataPacket[]>(
            `SELECT id FROM LayoutZone WHERE layoutId = ? AND (sourceZoneId = ? OR id = ?)`,
            [layoutId, zone.id, zone.id],
          );

          if (existingZone.length > 0) {
            // Update existing LayoutZone
            await connection.query(
              `UPDATE LayoutZone SET name = ?, color = ?, basePrice = ?, capacity = ?, metadata = ?, updatedAt = NOW()
               WHERE id = ?`,
              [zone.name, zone.color ?? null, zone.price ?? null, zone.capacity ?? null, 
               JSON.stringify(buildZoneMetadata(zone)), existingZone[0].id],
            );
            syncStats.zones.updated++;
          } else {
            // Create new LayoutZone
            const newLayoutZoneId = randomUUID();
            await connection.query(
              `INSERT INTO LayoutZone (id, layoutId, sourceZoneId, name, color, basePrice, capacity, metadata, createdAt, updatedAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
              [newLayoutZoneId, layoutId, zone.id, zone.name, zone.color ?? null, zone.price ?? null, 
               zone.capacity ?? null, JSON.stringify(buildZoneMetadata(zone))],
            );
            syncStats.zones.created++;
            
            // También crear/actualizar en VenueZone para compatibilidad con asientos (referencia por zoneId)
            const [existingVenueZone] = await connection.query<RowDataPacket[]>(
              `SELECT id FROM VenueZone WHERE id = ? AND venueId = ?`,
              [zone.id, venueId],
            );
            if (existingVenueZone.length === 0) {
              await connection.query(
                `INSERT INTO VenueZone (id, venueId, name, color, basePrice, metadata, createdAt, updatedAt)
                 VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
                 ON DUPLICATE KEY UPDATE name = VALUES(name), color = VALUES(color), basePrice = VALUES(basePrice), updatedAt = NOW()`,
                [zone.id, venueId, zone.name, zone.color ?? null, zone.price ?? null, JSON.stringify(buildZoneMetadata(zone))],
              );
            }
          }
        }

        // Delete LayoutZones not in payload for THIS layout only
        if (zoneIds.size > 0) {
          const [deletedZones] = await connection.query<RowDataPacket[]>(
            `SELECT id, sourceZoneId FROM LayoutZone WHERE layoutId = ? AND sourceZoneId NOT IN (?)`,
            [layoutId, [...zoneIds]],
          );
          for (const dz of deletedZones as RowDataPacket[]) {
            if (zonesInUse.has(dz.sourceZoneId)) {
              syncStats.zones.protected++;
            } else {
              await connection.query(`DELETE FROM LayoutZone WHERE id = ?`, [dz.id]);
              syncStats.zones.deleted++;
            }
          }
        } else if (zonesPayload.length === 0) {
          // Delete all LayoutZones for this layout (not VenueZones)
          const [zonesToDelete] = await connection.query<RowDataPacket[]>(
            `SELECT id, sourceZoneId FROM LayoutZone WHERE layoutId = ?`,
            [layoutId],
          );
          for (const dz of zonesToDelete as RowDataPacket[]) {
            if (zonesInUse.has(dz.sourceZoneId)) {
              syncStats.zones.protected++;
            } else {
              await connection.query(`DELETE FROM LayoutZone WHERE id = ?`, [dz.id]);
              syncStats.zones.deleted++;
            }
          }
        }

        // 2.5. Sync sections from layoutJson to LayoutSection table
        // Las secciones vienen en layoutJson.sections
        const sectionsFromJson = (payload.layoutJson as any)?.sections || [];
        const syncedSectionIds = new Set<string>();
        
        for (const section of sectionsFromJson) {
          if (!section.id || !section.name) continue;
          syncedSectionIds.add(section.id);
          
          const polygonPointsJson = JSON.stringify(section.polygonPoints || section.points || []);
          const labelPositionJson = section.labelPosition ? JSON.stringify(section.labelPosition) : null;
          const sectionMetadata = JSON.stringify({
            ...(section.metadata ?? {}),
            originalColor: section.color,
          });
          
          // Check if section exists
          const [existingSection] = await connection.query<RowDataPacket[]>(
            `SELECT id FROM LayoutSection WHERE id = ? AND parentLayoutId = ?`,
            [section.id, layoutId],
          );
          
          if (existingSection.length > 0) {
            // Update existing section
            await connection.query(
              `UPDATE LayoutSection SET 
                name = ?, color = ?, polygonPoints = ?, labelPosition = ?, 
                capacity = ?, displayOrder = ?, isActive = ?, metadata = ?, updatedAt = NOW()
               WHERE id = ? AND parentLayoutId = ?`,
              [
                section.name,
                section.color ?? '#3B82F6',
                polygonPointsJson,
                labelPositionJson,
                section.capacity ?? 0,
                section.displayOrder ?? 0,
                section.isActive !== false ? 1 : 0,
                sectionMetadata,
                section.id,
                layoutId,
              ],
            );
          } else {
            // Create new section
            await connection.query(
              `INSERT INTO LayoutSection (id, parentLayoutId, zoneId, name, description, color, polygonPoints, labelPosition, capacity, displayOrder, isActive, metadata, createdAt, updatedAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
              [
                section.id,
                layoutId,
                section.zoneId ?? null,
                section.name,
                section.description ?? null,
                section.color ?? '#3B82F6',
                polygonPointsJson,
                labelPositionJson,
                section.capacity ?? 0,
                section.displayOrder ?? 0,
                section.isActive !== false ? 1 : 0,
                sectionMetadata,
              ],
            );
          }
        }
        
        // Delete sections no longer in layoutJson
        if (syncedSectionIds.size > 0) {
          await connection.query(
            `DELETE FROM LayoutSection WHERE parentLayoutId = ? AND id NOT IN (?)`,
            [layoutId, [...syncedSectionIds]],
          );
        } else if (sectionsFromJson.length === 0) {
          // If no sections in payload, delete all sections for this layout
          await connection.query(
            `DELETE FROM LayoutSection WHERE parentLayoutId = ?`,
            [layoutId],
          );
        }

        // 3. Sync tables
        // NOTA: Las mesas son a nivel venue, pero las posiciones se guardan en layoutJson.
        // Solo creamos/actualizamos las mesas que vienen en el payload, NO borramos las existentes
        // para evitar afectar otros layouts.
        const tableIds = new Set<string>();
        for (const table of tablesPayload) {
          tableIds.add(table.id);
          
          const [existingTable] = await connection.query<RowDataPacket[]>(
            `SELECT id FROM VenueTable WHERE id = ? AND venueId = ?`,
            [table.id, venueId],
          );

          const tableMetadata = JSON.stringify({ 
            ...(table.metadata ?? {}), 
            zoneId: table.zoneId,
            // Guardar referencia al layout que lo usa
            layoutId: layoutId 
          });

          if (existingTable.length > 0) {
            await connection.query(
              `UPDATE VenueTable SET shape = ?, centerX = ?, centerY = ?, rotation = ?, seatCount = ?, metadata = ?, updatedAt = NOW()
               WHERE id = ? AND venueId = ?`,
              [table.shape, table.centerX, table.centerY, table.rotation, table.seatCount, tableMetadata, table.id, venueId],
            );
            syncStats.tables.updated++;
          } else {
            await connection.query(
              `INSERT INTO VenueTable (id, venueId, shape, centerX, centerY, rotation, seatCount, metadata, createdAt, updatedAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
              [table.id, venueId, table.shape, table.centerX, table.centerY, table.rotation, table.seatCount, tableMetadata],
            );
            syncStats.tables.created++;
          }
        }

        // NO borramos mesas globalmente - solo las que ya no se usan en NINGÚN layout
        // Esto se manejará en una limpieza separada si es necesario

        // 4. Sync seats (with protection for sold tickets)
        // IMPORTANTE: Borrar primero TODOS los asientos no protegidos para evitar conflictos de label duplicado
        const seatIds = new Set<string>(seatsPayload.map(s => s.id));
        const validZoneIds = zoneIds.size > 0 ? zoneIds : null;

        // Primero: Obtener todos los asientos existentes CON sus labels para evitar conflictos
        const [allExistingSeats] = await connection.query<RowDataPacket[]>(
          `SELECT id, label FROM Seat WHERE layoutId = ?`,
          [layoutId],
        );
        
        const seatsToDelete: string[] = [];
        const protectedLabels = new Set<string>(); // Labels de asientos protegidos que no podemos tocar
        
        for (const existingSeat of allExistingSeats as RowDataPacket[]) {
          if (protectedSeatIds.has(existingSeat.id)) {
            syncStats.seats.protected++;
            // Guardar el label del asiento protegido para evitar duplicados
            if (existingSeat.label) {
              protectedLabels.add(existingSeat.label.trim());
            }
          } else {
            seatsToDelete.push(existingSeat.id);
          }
        }
        
        // Batch delete in chunks
        if (seatsToDelete.length > 0) {
          const DELETE_BATCH_SIZE = 100;
          for (let i = 0; i < seatsToDelete.length; i += DELETE_BATCH_SIZE) {
            const batch = seatsToDelete.slice(i, i + DELETE_BATCH_SIZE);
            await connection.query(
              `DELETE FROM Seat WHERE id IN (${batch.map(() => '?').join(', ')})`,
              batch,
            );
          }
          syncStats.seats.deleted = seatsToDelete.length;
        }

        // Segundo: Insertar todos los asientos del payload usando BATCH INSERT
        // Deduplicar por label para evitar errores de constraint
        // También evitar labels que ya existen en asientos protegidos
        const seenLabels = new Set<string>();
        let skippedDuplicates = 0;
        let skippedProtected = 0;
        const seatsToInsert: Array<[string, string, string, string | null, string | null, string, string | null, number | null, string, string]> = [];
        const seatsToUpdate: Array<{ id: string; zoneId: string | null; metadata: string }> = [];
        
        for (const seat of seatsPayload) {
          const label = seat.label.trim();
          
          // Saltar asientos con label duplicado en el payload
          if (seenLabels.has(label)) {
            skippedDuplicates++;
            continue;
          }
          
          // Si el asiento está protegido (tiene tickets vendidos), solo actualizar metadata, no insertar
          if (protectedSeatIds.has(seat.id)) {
            const seatMetadata = JSON.stringify(buildSeatMetadata(seat));
            let zoneId: string | null = null;
            if (seat.zoneId && (!validZoneIds || validZoneIds.has(seat.zoneId))) {
              zoneId = seat.zoneId;
            }
            seatsToUpdate.push({ id: seat.id, zoneId, metadata: seatMetadata });
            seenLabels.add(label);
            continue;
          }
          
          // Saltar asientos que colisionen con labels protegidos (asientos con tickets vendidos)
          // Solo si el ID es diferente (el caso del mismo ID ya se manejó arriba)
          if (protectedLabels.has(label)) {
            skippedProtected++;
            continue;
          }
          
          seenLabels.add(label);
          
          const parsed = seat.rowLabel || seat.columnNumber 
            ? { rowLabel: seat.rowLabel ?? null, columnNumber: seat.columnNumber ?? null } 
            : parseSeatLabel(label);
          const rowLabel = seat.rowLabel ?? parsed.rowLabel;
          const columnNumber = seat.columnNumber ?? parsed.columnNumber;
          
          // Validate zone reference
          let zoneId: string | null = null;
          if (seat.zoneId && (!validZoneIds || validZoneIds.has(seat.zoneId))) {
            zoneId = seat.zoneId;
          }

          const seatMetadata = JSON.stringify(buildSeatMetadata(seat));

          seatsToInsert.push([
            seat.id, venueId, layoutId, zoneId, seat.tableId ?? null, 
            label, rowLabel, columnNumber, 
            normalizeSeatStatus(seat.status), seatMetadata
          ]);
        }
        
        // Batch insert in chunks of 100 seats using INSERT ... ON DUPLICATE KEY UPDATE
        // This handles cases where an ID already exists but wasn't in protectedSeatIds
        const BATCH_SIZE = 100;
        for (let i = 0; i < seatsToInsert.length; i += BATCH_SIZE) {
          const batch = seatsToInsert.slice(i, i + BATCH_SIZE);
          if (batch.length > 0) {
            const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())').join(', ');
            const values = batch.flat();
            await connection.query(
              `INSERT INTO Seat (id, venueId, layoutId, zoneId, tableId, label, rowLabel, columnNumber, status, metadata, createdAt, updatedAt)
               VALUES ${placeholders}
               ON DUPLICATE KEY UPDATE 
                 zoneId = VALUES(zoneId),
                 tableId = VALUES(tableId),
                 label = VALUES(label),
                 rowLabel = VALUES(rowLabel),
                 columnNumber = VALUES(columnNumber),
                 status = VALUES(status),
                 metadata = VALUES(metadata),
                 updatedAt = NOW()`,
              values,
            );
            syncStats.seats.created += batch.length;
          }
        }

        // Update protected seats (only metadata and zoneId, keep status/label intact)
        for (const seatUpdate of seatsToUpdate) {
          await connection.query(
            `UPDATE Seat SET zoneId = ?, metadata = ?, updatedAt = NOW() WHERE id = ?`,
            [seatUpdate.zoneId, seatUpdate.metadata, seatUpdate.id],
          );
          syncStats.seats.updated = (syncStats.seats.updated ?? 0) + 1;
        }

        // Update venue capacity (only if this is a template layout)
        if (!isEventLayout) {
          const totalSeats = seatsPayload.length + syncStats.seats.protected;
          await connection.query(
            `UPDATE Venue SET capacity = ?, updatedAt = NOW() WHERE id = ?`,
            [totalSeats > 0 ? totalSeats : null, venueId],
          );
        }
        
        // Log duplicates and protected collisions if any
        if (skippedDuplicates > 0 || skippedProtected > 0) {
          request.log.warn({ 
            skippedDuplicates, 
            skippedProtected, 
            totalReceived: seatsPayload.length, 
            uniqueLabels: seenLabels.size,
            protectedLabelsCount: protectedLabels.size,
          }, 'Seats skipped during save');
        }
      });

      return reply.send({ 
        success: true, 
        version: currentVersion + 1,
        sync: syncStats,
        warnings: syncStats.seats.protected > 0 || syncStats.zones.protected > 0
          ? `${syncStats.seats.protected} asientos y ${syncStats.zones.protected} zonas protegidos por tener boletos vendidos`
          : null
      });
    } catch (error: any) {
      request.log.error(error);
      
      // Provide more detailed error for debugging
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = error?.code || error?.errno || 'UNKNOWN';
      const sqlMessage = error?.sqlMessage || null;
      
      console.error('[Layout Save Error]', {
        errorCode,
        errorMessage,
        sqlMessage,
        stack: error?.stack,
      });
      
      return reply.code(500).send({ 
        message: "No se pudo guardar el layout",
        error: errorMessage,
        code: errorCode,
        sqlMessage,
      });
    }
  });

  // GET /api/venues/:venueId/layouts/:layoutId/history - Layout version history
  app.get("/api/venues/:venueId/layouts/:layoutId/history", async (request, reply) => {
    const paramsSchema = z.object({
      venueId: z.string().min(1),
      layoutId: z.string().min(1),
    });
    const { venueId, layoutId } = paramsSchema.parse(request.params);

    const history = await query<RowDataPacket[]>(
      `SELECT id, venueId, name, version, metadata, isDefault, publishedAt, createdBy, createdAt, updatedAt
       FROM VenueLayout
       WHERE venueId = ? AND id = ?
       ORDER BY version DESC
       LIMIT 10`,
      [venueId, layoutId],
    );

    return history.map((row) => ({
      id: row.id,
      venueId: row.venueId,
      name: row.name,
      version: row.version,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : null,
      isDefault: Boolean(row.isDefault),
      publishedAt: toISO(row.publishedAt as Date | null),
      createdBy: row.createdBy,
      createdAt: toISO(row.createdAt as Date),
      updatedAt: toISO(row.updatedAt as Date),
    }));
  });

  // GET /api/venues/:venueId/tables - List all tables with seats
  app.get("/api/venues/:venueId/tables", async (request, reply) => {
    const paramsSchema = z.object({
      venueId: z.string().min(1),
    });
    const querySchema = z.object({
      layoutId: z.string().optional(),
    });
    const { venueId } = paramsSchema.parse(request.params);
    const { layoutId: queryLayoutId } = querySchema.parse(request.query);

    // Get layoutId - use provided or get template layout
    let layoutId = queryLayoutId;
    if (!layoutId) {
      const [templateLayout] = await query<(RowDataPacket & { id: string })[]>(
        `SELECT id FROM VenueLayout WHERE venueId = ? AND isTemplate = true LIMIT 1`,
        [venueId],
      );
      layoutId = templateLayout?.id;
    }

    const tables = await query<RowDataPacket[]>(
      `SELECT id, venueId, shape, centerX, centerY, rotation, seatCount, metadata, createdAt, updatedAt
       FROM VenueTable
       WHERE venueId = ?
       ORDER BY createdAt ASC`,
      [venueId],
    );

    const seats = layoutId
      ? await query<SeatRow[]>(
          `SELECT id, tableId, label, metadata
           FROM Seat
           WHERE layoutId = ? AND tableId IS NOT NULL
           ORDER BY tableId, label`,
          [layoutId],
        )
      : [];

    const seatsByTable = seats.reduce((acc, seat) => {
      if (!seat.tableId) return acc;
      if (!acc[seat.tableId]) acc[seat.tableId] = [];
      const meta = seat.metadata ? JSON.parse(seat.metadata) : {};
      acc[seat.tableId].push({
        id: seat.id,
        label: seat.label,
        offsetX: meta.offsetX,
        offsetY: meta.offsetY,
        angle: meta.angle,
      });
      return acc;
    }, {} as Record<string, any[]>);

    return tables.map((table) => ({
      id: table.id,
      venueId: table.venueId,
      shape: table.shape,
      centerX: Number(table.centerX),
      centerY: Number(table.centerY),
      rotation: Number(table.rotation),
      seatCount: table.seatCount,
      metadata: table.metadata ? JSON.parse(table.metadata as string) : null,
      createdAt: toISO(table.createdAt as Date),
      updatedAt: toISO(table.updatedAt as Date),
      seats: seatsByTable[table.id] ?? [],
    }));
  });

  // POST /api/venues/:venueId/layouts/:layoutId/snapshot - Create snapshot
  app.post("/api/venues/:venueId/layouts/:layoutId/snapshot", async (request, reply) => {
    const paramsSchema = z.object({
      venueId: z.string().min(1),
      layoutId: z.string().min(1),
    });
    const bodySchema = z.object({
      name: z.string().optional(),
    });
    const { venueId, layoutId } = paramsSchema.parse(request.params);
    const { name } = bodySchema.parse(request.body);

    const [layout] = await query<VenueLayoutRow[]>(
      `SELECT * FROM VenueLayout WHERE id = ? AND venueId = ? LIMIT 1`,
      [layoutId, venueId],
    );

    if (!layout) {
      return reply.code(404).send({ message: "Layout no encontrado" });
    }

    const newVersion = layout.version + 1;
    const newLayoutId = randomUUID();

    await query(
      `INSERT INTO VenueLayout (id, venueId, name, version, layoutJson, metadata, isDefault, publishedAt, createdBy, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, 0, NULL, ?, NOW(), NOW())`,
      [
        newLayoutId,
        venueId,
        name ?? `${layout.name} v${newVersion}`,
        newVersion,
        layout.layoutJson,
        layout.metadata,
        request.headers["x-user-id"] ?? null,
      ],
    );

    return reply.code(201).send({
      id: newLayoutId,
      version: newVersion,
      message: "Snapshot creado",
    });
  });

  // POST /api/venues/:venueId/tables/generate - Generate table with seats
  app.post("/api/venues/:venueId/tables/generate", async (request, reply) => {
    const paramsSchema = z.object({ venueId: z.string() });
    const bodySchema = z.object({
      name: z.string(),
      shape: z.enum(["rectangle", "circle", "oval"]),
      seatCount: z.number().min(2).max(20),
      width: z.number().optional(),
      height: z.number().optional(),
      radius: z.number().optional(),
      centerX: z.number(),
      centerY: z.number(),
      zoneId: z.string(),
      startNumber: z.number().default(1),
      seatSpacing: z.number().default(40),
    });

    const { venueId } = paramsSchema.parse(request.params);
    const config = bodySchema.parse(request.body);

    const tableId = randomUUID();
    const tableName = config.name;

    // Calculate seat positions based on shape
    let seatPositions: { offsetX: number; offsetY: number; angle: number }[] = [];

    if (config.shape === "circle" || config.shape === "oval") {
      const radiusX = config.radius ?? 50;
      const radiusY = config.shape === "oval" ? (radiusX * 0.7) : radiusX;
      const angleStep = (2 * Math.PI) / config.seatCount;

      for (let i = 0; i < config.seatCount; i++) {
        const angle = i * angleStep - Math.PI / 2; // Start at top
        seatPositions.push({
          offsetX: Math.cos(angle) * radiusX,
          offsetY: Math.sin(angle) * radiusY,
          angle: (angle * 180 / Math.PI) + 90, // Seats face inward
        });
      }
    } else if (config.shape === "rectangle") {
      const w = config.width ?? 120;
      const h = config.height ?? 80;
      const perimeter = 2 * (w + h);
      const spacing = perimeter / config.seatCount;

      let distance = 0;
      for (let i = 0; i < config.seatCount; i++) {
        let x = 0, y = 0, angle = 0;

        if (distance < w) {
          // Top edge
          x = distance - w / 2;
          y = -h / 2;
          angle = 0;
        } else if (distance < w + h) {
          // Right edge
          x = w / 2;
          y = (distance - w) - h / 2;
          angle = 90;
        } else if (distance < 2 * w + h) {
          // Bottom edge
          x = w / 2 - (distance - w - h);
          y = h / 2;
          angle = 180;
        } else {
          // Left edge
          x = -w / 2;
          y = h / 2 - (distance - 2 * w - h);
          angle = 270;
        }

        seatPositions.push({ offsetX: x, offsetY: y, angle });
        distance += spacing;
      }
    }

    // Insert table
    await query(
      `INSERT INTO VenueTable (id, venueId, name, shape, centerX, centerY, width, height, radius, metadata, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        tableId,
        venueId,
        tableName,
        config.shape,
        config.centerX,
        config.centerY,
        config.width ?? null,
        config.height ?? null,
        config.radius ?? null,
        JSON.stringify({ seatCount: config.seatCount }),
      ]
    );

    // Insert seats
    const seatInserts = seatPositions.map((pos, idx) => {
      const seatId = randomUUID();
      const seatNumber = config.startNumber + idx;
      const label = `${tableName}-${seatNumber}`;

      return query(
        `INSERT INTO Seat (id, venueId, zoneId, label, rowLabel, columnNumber, status, metadata, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, 'AVAILABLE', ?, NOW(), NOW())`,
        [
          seatId,
          venueId,
          config.zoneId,
          label,
          tableName,
          seatNumber,
          JSON.stringify({
            tableId,
            offsetX: pos.offsetX,
            offsetY: pos.offsetY,
            angle: pos.angle,
            shape: "circle",
            seatType: "standard",
          }),
        ]
      );
    });

    await Promise.all(seatInserts);

    return reply.code(201).send({
      tableId,
      seatCount: config.seatCount,
      message: "Mesa generada con éxito",
    });
  });

  // DELETE /api/venues/:venueId/tables/:tableId - Delete table and seats
  app.delete("/api/venues/:venueId/tables/:tableId", async (request, reply) => {
    const paramsSchema = z.object({
      venueId: z.string(),
      tableId: z.string(),
    });

    const { tableId } = paramsSchema.parse(request.params);

    await query(`DELETE FROM Seat WHERE metadata->>'$.tableId' = ?`, [tableId]);
    await query(`DELETE FROM VenueTable WHERE id = ?`, [tableId]);

    return reply.code(200).send({ message: "Mesa eliminada" });
  });

  // POST /api/venues/:venueId/tables/:tableId/duplicate - Duplicate table
  app.post("/api/venues/:venueId/tables/:tableId/duplicate", async (request, reply) => {
    const paramsSchema = z.object({
      venueId: z.string(),
      tableId: z.string(),
    });
    const bodySchema = z.object({
      newName: z.string(),
      offsetX: z.number().default(100),
      offsetY: z.number().default(0),
      startNumber: z.number().optional(),
    });

    const { venueId, tableId } = paramsSchema.parse(request.params);
    const config = bodySchema.parse(request.body);

    // Get original table
    const [table] = await query<RowDataPacket[]>(
      `SELECT * FROM VenueTable WHERE id = ? AND venueId = ?`,
      [tableId, venueId]
    );

    if (!table) {
      return reply.code(404).send({ error: "Mesa no encontrada" });
    }

    // Get original seats
    const seats = await query<RowDataPacket[]>(
      `SELECT * FROM Seat WHERE metadata->>'$.tableId' = ? ORDER BY columnNumber ASC`,
      [tableId]
    );

    const newTableId = randomUUID();
    const newCenterX = table.centerX + config.offsetX;
    const newCenterY = table.centerY + config.offsetY;

    // Insert new table
    await query(
      `INSERT INTO VenueTable (id, venueId, name, shape, centerX, centerY, width, height, radius, metadata, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        newTableId,
        venueId,
        config.newName,
        table.shape,
        newCenterX,
        newCenterY,
        table.width,
        table.height,
        table.radius,
        table.metadata,
      ]
    );

    // Duplicate seats with new numbering
    const startNum = config.startNumber ?? 1;
    const newSeats = seats.map((seat, idx) => {
      const newSeatId = randomUUID();
      const seatNumber = startNum + idx;
      const label = `${config.newName}-${seatNumber}`;
      const metadata = JSON.parse(seat.metadata ?? "{}");
      metadata.tableId = newTableId;

      return query(
        `INSERT INTO Seat (id, venueId, zoneId, label, rowLabel, columnNumber, status, metadata, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, 'AVAILABLE', ?, NOW(), NOW())`,
        [
          newSeatId,
          venueId,
          seat.zoneId,
          label,
          config.newName,
          seatNumber,
          JSON.stringify(metadata),
        ]
      );
    });

    await Promise.all(newSeats);

    return reply.code(201).send({
      tableId: newTableId,
      seatCount: seats.length,
      message: "Mesa duplicada con éxito",
    });
  });

  // GET /api/venues/:venueId/templates - Get venue templates
  app.get("/api/venues/:venueId/templates", async (request, reply) => {
    const paramsSchema = z.object({ venueId: z.string() });
    paramsSchema.parse(request.params);

    const templates = await query<RowDataPacket[]>(
      `SELECT id, name, category, capacity, layoutJson, description, createdAt
       FROM VenueTemplate
       ORDER BY category ASC, capacity ASC`
    );

    return reply.send(templates);
  });
}

