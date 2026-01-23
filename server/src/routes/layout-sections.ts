import { randomUUID } from "crypto";
import { FastifyInstance } from "fastify";
import { RowDataPacket } from "mysql2";
import { z } from "zod";
import { query, withTransaction } from "../lib/db";
import { requireAdmin, requireOperator } from "../lib/authMiddleware";

// Types
type LayoutSectionRow = RowDataPacket & {
  id: string;
  parentLayoutId: string;
  zoneId: string | null;
  name: string;
  description: string | null;
  color: string | null;
  polygonPoints: string; // JSON string
  labelPosition: string | null; // JSON string
  capacity: number;
  displayOrder: number;
  isActive: number;
  hoverColor: string | null;
  selectedColor: string | null;
  thumbnailUrl: string | null;
  metadata: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type VenueLayoutRow = RowDataPacket & {
  id: string;
  venueId: string;
  eventId: string | null;
  name: string;
  layoutType: string;
  parentLayoutId: string | null;
  sectionId: string | null;
  metadata: string | null;
};

// Schemas
const pointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const createSectionSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  description: z.string().optional(),
  zoneId: z.string().optional(),
  color: z.string().default("#3B82F6"),
  polygonPoints: z.array(pointSchema).min(3, "Se requieren al menos 3 puntos"),
  labelPosition: pointSchema.optional(),
  capacity: z.number().int().min(0).default(0),
  displayOrder: z.number().int().default(0),
  hoverColor: z.string().optional(),
  selectedColor: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const updateSectionSchema = createSectionSchema.partial();

const toISO = (value: Date | string | null) =>
  value instanceof Date ? value.toISOString() : value;

// Helper to parse JSON safely
const safeParseJson = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

// Format section for response
const formatSection = (row: LayoutSectionRow) => ({
  id: row.id,
  parentLayoutId: row.parentLayoutId,
  zoneId: row.zoneId,
  name: row.name,
  description: row.description,
  color: row.color,
  polygonPoints: safeParseJson(row.polygonPoints, []),
  labelPosition: safeParseJson(row.labelPosition, null),
  capacity: row.capacity,
  displayOrder: row.displayOrder,
  isActive: Boolean(row.isActive),
  hoverColor: row.hoverColor,
  selectedColor: row.selectedColor,
  thumbnailUrl: row.thumbnailUrl,
  metadata: safeParseJson(row.metadata, {}),
  createdAt: toISO(row.createdAt),
  updatedAt: toISO(row.updatedAt),
});

export default async function layoutSectionsRoutes(app: FastifyInstance) {
  // ============================================
  // GET /layouts/:layoutId/sections - List sections in a parent layout
  // ============================================
  app.get<{
    Params: { layoutId: string };
  }>(
    "/layouts/:layoutId/sections",
    {
      preHandler: [requireOperator],
    },
    async (request, reply) => {
      const { layoutId } = request.params;

      // Verify layout exists and is a parent type
      const [layouts] = await query<VenueLayoutRow[]>(
        `SELECT id, layoutType FROM VenueLayout WHERE id = ?`,
        [layoutId]
      );

      if (layouts.length === 0) {
        return reply.code(404).send({ error: "Layout no encontrado" });
      }

      // Get all sections for this layout
      const [sections] = await query<LayoutSectionRow[]>(
        `SELECT * FROM LayoutSection 
         WHERE parentLayoutId = ? 
         ORDER BY displayOrder, name`,
        [layoutId]
      );

      // For each section, get the child layout info if it exists
      const sectionsWithLayouts = await Promise.all(
        sections.map(async (section: LayoutSectionRow) => {
          const [childLayouts] = await query<VenueLayoutRow[]>(
            `SELECT id, name, layoutType FROM VenueLayout 
             WHERE sectionId = ?`,
            [section.id]
          );

          const formatted = formatSection(section);
          return {
            ...formatted,
            childLayout: childLayouts[0] || null,
          };
        })
      );

      return reply.send({
        layoutId,
        sections: sectionsWithLayouts,
      });
    }
  );

  // ============================================
  // POST /layouts/:layoutId/sections - Create a new section
  // ============================================
  app.post<{
    Params: { layoutId: string };
    Body: z.infer<typeof createSectionSchema>;
  }>(
    "/layouts/:layoutId/sections",
    {
      preHandler: [requireOperator],
    },
    async (request, reply) => {
      const { layoutId } = request.params;
      const parsed = createSectionSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          error: "Datos inválidos",
          details: parsed.error.flatten(),
        });
      }

      const data = parsed.data;

      // Verify layout exists
      const [layouts] = await query<VenueLayoutRow[]>(
        `SELECT id, venueId, layoutType FROM VenueLayout WHERE id = ?`,
        [layoutId]
      );

      if (layouts.length === 0) {
        return reply.code(404).send({ error: "Layout no encontrado" });
      }

      const layout = layouts[0];

      // If layout is not already a parent, convert it
      if (layout.layoutType !== "parent") {
        await query(
          `UPDATE VenueLayout SET layoutType = 'parent', updatedAt = NOW() WHERE id = ?`,
          [layoutId]
        );
      }

      const sectionId = randomUUID();
      const now = new Date();

      await query(
        `INSERT INTO LayoutSection (
          id, parentLayoutId, zoneId, name, description, color,
          polygonPoints, labelPosition, capacity, displayOrder,
          isActive, hoverColor, selectedColor, thumbnailUrl, metadata,
          createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sectionId,
          layoutId,
          data.zoneId || null,
          data.name,
          data.description || null,
          data.color,
          JSON.stringify(data.polygonPoints),
          data.labelPosition ? JSON.stringify(data.labelPosition) : null,
          data.capacity,
          data.displayOrder,
          true,
          data.hoverColor || "#60A5FA",
          data.selectedColor || "#2563EB",
          data.thumbnailUrl || null,
          data.metadata ? JSON.stringify(data.metadata) : null,
          now,
          now,
        ]
      );

      // Return the created section
      const [sections] = await query<LayoutSectionRow[]>(
        `SELECT * FROM LayoutSection WHERE id = ?`,
        [sectionId]
      );

      return reply.code(201).send(formatSection(sections[0]));
    }
  );

  // ============================================
  // PUT /layouts/:layoutId/sections/:sectionId - Update a section
  // ============================================
  app.put<{
    Params: { layoutId: string; sectionId: string };
    Body: z.infer<typeof updateSectionSchema>;
  }>(
    "/layouts/:layoutId/sections/:sectionId",
    {
      preHandler: [requireOperator],
    },
    async (request, reply) => {
      const { layoutId, sectionId } = request.params;
      const parsed = updateSectionSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          error: "Datos inválidos",
          details: parsed.error.flatten(),
        });
      }

      const data = parsed.data;

      // Verify section exists
      const [sections] = await query<LayoutSectionRow[]>(
        `SELECT * FROM LayoutSection WHERE id = ? AND parentLayoutId = ?`,
        [sectionId, layoutId]
      );

      if (sections.length === 0) {
        return reply.code(404).send({ error: "Sección no encontrada" });
      }

      // Build dynamic update query
      const updates: string[] = [];
      const values: any[] = [];

      if (data.name !== undefined) {
        updates.push("name = ?");
        values.push(data.name);
      }
      if (data.description !== undefined) {
        updates.push("description = ?");
        values.push(data.description);
      }
      if (data.zoneId !== undefined) {
        updates.push("zoneId = ?");
        values.push(data.zoneId);
      }
      if (data.color !== undefined) {
        updates.push("color = ?");
        values.push(data.color);
      }
      if (data.polygonPoints !== undefined) {
        updates.push("polygonPoints = ?");
        values.push(JSON.stringify(data.polygonPoints));
      }
      if (data.labelPosition !== undefined) {
        updates.push("labelPosition = ?");
        values.push(JSON.stringify(data.labelPosition));
      }
      if (data.capacity !== undefined) {
        updates.push("capacity = ?");
        values.push(data.capacity);
      }
      if (data.displayOrder !== undefined) {
        updates.push("displayOrder = ?");
        values.push(data.displayOrder);
      }
      if (data.hoverColor !== undefined) {
        updates.push("hoverColor = ?");
        values.push(data.hoverColor);
      }
      if (data.selectedColor !== undefined) {
        updates.push("selectedColor = ?");
        values.push(data.selectedColor);
      }
      if (data.thumbnailUrl !== undefined) {
        updates.push("thumbnailUrl = ?");
        values.push(data.thumbnailUrl);
      }
      if (data.metadata !== undefined) {
        updates.push("metadata = ?");
        values.push(JSON.stringify(data.metadata));
      }

      if (updates.length > 0) {
        updates.push("updatedAt = NOW()");
        values.push(sectionId);

        await query(
          `UPDATE LayoutSection SET ${updates.join(", ")} WHERE id = ?`,
          values
        );
      }

      // Return updated section
      const [updated] = await query<LayoutSectionRow[]>(
        `SELECT * FROM LayoutSection WHERE id = ?`,
        [sectionId]
      );

      return reply.send(formatSection(updated[0]));
    }
  );

  // ============================================
  // DELETE /layouts/:layoutId/sections/:sectionId - Delete a section
  // ============================================
  app.delete<{
    Params: { layoutId: string; sectionId: string };
  }>(
    "/layouts/:layoutId/sections/:sectionId",
    {
      preHandler: [requireOperator],
    },
    async (request, reply) => {
      const { layoutId, sectionId } = request.params;

      // Verify section exists
      const [sections] = await query<LayoutSectionRow[]>(
        `SELECT id FROM LayoutSection WHERE id = ? AND parentLayoutId = ?`,
        [sectionId, layoutId]
      );

      if (sections.length === 0) {
        return reply.code(404).send({ error: "Sección no encontrada" });
      }

      // Delete associated child layout if exists
      await query(
        `DELETE FROM VenueLayout WHERE sectionId = ?`,
        [sectionId]
      );

      // Delete section
      await query(
        `DELETE FROM LayoutSection WHERE id = ?`,
        [sectionId]
      );

      return reply.code(204).send();
    }
  );

  // ============================================
  // POST /layouts/:layoutId/sections/:sectionId/child-layout - Create child layout for section
  // ============================================
  app.post<{
    Params: { layoutId: string; sectionId: string };
    Body: {
      name?: string;
      layoutJson?: any;
      metadata?: any;
    };
  }>(
    "/layouts/:layoutId/sections/:sectionId/child-layout",
    {
      preHandler: [requireOperator],
    },
    async (request, reply) => {
      const { layoutId, sectionId } = request.params;
      const { name, layoutJson, metadata } = request.body;

      // Verify section exists
      const [sections] = await query<LayoutSectionRow[]>(
        `SELECT * FROM LayoutSection WHERE id = ? AND parentLayoutId = ?`,
        [sectionId, layoutId]
      );

      if (sections.length === 0) {
        return reply.code(404).send({ error: "Sección no encontrada" });
      }

      const section = sections[0];

      // Get parent layout to get venueId
      const [parentLayouts] = await query<VenueLayoutRow[]>(
        `SELECT venueId, eventId FROM VenueLayout WHERE id = ?`,
        [layoutId]
      );

      if (parentLayouts.length === 0) {
        return reply.code(404).send({ error: "Layout padre no encontrado" });
      }

      const parentLayout = parentLayouts[0];

      // Check if child layout already exists
      const [existingLayouts] = await query<VenueLayoutRow[]>(
        `SELECT id FROM VenueLayout WHERE sectionId = ?`,
        [sectionId]
      );

      if (existingLayouts.length > 0) {
        return reply.code(400).send({ 
          error: "Esta sección ya tiene un layout hijo",
          childLayoutId: existingLayouts[0].id,
        });
      }

      // Create child layout
      const childLayoutId = randomUUID();
      const now = new Date();

      await query(
        `INSERT INTO VenueLayout (
          id, venueId, eventId, name, version, layoutJson, metadata,
          isDefault, isTemplate, layoutType, parentLayoutId, sectionId,
          createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          childLayoutId,
          parentLayout.venueId,
          null, // Child layouts don't have events directly
          name || `${section.name} - Layout`,
          1,
          layoutJson ? JSON.stringify(layoutJson) : null,
          metadata ? JSON.stringify(metadata) : null,
          false,
          false,
          "section",
          layoutId,
          sectionId,
          now,
          now,
        ]
      );

      // Return created child layout
      const [childLayouts] = await query<VenueLayoutRow[]>(
        `SELECT * FROM VenueLayout WHERE id = ?`,
        [childLayoutId]
      );

      const child = childLayouts[0];

      return reply.code(201).send({
        id: child.id,
        venueId: child.venueId,
        name: child.name,
        layoutType: child.layoutType,
        parentLayoutId: child.parentLayoutId,
        sectionId: child.sectionId,
        layoutJson: safeParseJson(child.metadata, {}),
      });
    }
  );

  // ============================================
  // GET /layouts/:layoutId/hierarchy - Get full layout hierarchy
  // ============================================
  app.get<{
    Params: { layoutId: string };
  }>(
    "/layouts/:layoutId/hierarchy",
    async (request, reply) => {
      const { layoutId } = request.params;

      // Get the parent layout
      const [layouts] = await query<VenueLayoutRow[]>(
        `SELECT * FROM VenueLayout WHERE id = ?`,
        [layoutId]
      );

      if (layouts.length === 0) {
        return reply.code(404).send({ error: "Layout no encontrado" });
      }

      const layout = layouts[0];

      // Get all sections with their child layouts
      const [sections] = await query<LayoutSectionRow[]>(
        `SELECT * FROM LayoutSection 
         WHERE parentLayoutId = ? 
         ORDER BY displayOrder, name`,
        [layoutId]
      );

      const sectionsWithChildren = await Promise.all(
        sections.map(async (section: LayoutSectionRow) => {
          // Get child layout
          const [childLayouts] = await query<VenueLayoutRow[]>(
            `SELECT * FROM VenueLayout WHERE sectionId = ?`,
            [section.id]
          );

          const childLayout = childLayouts[0];

          // Get seat count for child layout if exists
          let seatCount = 0;
          let availableSeats = 0;

          if (childLayout) {
            const [seatStats] = await query<RowDataPacket[]>(
              `SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'AVAILABLE' THEN 1 ELSE 0 END) as available
               FROM Seat WHERE layoutId = ?`,
              [childLayout.id]
            );

            if (seatStats[0]) {
              seatCount = seatStats[0].total || 0;
              availableSeats = seatStats[0].available || 0;
            }
          }

          return {
            ...formatSection(section),
            childLayout: childLayout
              ? {
                  id: childLayout.id,
                  name: childLayout.name,
                  layoutType: childLayout.layoutType,
                }
              : null,
            stats: {
              totalSeats: seatCount,
              availableSeats,
            },
          };
        })
      );

      return reply.send({
        layout: {
          id: layout.id,
          venueId: layout.venueId,
          name: layout.name,
          layoutType: layout.layoutType,
          metadata: safeParseJson(layout.metadata, {}),
        },
        sections: sectionsWithChildren,
        stats: {
          totalSections: sections.length,
          totalSeats: sectionsWithChildren.reduce((sum, s) => sum + s.stats.totalSeats, 0),
          totalAvailable: sectionsWithChildren.reduce((sum, s) => sum + s.stats.availableSeats, 0),
        },
      });
    }
  );

  // ============================================
  // POST /layouts/:layoutId/sections/bulk - Create multiple sections at once
  // ============================================
  app.post<{
    Params: { layoutId: string };
    Body: { sections: z.infer<typeof createSectionSchema>[] };
  }>(
    "/layouts/:layoutId/sections/bulk",
    {
      preHandler: [requireOperator],
    },
    async (request, reply) => {
      const { layoutId } = request.params;
      const { sections: sectionsData } = request.body;

      if (!Array.isArray(sectionsData) || sectionsData.length === 0) {
        return reply.code(400).send({ error: "Se requiere al menos una sección" });
      }

      // Verify layout exists
      const [layouts] = await query<VenueLayoutRow[]>(
        `SELECT id, venueId, layoutType FROM VenueLayout WHERE id = ?`,
        [layoutId]
      );

      if (layouts.length === 0) {
        return reply.code(404).send({ error: "Layout no encontrado" });
      }

      // Validate all sections
      const validatedSections = sectionsData.map((s, index) => {
        const parsed = createSectionSchema.safeParse(s);
        if (!parsed.success) {
          throw new Error(`Sección ${index + 1}: ${JSON.stringify(parsed.error.flatten())}`);
        }
        return parsed.data;
      });

      // Update layout type if needed
      const layout = layouts[0];
      if (layout.layoutType !== "parent") {
        await query(
          `UPDATE VenueLayout SET layoutType = 'parent', updatedAt = NOW() WHERE id = ?`,
          [layoutId]
        );
      }

      // Create all sections
      const createdSections: any[] = [];
      const now = new Date();

      for (const data of validatedSections) {
        const sectionId = randomUUID();

        await query(
          `INSERT INTO LayoutSection (
            id, parentLayoutId, zoneId, name, description, color,
            polygonPoints, labelPosition, capacity, displayOrder,
            isActive, hoverColor, selectedColor, thumbnailUrl, metadata,
            createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            sectionId,
            layoutId,
            data.zoneId || null,
            data.name,
            data.description || null,
            data.color,
            JSON.stringify(data.polygonPoints),
            data.labelPosition ? JSON.stringify(data.labelPosition) : null,
            data.capacity,
            data.displayOrder,
            true,
            data.hoverColor || "#60A5FA",
            data.selectedColor || "#2563EB",
            data.thumbnailUrl || null,
            data.metadata ? JSON.stringify(data.metadata) : null,
            now,
            now,
          ]
        );

        const [created] = await query<LayoutSectionRow[]>(
          `SELECT * FROM LayoutSection WHERE id = ?`,
          [sectionId]
        );

        createdSections.push(formatSection(created[0]));
      }

      return reply.code(201).send({
        layoutId,
        sections: createdSections,
      });
    }
  );

  // ============================================
  // PUT /layouts/:layoutId/sections/reorder - Reorder sections
  // ============================================
  app.put<{
    Params: { layoutId: string };
    Body: { sectionIds: string[] };
  }>(
    "/layouts/:layoutId/sections/reorder",
    {
      preHandler: [requireOperator],
    },
    async (request, reply) => {
      const { layoutId } = request.params;
      const { sectionIds } = request.body;

      if (!Array.isArray(sectionIds)) {
        return reply.code(400).send({ error: "Se requiere un array de IDs" });
      }

      // Update display order for each section
      for (let i = 0; i < sectionIds.length; i++) {
        await query(
          `UPDATE LayoutSection SET displayOrder = ?, updatedAt = NOW() 
           WHERE id = ? AND parentLayoutId = ?`,
          [i, sectionIds[i], layoutId]
        );
      }

      // Return updated sections
      const [sections] = await query<LayoutSectionRow[]>(
        `SELECT * FROM LayoutSection 
         WHERE parentLayoutId = ? 
         ORDER BY displayOrder, name`,
        [layoutId]
      );

      return reply.send({
        layoutId,
        sections: sections.map(formatSection),
      });
    }
  );
}
