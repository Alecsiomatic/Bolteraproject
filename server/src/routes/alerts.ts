import { randomUUID } from "crypto";
import { FastifyInstance } from "fastify";
import { RowDataPacket } from "mysql2";
import { z } from "zod";
import { query } from "../lib/db";

type AlertRow = RowDataPacket & {
  id: string;
  venueId: string;
  name: string;
  type: string;
  condition: string;
  threshold: number | null;
  notifyEmails: string | null;
  isActive: boolean;
  lastTriggeredAt: Date | null;
  metadata: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export default async function alertsRoutes(app: FastifyInstance) {
  // GET /api/venues/:venueId/alerts - List alerts
  app.get("/api/venues/:venueId/alerts", async (request, reply) => {
    const paramsSchema = z.object({ venueId: z.string() });
    const querySchema = z.object({
      type: z.enum(["capacity", "sales", "stock", "schedule"]).optional(),
      isActive: z.enum(["true", "false"]).optional(),
    });

    const { venueId } = paramsSchema.parse(request.params);
    const filters = querySchema.parse(request.query);

    let sql = `SELECT * FROM VenueAlert WHERE venueId = ?`;
    const params: any[] = [venueId];

    if (filters.type) {
      sql += ` AND type = ?`;
      params.push(filters.type);
    }

    if (filters.isActive) {
      sql += ` AND isActive = ?`;
      params.push(filters.isActive === "true" ? 1 : 0);
    }

    sql += ` ORDER BY type ASC, name ASC`;

    const alerts = await query<AlertRow[]>(sql, params);

    return reply.send(
      alerts.map((a) => ({
        ...a,
        notifyEmails: a.notifyEmails ? a.notifyEmails.split(",") : [],
        metadata: a.metadata ? JSON.parse(a.metadata) : null,
      }))
    );
  });

  // GET /api/venues/:venueId/alerts/:alertId - Get alert
  app.get("/api/venues/:venueId/alerts/:alertId", async (request, reply) => {
    const paramsSchema = z.object({
      venueId: z.string(),
      alertId: z.string(),
    });

    const { venueId, alertId } = paramsSchema.parse(request.params);

    const [alert] = await query<AlertRow[]>(
      `SELECT * FROM VenueAlert WHERE id = ? AND venueId = ?`,
      [alertId, venueId]
    );

    if (!alert) {
      return reply.code(404).send({ error: "Alerta no encontrada" });
    }

    return reply.send({
      ...alert,
      notifyEmails: alert.notifyEmails ? alert.notifyEmails.split(",") : [],
      metadata: alert.metadata ? JSON.parse(alert.metadata) : null,
    });
  });

  // POST /api/venues/:venueId/alerts - Create alert
  app.post("/api/venues/:venueId/alerts", async (request, reply) => {
    const paramsSchema = z.object({ venueId: z.string() });
    const bodySchema = z.object({
      name: z.string().min(1).max(100),
      type: z.enum(["capacity", "sales", "stock", "schedule"]),
      condition: z.string(), // e.g., "occupancy > 90", "stock < 10", "sessions_overlap"
      threshold: z.number().optional(),
      notifyEmails: z.array(z.string().email()),
      isActive: z.boolean().default(true),
      metadata: z.record(z.unknown()).optional(),
    });

    const { venueId } = paramsSchema.parse(request.params);
    const data = bodySchema.parse(request.body);

    const alertId = randomUUID();

    await query(
      `INSERT INTO VenueAlert (id, venueId, name, type, \`condition\`, threshold, notifyEmails, isActive, metadata, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        alertId,
        venueId,
        data.name,
        data.type,
        data.condition,
        data.threshold ?? null,
        data.notifyEmails.join(","),
        data.isActive ? 1 : 0,
        data.metadata ? JSON.stringify(data.metadata) : null,
      ]
    );

    return reply.code(201).send({
      id: alertId,
      message: "Alerta creada",
    });
  });

  // PUT /api/venues/:venueId/alerts/:alertId - Update alert
  app.put("/api/venues/:venueId/alerts/:alertId", async (request, reply) => {
    const paramsSchema = z.object({
      venueId: z.string(),
      alertId: z.string(),
    });
    const bodySchema = z.object({
      name: z.string().min(1).max(100).optional(),
      type: z.enum(["capacity", "sales", "stock", "schedule"]).optional(),
      condition: z.string().optional(),
      threshold: z.number().nullable().optional(),
      notifyEmails: z.array(z.string().email()).optional(),
      isActive: z.boolean().optional(),
      metadata: z.record(z.unknown()).nullable().optional(),
    });

    const { venueId, alertId } = paramsSchema.parse(request.params);
    const data = bodySchema.parse(request.body);

    const [existing] = await query<AlertRow[]>(
      `SELECT id FROM VenueAlert WHERE id = ? AND venueId = ?`,
      [alertId, venueId]
    );

    if (!existing) {
      return reply.code(404).send({ error: "Alerta no encontrada" });
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (data.name !== undefined) {
      updates.push("name = ?");
      params.push(data.name);
    }
    if (data.type !== undefined) {
      updates.push("type = ?");
      params.push(data.type);
    }
    if (data.condition !== undefined) {
      updates.push("`condition` = ?");
      params.push(data.condition);
    }
    if (data.threshold !== undefined) {
      updates.push("threshold = ?");
      params.push(data.threshold);
    }
    if (data.notifyEmails !== undefined) {
      updates.push("notifyEmails = ?");
      params.push(data.notifyEmails.join(","));
    }
    if (data.isActive !== undefined) {
      updates.push("isActive = ?");
      params.push(data.isActive ? 1 : 0);
    }
    if (data.metadata !== undefined) {
      updates.push("metadata = ?");
      params.push(data.metadata ? JSON.stringify(data.metadata) : null);
    }

    if (updates.length === 0) {
      return reply.send({ message: "Sin cambios" });
    }

    updates.push("updatedAt = NOW()");
    params.push(alertId, venueId);

    await query(
      `UPDATE VenueAlert SET ${updates.join(", ")} WHERE id = ? AND venueId = ?`,
      params
    );

    return reply.send({ message: "Alerta actualizada" });
  });

  // DELETE /api/venues/:venueId/alerts/:alertId - Delete alert
  app.delete("/api/venues/:venueId/alerts/:alertId", async (request, reply) => {
    const paramsSchema = z.object({
      venueId: z.string(),
      alertId: z.string(),
    });

    const { venueId, alertId } = paramsSchema.parse(request.params);

    const result = await query(
      `DELETE FROM VenueAlert WHERE id = ? AND venueId = ?`,
      [alertId, venueId]
    );

    if ((result as any).affectedRows === 0) {
      return reply.code(404).send({ error: "Alerta no encontrada" });
    }

    return reply.send({ message: "Alerta eliminada" });
  });

  // POST /api/venues/:venueId/alerts/:alertId/trigger - Manually trigger alert
  app.post("/api/venues/:venueId/alerts/:alertId/trigger", async (request, reply) => {
    const paramsSchema = z.object({
      venueId: z.string(),
      alertId: z.string(),
    });

    const { venueId, alertId } = paramsSchema.parse(request.params);

    const [alert] = await query<AlertRow[]>(
      `SELECT * FROM VenueAlert WHERE id = ? AND venueId = ?`,
      [alertId, venueId]
    );

    if (!alert) {
      return reply.code(404).send({ error: "Alerta no encontrada" });
    }

    // Update lastTriggeredAt
    await query(
      `UPDATE VenueAlert SET lastTriggeredAt = NOW() WHERE id = ?`,
      [alertId]
    );

    return reply.send({
      message: "Alerta disparada",
      alert: {
        id: alert.id,
        name: alert.name,
        type: alert.type,
        notifyEmails: alert.notifyEmails ? alert.notifyEmails.split(",") : [],
      },
    });
  });

  // GET /api/venues/:venueId/validation/capacity - Validate capacity
  app.get("/api/venues/:venueId/validation/capacity", async (request, reply) => {
    const paramsSchema = z.object({ venueId: z.string() });
    const { venueId } = paramsSchema.parse(request.params);

    // Get venue capacity
    const [venue] = await query<RowDataPacket[]>(
      `SELECT capacity FROM Venue WHERE id = ?`,
      [venueId]
    );

    if (!venue) {
      return reply.code(404).send({ error: "Venue no encontrado" });
    }

    // Count seats
    const [seatCount] = await query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM Seat WHERE venueId = ?`,
      [venueId]
    );

    const total = seatCount?.total ?? 0;
    const capacity = venue.capacity ?? 0;
    const percentage = capacity > 0 ? (total / capacity) * 100 : 0;
    const isOverCapacity = total > capacity;

    return reply.send({
      venueId,
      capacity,
      totalSeats: total,
      availableCapacity: Math.max(0, capacity - total),
      occupancyPercentage: Math.round(percentage * 100) / 100,
      isOverCapacity,
      status: isOverCapacity ? "error" : percentage >= 90 ? "warning" : "ok",
    });
  });

  // GET /api/venues/:venueId/validation/schedule - Check schedule conflicts
  app.get("/api/venues/:venueId/validation/schedule", async (request, reply) => {
    const paramsSchema = z.object({ venueId: z.string() });
    const { venueId } = paramsSchema.parse(request.params);

    // Find overlapping sessions
    const overlaps = await query<RowDataPacket[]>(
      `SELECT 
        s1.id as session1Id,
        s1.title as session1Title,
        s1.startsAt as session1Start,
        s1.endsAt as session1End,
        s2.id as session2Id,
        s2.title as session2Title,
        s2.startsAt as session2Start,
        s2.endsAt as session2End,
        e.name as eventName
      FROM EventSession s1
      JOIN EventSession s2 ON s1.eventId = s2.eventId AND s1.id < s2.id
      JOIN Event e ON s1.eventId = e.id
      WHERE e.venueId = ?
        AND s1.startsAt < s2.endsAt
        AND s1.endsAt > s2.startsAt
      ORDER BY s1.startsAt ASC`,
      [venueId]
    );

    return reply.send({
      venueId,
      conflicts: overlaps.map((o) => ({
        event: o.eventName,
        session1: {
          id: o.session1Id,
          title: o.session1Title,
          start: o.session1Start,
          end: o.session1End,
        },
        session2: {
          id: o.session2Id,
          title: o.session2Title,
          start: o.session2Start,
          end: o.session2End,
        },
        overlapMinutes: Math.round(
          (Math.min(new Date(o.session1End).getTime(), new Date(o.session2End).getTime()) -
            Math.max(new Date(o.session1Start).getTime(), new Date(o.session2Start).getTime())) /
            60000
        ),
      })),
      hasConflicts: overlaps.length > 0,
      totalConflicts: overlaps.length,
    });
  });

  // GET /api/venues/:venueId/validation/stock - Check low stock products
  app.get("/api/venues/:venueId/validation/stock", async (request, reply) => {
    const paramsSchema = z.object({ venueId: z.string() });
    const querySchema = z.object({
      threshold: z.string().optional().default("10"),
    });

    const { venueId } = paramsSchema.parse(request.params);
    const { threshold } = querySchema.parse(request.query);

    const lowStock = await query<RowDataPacket[]>(
      `SELECT id, name, type, price, stock, isActive
       FROM VenueProduct
       WHERE venueId = ? AND stock IS NOT NULL AND stock <= ? AND isActive = 1
       ORDER BY stock ASC`,
      [venueId, parseInt(threshold)]
    );

    return reply.send({
      venueId,
      threshold: parseInt(threshold),
      lowStockProducts: lowStock,
      totalLowStock: lowStock.length,
      criticalStock: lowStock.filter((p) => p.stock === 0).length,
    });
  });
}
