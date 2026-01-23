import { randomUUID } from "crypto";
import { FastifyInstance } from "fastify";
import { RowDataPacket } from "mysql2";
import { z } from "zod";
import { query } from "../lib/db";

type ProductRow = RowDataPacket & {
  id: string;
  venueId: string;
  type: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  stock: number | null;
  isActive: boolean;
  metadata: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export default async function productsRoutes(app: FastifyInstance) {
  // GET /api/venues/:venueId/products - List products
  app.get("/api/venues/:venueId/products", async (request, reply) => {
    const paramsSchema = z.object({ venueId: z.string() });
    const querySchema = z.object({
      type: z.enum(["food", "beverage", "parking", "merchandise", "gift", "other"]).optional(),
      isActive: z.enum(["true", "false"]).optional(),
    });

    const { venueId } = paramsSchema.parse(request.params);
    const filters = querySchema.parse(request.query);

    let sql = `SELECT * FROM VenueProduct WHERE venueId = ?`;
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

    const products = await query<ProductRow[]>(sql, params);

    return reply.send(
      products.map((p) => ({
        ...p,
        metadata: p.metadata ? JSON.parse(p.metadata) : null,
      }))
    );
  });

  // GET /api/venues/:venueId/products/:productId - Get product
  app.get("/api/venues/:venueId/products/:productId", async (request, reply) => {
    const paramsSchema = z.object({
      venueId: z.string(),
      productId: z.string(),
    });

    const { venueId, productId } = paramsSchema.parse(request.params);

    const [product] = await query<ProductRow[]>(
      `SELECT * FROM VenueProduct WHERE id = ? AND venueId = ?`,
      [productId, venueId]
    );

    if (!product) {
      return reply.code(404).send({ error: "Producto no encontrado" });
    }

    return reply.send({
      ...product,
      metadata: product.metadata ? JSON.parse(product.metadata) : null,
    });
  });

  // POST /api/venues/:venueId/products - Create product
  app.post("/api/venues/:venueId/products", async (request, reply) => {
    const paramsSchema = z.object({ venueId: z.string() });
    const bodySchema = z.object({
      type: z.enum(["food", "beverage", "parking", "merchandise", "gift", "other"]),
      name: z.string().min(1).max(100),
      description: z.string().optional(),
      price: z.number().min(0),
      currency: z.string().default("MXN"),
      stock: z.number().int().min(0).nullable().optional(),
      isActive: z.boolean().default(true),
      metadata: z.record(z.unknown()).optional(),
    });

    const { venueId } = paramsSchema.parse(request.params);
    const data = bodySchema.parse(request.body);

    const productId = randomUUID();

    await query(
      `INSERT INTO VenueProduct (id, venueId, type, name, description, price, currency, stock, isActive, metadata, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        productId,
        venueId,
        data.type,
        data.name,
        data.description ?? null,
        data.price,
        data.currency,
        data.stock ?? null,
        data.isActive ? 1 : 0,
        data.metadata ? JSON.stringify(data.metadata) : null,
      ]
    );

    return reply.code(201).send({
      id: productId,
      message: "Producto creado",
    });
  });

  // PUT /api/venues/:venueId/products/:productId - Update product
  app.put("/api/venues/:venueId/products/:productId", async (request, reply) => {
    const paramsSchema = z.object({
      venueId: z.string(),
      productId: z.string(),
    });
    const bodySchema = z.object({
      type: z.enum(["food", "beverage", "parking", "merchandise", "gift", "other"]).optional(),
      name: z.string().min(1).max(100).optional(),
      description: z.string().nullable().optional(),
      price: z.number().min(0).optional(),
      currency: z.string().optional(),
      stock: z.number().int().min(0).nullable().optional(),
      isActive: z.boolean().optional(),
      metadata: z.record(z.unknown()).nullable().optional(),
    });

    const { venueId, productId } = paramsSchema.parse(request.params);
    const data = bodySchema.parse(request.body);

    // Check if product exists
    const [existing] = await query<ProductRow[]>(
      `SELECT id FROM VenueProduct WHERE id = ? AND venueId = ?`,
      [productId, venueId]
    );

    if (!existing) {
      return reply.code(404).send({ error: "Producto no encontrado" });
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (data.type !== undefined) {
      updates.push("type = ?");
      params.push(data.type);
    }
    if (data.name !== undefined) {
      updates.push("name = ?");
      params.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push("description = ?");
      params.push(data.description);
    }
    if (data.price !== undefined) {
      updates.push("price = ?");
      params.push(data.price);
    }
    if (data.currency !== undefined) {
      updates.push("currency = ?");
      params.push(data.currency);
    }
    if (data.stock !== undefined) {
      updates.push("stock = ?");
      params.push(data.stock);
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
    params.push(productId, venueId);

    await query(
      `UPDATE VenueProduct SET ${updates.join(", ")} WHERE id = ? AND venueId = ?`,
      params
    );

    return reply.send({ message: "Producto actualizado" });
  });

  // DELETE /api/venues/:venueId/products/:productId - Delete product
  app.delete("/api/venues/:venueId/products/:productId", async (request, reply) => {
    const paramsSchema = z.object({
      venueId: z.string(),
      productId: z.string(),
    });

    const { venueId, productId } = paramsSchema.parse(request.params);

    const result = await query(
      `DELETE FROM VenueProduct WHERE id = ? AND venueId = ?`,
      [productId, venueId]
    );

    if ((result as any).affectedRows === 0) {
      return reply.code(404).send({ error: "Producto no encontrado" });
    }

    return reply.send({ message: "Producto eliminado" });
  });

  // POST /api/venues/:venueId/products/bulk - Bulk create products
  app.post("/api/venues/:venueId/products/bulk", async (request, reply) => {
    const paramsSchema = z.object({ venueId: z.string() });
    const bodySchema = z.object({
      products: z.array(
        z.object({
          type: z.enum(["food", "beverage", "parking", "merchandise", "gift", "other"]),
          name: z.string().min(1).max(100),
          description: z.string().optional(),
          price: z.number().min(0),
          currency: z.string().default("MXN"),
          stock: z.number().int().min(0).nullable().optional(),
          isActive: z.boolean().default(true),
          metadata: z.record(z.unknown()).optional(),
        })
      ),
    });

    const { venueId } = paramsSchema.parse(request.params);
    const { products } = bodySchema.parse(request.body);

    const insertPromises = products.map((product) => {
      const productId = randomUUID();
      return query(
        `INSERT INTO VenueProduct (id, venueId, type, name, description, price, currency, stock, isActive, metadata, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          productId,
          venueId,
          product.type,
          product.name,
          product.description ?? null,
          product.price,
          product.currency ?? "MXN",
          product.stock ?? null,
          product.isActive !== false ? 1 : 0,
          product.metadata ? JSON.stringify(product.metadata) : null,
        ]
      );
    });

    await Promise.all(insertPromises);

    return reply.code(201).send({
      count: products.length,
      message: `${products.length} productos creados`,
    });
  });
}
