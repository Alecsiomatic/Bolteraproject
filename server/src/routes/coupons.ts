import { FastifyInstance } from "fastify";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { query, withTransaction } from "../lib/db";
import { requireAdmin, requireAuth } from "../lib/authMiddleware";
import { randomUUID } from "crypto";

interface CouponRow extends RowDataPacket {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: number;
  minPurchase: number | null;
  maxDiscount: number | null;
  usageLimit: number | null;
  usedCount: number;
  perUserLimit: number;
  eventId: string | null;
  startsAt: Date | null;
  expiresAt: Date | null;
  isActive: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const toISO = (value: Date | string | null) =>
  value instanceof Date ? value.toISOString() : value;

export async function couponRoutes(app: FastifyInstance) {
  // GET /api/coupons - List all coupons (admin only)
  app.get("/api/coupons", {
    preHandler: [requireAdmin],
    handler: async (request, reply) => {
      try {
        const { eventId, isActive, search, limit = "50", offset = "0" } = request.query as {
          eventId?: string;
          isActive?: string;
          search?: string;
          limit?: string;
          offset?: string;
        };

        let sql = `
          SELECT c.*, e.name as eventTitle
          FROM Coupon c
          LEFT JOIN Event e ON e.id = c.eventId
          WHERE 1=1
        `;
      const params: any[] = [];

      if (eventId) {
        sql += ` AND c.eventId = ?`;
        params.push(eventId);
      }

      if (isActive !== undefined) {
        sql += ` AND c.isActive = ?`;
        params.push(isActive === "true");
      }

      if (search) {
        sql += ` AND (c.code LIKE ? OR c.name LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
      }

      sql += ` ORDER BY c.createdAt DESC LIMIT ? OFFSET ?`;
      params.push(parseInt(limit), parseInt(offset));

      const coupons = await query<(CouponRow & { eventTitle?: string })[]>(sql, params);

      // Get total count
      let countSql = `SELECT COUNT(*) as total FROM Coupon WHERE 1=1`;
      const countParams: any[] = [];
      if (eventId) {
        countSql += ` AND eventId = ?`;
        countParams.push(eventId);
      }
      if (isActive !== undefined) {
        countSql += ` AND isActive = ?`;
        countParams.push(isActive === "true");
      }
      if (search) {
        countSql += ` AND (code LIKE ? OR name LIKE ?)`;
        countParams.push(`%${search}%`, `%${search}%`);
      }

      const [countResult] = await query<RowDataPacket[]>(countSql, countParams);

      return reply.send({
        success: true,
        coupons: coupons.map((c) => ({
          id: c.id,
          code: c.code,
          name: c.name,
          description: c.description,
          discountType: c.discountType,
          discountValue: Number(c.discountValue),
          minPurchase: c.minPurchase ? Number(c.minPurchase) : null,
          maxDiscount: c.maxDiscount ? Number(c.maxDiscount) : null,
          usageLimit: c.usageLimit,
          usedCount: c.usedCount,
          perUserLimit: c.perUserLimit,
          eventId: c.eventId,
          eventTitle: c.eventTitle || null,
          startsAt: toISO(c.startsAt),
          expiresAt: toISO(c.expiresAt),
          isActive: c.isActive,
          createdAt: toISO(c.createdAt),
        })),
        pagination: {
          total: countResult?.total || 0,
          limit: parseInt(limit),
          offset: parseInt(offset),
        },
      });
      } catch (error: any) {
        // If table doesn't exist, return empty array
        if (error.code === 'ER_NO_SUCH_TABLE') {
          return reply.send({
            success: true,
            coupons: [],
            pagination: { total: 0, limit: 50, offset: 0 },
          });
        }
        throw error;
      }
    },
  });

  // GET /api/coupons/:id - Get coupon details (admin only)
  app.get<{ Params: { id: string } }>("/api/coupons/:id", {
    preHandler: [requireAdmin],
    handler: async (request, reply) => {
      const { id } = request.params;

      const [coupon] = await query<CouponRow[]>(
        `SELECT c.*, e.title as eventTitle
         FROM Coupon c
         LEFT JOIN Event e ON e.id = c.eventId
         WHERE c.id = ?`,
        [id]
      );

      if (!coupon) {
        return reply.status(404).send({
          success: false,
          error: "Cupón no encontrado",
        });
      }

      // Get usage stats
      const [usageStats] = await query<RowDataPacket[]>(
        `SELECT COUNT(*) as totalUsed, SUM(discountApplied) as totalDiscount
         FROM CouponUsage WHERE couponId = ?`,
        [id]
      );

      return reply.send({
        success: true,
        coupon: {
          id: coupon.id,
          code: coupon.code,
          name: coupon.name,
          description: coupon.description,
          discountType: coupon.discountType,
          discountValue: Number(coupon.discountValue),
          minPurchase: coupon.minPurchase ? Number(coupon.minPurchase) : null,
          maxDiscount: coupon.maxDiscount ? Number(coupon.maxDiscount) : null,
          usageLimit: coupon.usageLimit,
          usedCount: coupon.usedCount,
          perUserLimit: coupon.perUserLimit,
          eventId: coupon.eventId,
          eventTitle: (coupon as any).eventTitle || null,
          startsAt: toISO(coupon.startsAt),
          expiresAt: toISO(coupon.expiresAt),
          isActive: coupon.isActive,
          createdAt: toISO(coupon.createdAt),
          stats: {
            totalUsed: usageStats?.totalUsed || 0,
            totalDiscount: Number(usageStats?.totalDiscount) || 0,
          },
        },
      });
    },
  });

  // POST /api/coupons - Create coupon (admin only)
  app.post("/api/coupons", {
    preHandler: [requireAdmin],
    handler: async (request, reply) => {
      const currentUser = (request as any).user;
      const {
        code,
        name,
        description,
        discountType = "PERCENTAGE",
        discountValue,
        minPurchase,
        maxDiscount,
        usageLimit,
        perUserLimit = 1,
        eventId,
        startsAt,
        expiresAt,
        isActive = true,
      } = request.body as {
        code: string;
        name: string;
        description?: string;
        discountType?: "PERCENTAGE" | "FIXED";
        discountValue: number;
        minPurchase?: number;
        maxDiscount?: number;
        usageLimit?: number;
        perUserLimit?: number;
        eventId?: string;
        startsAt?: string;
        expiresAt?: string;
        isActive?: boolean;
      };

      if (!code || !name || discountValue === undefined) {
        return reply.status(400).send({
          success: false,
          error: "code, name y discountValue son requeridos",
        });
      }

      // Validate discount value
      if (discountType === "PERCENTAGE" && (discountValue < 0 || discountValue > 100)) {
        return reply.status(400).send({
          success: false,
          error: "El porcentaje debe estar entre 0 y 100",
        });
      }

      // Check if code already exists
      const [existing] = await query<RowDataPacket[]>(
        `SELECT id FROM Coupon WHERE code = ?`,
        [code.toUpperCase()]
      );

      if (existing) {
        return reply.status(409).send({
          success: false,
          error: "Ya existe un cupón con este código",
        });
      }

      const couponId = randomUUID();

      await query(
        `INSERT INTO Coupon (
          id, code, name, description, discountType, discountValue,
          minPurchase, maxDiscount, usageLimit, perUserLimit,
          eventId, startsAt, expiresAt, isActive, createdBy
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          couponId,
          code.toUpperCase(),
          name,
          description || null,
          discountType,
          discountValue,
          minPurchase || null,
          maxDiscount || null,
          usageLimit || null,
          perUserLimit,
          eventId || null,
          startsAt ? new Date(startsAt) : null,
          expiresAt ? new Date(expiresAt) : null,
          isActive,
          currentUser.id,
        ]
      );

      return reply.status(201).send({
        success: true,
        coupon: {
          id: couponId,
          code: code.toUpperCase(),
          name,
          discountType,
          discountValue,
        },
      });
    },
  });

  // PUT /api/coupons/:id - Update coupon (admin only)
  app.put<{ Params: { id: string } }>("/api/coupons/:id", {
    preHandler: [requireAdmin],
    handler: async (request, reply) => {
      const { id } = request.params;
      const updates = request.body as Partial<{
        name: string;
        description: string;
        discountType: string;
        discountValue: number;
        minPurchase: number;
        maxDiscount: number;
        usageLimit: number;
        perUserLimit: number;
        eventId: string;
        startsAt: string;
        expiresAt: string;
        isActive: boolean;
      }>;

      const [coupon] = await query<RowDataPacket[]>(`SELECT id FROM Coupon WHERE id = ?`, [id]);
      if (!coupon) {
        return reply.status(404).send({
          success: false,
          error: "Cupón no encontrado",
        });
      }

      const setClauses: string[] = [];
      const params: any[] = [];

      if (updates.name !== undefined) {
        setClauses.push("name = ?");
        params.push(updates.name);
      }
      if (updates.description !== undefined) {
        setClauses.push("description = ?");
        params.push(updates.description || null);
      }
      if (updates.discountType !== undefined) {
        setClauses.push("discountType = ?");
        params.push(updates.discountType);
      }
      if (updates.discountValue !== undefined) {
        setClauses.push("discountValue = ?");
        params.push(updates.discountValue);
      }
      if (updates.minPurchase !== undefined) {
        setClauses.push("minPurchase = ?");
        params.push(updates.minPurchase || null);
      }
      if (updates.maxDiscount !== undefined) {
        setClauses.push("maxDiscount = ?");
        params.push(updates.maxDiscount || null);
      }
      if (updates.usageLimit !== undefined) {
        setClauses.push("usageLimit = ?");
        params.push(updates.usageLimit || null);
      }
      if (updates.perUserLimit !== undefined) {
        setClauses.push("perUserLimit = ?");
        params.push(updates.perUserLimit);
      }
      if (updates.eventId !== undefined) {
        setClauses.push("eventId = ?");
        params.push(updates.eventId || null);
      }
      if (updates.startsAt !== undefined) {
        setClauses.push("startsAt = ?");
        params.push(updates.startsAt ? new Date(updates.startsAt) : null);
      }
      if (updates.expiresAt !== undefined) {
        setClauses.push("expiresAt = ?");
        params.push(updates.expiresAt ? new Date(updates.expiresAt) : null);
      }
      if (updates.isActive !== undefined) {
        setClauses.push("isActive = ?");
        params.push(updates.isActive);
      }

      if (setClauses.length === 0) {
        return reply.status(400).send({
          success: false,
          error: "No hay campos para actualizar",
        });
      }

      setClauses.push("updatedAt = NOW()");
      params.push(id);

      await query(`UPDATE Coupon SET ${setClauses.join(", ")} WHERE id = ?`, params);

      return reply.send({
        success: true,
        message: "Cupón actualizado",
      });
    },
  });

  // DELETE /api/coupons/:id - Delete coupon (admin only)
  app.delete<{ Params: { id: string } }>("/api/coupons/:id", {
    preHandler: [requireAdmin],
    handler: async (request, reply) => {
      const { id } = request.params;

      const [coupon] = await query<RowDataPacket[]>(`SELECT id, usedCount FROM Coupon WHERE id = ?`, [
        id,
      ]);

      if (!coupon) {
        return reply.status(404).send({
          success: false,
          error: "Cupón no encontrado",
        });
      }

      // If coupon has been used, just deactivate it
      if (coupon.usedCount > 0) {
        await query(`UPDATE Coupon SET isActive = false, updatedAt = NOW() WHERE id = ?`, [id]);
        return reply.send({
          success: true,
          message: "Cupón desactivado (ya ha sido usado)",
          deactivated: true,
        });
      }

      // Delete coupon and its usage records
      await withTransaction(async (connection) => {
        await connection.query(`DELETE FROM CouponUsage WHERE couponId = ?`, [id]);
        await connection.query(`DELETE FROM Coupon WHERE id = ?`, [id]);
      });

      return reply.send({
        success: true,
        message: "Cupón eliminado",
      });
    },
  });

  // POST /api/coupons/validate - Validate a coupon code (public, requires auth)
  app.post("/api/coupons/validate", {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const currentUser = (request as any).user;
      const { code, subtotal, eventId } = request.body as {
        code: string;
        subtotal: number;
        eventId?: string;
      };

      if (!code || subtotal === undefined) {
        return reply.status(400).send({
          success: false,
          error: "code y subtotal son requeridos",
        });
      }

      // Find coupon
      const [coupon] = await query<CouponRow[]>(
        `SELECT * FROM Coupon WHERE code = ? AND isActive = true`,
        [code.toUpperCase()]
      );

      if (!coupon) {
        return reply.status(404).send({
          success: false,
          error: "Cupón no válido o expirado",
        });
      }

      // Check if coupon is for a specific event
      if (coupon.eventId && eventId && coupon.eventId !== eventId) {
        return reply.status(400).send({
          success: false,
          error: "Este cupón no es válido para este evento",
        });
      }

      // Check date validity
      const now = new Date();
      if (coupon.startsAt && new Date(coupon.startsAt) > now) {
        return reply.status(400).send({
          success: false,
          error: "Este cupón aún no está activo",
        });
      }
      if (coupon.expiresAt && new Date(coupon.expiresAt) < now) {
        return reply.status(400).send({
          success: false,
          error: "Este cupón ha expirado",
        });
      }

      // Check usage limit
      if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
        return reply.status(400).send({
          success: false,
          error: "Este cupón ha alcanzado su límite de uso",
        });
      }

      // Check per-user limit
      const [userUsage] = await query<RowDataPacket[]>(
        `SELECT COUNT(*) as count FROM CouponUsage WHERE couponId = ? AND userId = ?`,
        [coupon.id, currentUser.id]
      );
      if (userUsage?.count >= coupon.perUserLimit) {
        return reply.status(400).send({
          success: false,
          error: "Ya has usado este cupón el máximo de veces permitido",
        });
      }

      // Check minimum purchase
      if (coupon.minPurchase && subtotal < Number(coupon.minPurchase)) {
        return reply.status(400).send({
          success: false,
          error: `Compra mínima de $${Number(coupon.minPurchase).toFixed(2)} requerida`,
        });
      }

      // Calculate discount
      let discount: number;
      if (coupon.discountType === "PERCENTAGE") {
        discount = subtotal * (Number(coupon.discountValue) / 100);
      } else {
        discount = Number(coupon.discountValue);
      }

      // Apply max discount cap
      if (coupon.maxDiscount && discount > Number(coupon.maxDiscount)) {
        discount = Number(coupon.maxDiscount);
      }

      // Don't let discount exceed subtotal
      discount = Math.min(discount, subtotal);

      return reply.send({
        success: true,
        coupon: {
          id: coupon.id,
          code: coupon.code,
          name: coupon.name,
          discountType: coupon.discountType,
          discountValue: Number(coupon.discountValue),
          discount: Math.round(discount * 100) / 100,
          newTotal: Math.round((subtotal - discount) * 100) / 100,
        },
      });
    },
  });
}
