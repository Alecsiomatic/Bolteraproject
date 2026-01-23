import { FastifyInstance } from "fastify";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { z } from "zod";
import { query, withTransaction } from "../lib/db";
import { randomUUID } from "crypto";
import { requireAdmin } from "../lib/authMiddleware";

type CategoryRow = RowDataPacket & {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  coverImage: string | null;
  sortOrder: number;
  isActive: number;
  createdAt: Date;
  updatedAt: Date;
  eventCount?: number;
};

const categorySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, "Slug must be lowercase with hyphens only"),
  description: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  coverImage: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function categoryRoutes(fastify: FastifyInstance) {
  // List all categories
  fastify.get("/api/categories", async (request, reply) => {
    const { active } = request.query as { active?: string };
    
    let sql = `
      SELECT c.*, COUNT(e.id) as eventCount
      FROM Category c
      LEFT JOIN Event e ON e.categoryId = c.id
    `;
    
    if (active === "true") {
      sql += ` WHERE c.isActive = 1`;
    }
    
    sql += ` GROUP BY c.id ORDER BY c.sortOrder ASC, c.name ASC`;
    
    const categories = await query<CategoryRow[]>(sql);
    
    return reply.send(categories.map(c => ({
      ...c,
      isActive: Boolean(c.isActive),
      eventCount: Number(c.eventCount || 0),
    })));
  });

  // Get single category by slug or id
  fastify.get<{ Params: { idOrSlug: string } }>(
    "/api/categories/:idOrSlug",
    async (request, reply) => {
      const { idOrSlug } = request.params;

      const [category] = await query<CategoryRow[]>(
        `SELECT c.*, COUNT(e.id) as eventCount
         FROM Category c
         LEFT JOIN Event e ON e.categoryId = c.id
         WHERE c.id = ? OR c.slug = ?
         GROUP BY c.id`,
        [idOrSlug, idOrSlug]
      );

      if (!category) {
        return reply.status(404).send({ error: "Category not found" });
      }

      // Get recent published events in this category
      const events = await query<RowDataPacket[]>(
        `SELECT id, name, slug, thumbnailImage, shortDescription
         FROM Event
         WHERE categoryId = ? AND status = 'PUBLISHED'
         ORDER BY publishedAt DESC
         LIMIT 10`,
        [category.id]
      );

      return reply.send({
        ...category,
        isActive: Boolean(category.isActive),
        eventCount: Number(category.eventCount || 0),
        events,
      });
    }
  );

  // Create category - Solo ADMIN
  fastify.post("/api/categories", { preHandler: [requireAdmin] }, async (request, reply) => {
    const parsed = categorySchema.safeParse(request.body);
    
    if (!parsed.success) {
      return reply.status(400).send({ 
        error: "Validation failed", 
        details: parsed.error.flatten() 
      });
    }

    const data = parsed.data;

    // Check for duplicate slug
    const [existing] = await query<CategoryRow[]>(
      `SELECT id FROM Category WHERE slug = ?`,
      [data.slug]
    );

    if (existing) {
      return reply.status(400).send({ error: "A category with this slug already exists" });
    }

    const id = randomUUID();
    const now = new Date();

    await query<ResultSetHeader>(
      `INSERT INTO Category (id, name, slug, description, icon, color, coverImage, sortOrder, isActive, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.name,
        data.slug,
        data.description || null,
        data.icon || null,
        data.color || null,
        data.coverImage || null,
        data.sortOrder ?? 0,
        data.isActive !== false ? 1 : 0,
        now,
        now,
      ]
    );

    const [category] = await query<CategoryRow[]>(
      `SELECT * FROM Category WHERE id = ?`,
      [id]
    );

    return reply.status(201).send({
      ...category,
      isActive: Boolean(category.isActive),
    });
  });

  // Update category - Solo ADMIN
  fastify.put<{ Params: { id: string } }>(
    "/api/categories/:id",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { id } = request.params;
      const parsed = categorySchema.partial().safeParse(request.body);
      
      if (!parsed.success) {
        return reply.status(400).send({ 
          error: "Validation failed", 
          details: parsed.error.flatten() 
        });
      }

      const data = parsed.data;

      // Check if category exists
      const [existing] = await query<CategoryRow[]>(
        `SELECT * FROM Category WHERE id = ?`,
        [id]
      );
      
      if (!existing) {
        return reply.status(404).send({ error: "Category not found" });
      }

      // Check for duplicate slug if slug is being changed
      if (data.slug && data.slug !== existing.slug) {
        const [slugExists] = await query<CategoryRow[]>(
          `SELECT id FROM Category WHERE slug = ? AND id != ?`,
          [data.slug, id]
        );
        if (slugExists) {
          return reply.status(400).send({ error: "A category with this slug already exists" });
        }
      }

      // Build update query dynamically
      const updates: string[] = [];
      const values: unknown[] = [];
      
      if (data.name !== undefined) {
        updates.push("name = ?");
        values.push(data.name);
      }
      if (data.slug !== undefined) {
        updates.push("slug = ?");
        values.push(data.slug);
      }
      if (data.description !== undefined) {
        updates.push("description = ?");
        values.push(data.description);
      }
      if (data.icon !== undefined) {
        updates.push("icon = ?");
        values.push(data.icon);
      }
      if (data.color !== undefined) {
        updates.push("color = ?");
        values.push(data.color);
      }
      if (data.coverImage !== undefined) {
        updates.push("coverImage = ?");
        values.push(data.coverImage);
      }
      if (data.sortOrder !== undefined) {
        updates.push("sortOrder = ?");
        values.push(data.sortOrder);
      }
      if (data.isActive !== undefined) {
        updates.push("isActive = ?");
        values.push(data.isActive ? 1 : 0);
      }
      
      updates.push("updatedAt = ?");
      values.push(new Date());
      values.push(id);

      await query<ResultSetHeader>(
        `UPDATE Category SET ${updates.join(", ")} WHERE id = ?`,
        values
      );

      const [category] = await query<CategoryRow[]>(
        `SELECT * FROM Category WHERE id = ?`,
        [id]
      );

      return reply.send({
        ...category,
        isActive: Boolean(category.isActive),
      });
    }
  );

  // Delete category - Solo ADMIN
  fastify.delete<{ Params: { id: string } }>(
    "/api/categories/:id",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { id } = request.params;

      // Check if category exists and get event count
      const [existing] = await query<CategoryRow[]>(
        `SELECT c.*, COUNT(e.id) as eventCount
         FROM Category c
         LEFT JOIN Event e ON e.categoryId = c.id
         WHERE c.id = ?
         GROUP BY c.id`,
        [id]
      );
      
      if (!existing) {
        return reply.status(404).send({ error: "Category not found" });
      }

      // Don't delete if category has events
      if (existing.eventCount && existing.eventCount > 0) {
        return reply.status(400).send({ 
          error: `Cannot delete category with ${existing.eventCount} events. Remove or reassign events first.` 
        });
      }

      await query<ResultSetHeader>(
        `DELETE FROM Category WHERE id = ?`,
        [id]
      );

      return reply.send({ success: true, message: "Category deleted" });
    }
  );

  // Reorder categories
  fastify.post("/api/categories/reorder", async (request, reply) => {
    const schema = z.object({
      order: z.array(z.object({
        id: z.string(),
        sortOrder: z.number().int(),
      })),
    });

    const parsed = schema.safeParse(request.body);
    
    if (!parsed.success) {
      return reply.status(400).send({ 
        error: "Validation failed", 
        details: parsed.error.flatten() 
      });
    }

    await withTransaction(async (conn) => {
      for (const { id, sortOrder } of parsed.data.order) {
        await conn.execute(
          `UPDATE Category SET sortOrder = ?, updatedAt = ? WHERE id = ?`,
          [sortOrder, new Date(), id]
        );
      }
    });

    return reply.send({ success: true, message: "Categories reordered" });
  });
}
