import { FastifyInstance } from "fastify";
import { RowDataPacket } from "mysql2";
import { randomUUID } from "crypto";
import { query } from "../lib/db";
import { requireAuth, requireAdmin } from "../lib/authMiddleware";
import { z } from "zod";

interface SettingRow extends RowDataPacket {
  id: string;
  key: string;
  value: string;
  category: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Configuraciones por defecto del sistema
const defaultSettings: Record<string, { value: string; category: string; description: string }> = {
  // General
  "app.name": { value: "Boletera", category: "general", description: "Nombre de la aplicación" },
  "app.description": { value: "Sistema de venta de boletos", category: "general", description: "Descripción de la aplicación" },
  "app.logo": { value: "", category: "general", description: "URL del logo" },
  "app.favicon": { value: "", category: "general", description: "URL del favicon" },
  "app.primaryColor": { value: "#00d4ff", category: "general", description: "Color primario" },
  
  // Tickets
  "tickets.reservationTimeout": { value: "900", category: "tickets", description: "Tiempo de reserva en segundos (default: 15 min)" },
  "tickets.maxPerPurchase": { value: "10", category: "tickets", description: "Máximo de boletos por compra" },
  "tickets.allowTransfer": { value: "true", category: "tickets", description: "Permitir transferencia de boletos" },
  
  // Pagos
  "payments.currency": { value: "MXN", category: "payments", description: "Moneda por defecto" },
  "payments.testMode": { value: "true", category: "payments", description: "Modo de prueba de pagos" },
  "payments.serviceFee": { value: "0", category: "payments", description: "Cargo por servicio (%)" },
  
  // Email
  "email.fromName": { value: "Boletera", category: "email", description: "Nombre remitente" },
  "email.fromEmail": { value: "noreply@boletera.com", category: "email", description: "Email remitente" },
  "email.sendConfirmation": { value: "true", category: "email", description: "Enviar email de confirmación" },
  "email.sendReminder": { value: "true", category: "email", description: "Enviar recordatorios" },
  "email.reminderHours": { value: "24", category: "email", description: "Horas antes para recordatorio" },
  
  // Seguridad
  "security.requireEmailVerification": { value: "false", category: "security", description: "Requerir verificación de email" },
  "security.allowRegistration": { value: "true", category: "security", description: "Permitir registro público" },
  "security.sessionTimeout": { value: "86400", category: "security", description: "Duración de sesión en segundos" },
};

// Crear tabla si no existe
async function ensureSettingsTable() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS Setting (
        id VARCHAR(36) PRIMARY KEY,
        \`key\` VARCHAR(100) NOT NULL UNIQUE,
        value TEXT NOT NULL,
        category VARCHAR(50) NOT NULL DEFAULT 'general',
        description VARCHAR(255),
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_category (category)
      )
    `);
  } catch (err) {
    console.error("[Settings] Error creating table:", err);
  }
}

export async function settingsRoutes(app: FastifyInstance) {
  await ensureSettingsTable();

  // GET /api/settings - Obtener todas las configuraciones (admin)
  app.get("/api/settings", {
    preHandler: [requireAuth, requireAdmin],
    handler: async (request, reply) => {
      const settings = await query<SettingRow[]>(
        `SELECT * FROM Setting ORDER BY category, \`key\``
      );

      // Combinar con defaults para incluir settings que no existen en DB
      const settingsMap = new Map(settings.map(s => [s.key, s]));
      const result: Record<string, any> = {};

      // Agrupar por categoría
      for (const [key, def] of Object.entries(defaultSettings)) {
        const category = def.category;
        if (!result[category]) {
          result[category] = {};
        }
        
        const dbSetting = settingsMap.get(key);
        result[category][key] = {
          key,
          value: dbSetting?.value ?? def.value,
          description: def.description,
          isDefault: !dbSetting,
        };
      }

      // Agregar settings personalizados que no están en defaults
      for (const setting of settings) {
        if (!defaultSettings[setting.key]) {
          const category = setting.category || "custom";
          if (!result[category]) {
            result[category] = {};
          }
          result[category][setting.key] = {
            key: setting.key,
            value: setting.value,
            description: setting.description,
            isDefault: false,
          };
        }
      }

      return reply.send({ success: true, settings: result });
    },
  });

  // GET /api/settings/public - Configuraciones públicas (sin auth)
  app.get("/api/settings/public", async (request, reply) => {
    const publicKeys = [
      "app.name",
      "app.description",
      "app.logo",
      "app.logoSize",
      "app.primaryColor",
      "tickets.maxPerPurchase",
      "payments.currency",
      "security.allowRegistration",
    ];

    const settings = await query<SettingRow[]>(
      `SELECT \`key\`, value FROM Setting WHERE \`key\` IN (${publicKeys.map(() => "?").join(",")})`,
      publicKeys
    );

    const settingsMap = new Map(settings.map(s => [s.key, s.value]));
    const result: Record<string, string> = {};

    for (const key of publicKeys) {
      result[key] = settingsMap.get(key) ?? defaultSettings[key]?.value ?? "";
    }

    return reply.send({ success: true, settings: result });
  });

  // PUT /api/settings - Actualizar configuraciones
  app.put("/api/settings", {
    preHandler: [requireAuth, requireAdmin],
    handler: async (request, reply) => {
      const updates = request.body as Record<string, string>;

      if (!updates || typeof updates !== "object") {
        return reply.status(400).send({ success: false, error: "Datos inválidos" });
      }

      const results: { key: string; success: boolean }[] = [];

      for (const [key, value] of Object.entries(updates)) {
        try {
          // Verificar si existe
          const [existing] = await query<SettingRow[]>(
            `SELECT id FROM Setting WHERE \`key\` = ? LIMIT 1`,
            [key]
          );

          if (existing) {
            // Actualizar
            await query(
              `UPDATE Setting SET value = ?, updatedAt = NOW() WHERE \`key\` = ?`,
              [String(value), key]
            );
          } else {
            // Insertar
            const def = defaultSettings[key];
            await query(
              `INSERT INTO Setting (id, \`key\`, value, category, description, createdAt, updatedAt)
               VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
              [
                randomUUID(),
                key,
                String(value),
                def?.category || "custom",
                def?.description || null,
              ]
            );
          }

          results.push({ key, success: true });
        } catch (err) {
          console.error(`[Settings] Error updating ${key}:`, err);
          results.push({ key, success: false });
        }
      }

      return reply.send({ success: true, results });
    },
  });

  // PUT /api/settings/:key - Actualizar una configuración específica
  app.put<{ Params: { key: string } }>("/api/settings/:key", {
    preHandler: [requireAuth, requireAdmin],
    handler: async (request, reply) => {
      const { key } = request.params;
      const { value } = request.body as { value: string };

      if (value === undefined) {
        return reply.status(400).send({ success: false, error: "value es requerido" });
      }

      const [existing] = await query<SettingRow[]>(
        `SELECT id FROM Setting WHERE \`key\` = ? LIMIT 1`,
        [key]
      );

      if (existing) {
        await query(
          `UPDATE Setting SET value = ?, updatedAt = NOW() WHERE \`key\` = ?`,
          [String(value), key]
        );
      } else {
        const def = defaultSettings[key];
        await query(
          `INSERT INTO Setting (id, \`key\`, value, category, description, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            randomUUID(),
            key,
            String(value),
            def?.category || "custom",
            def?.description || null,
          ]
        );
      }

      return reply.send({ success: true, key, value });
    },
  });

  // DELETE /api/settings/:key - Eliminar configuración (volver a default)
  app.delete<{ Params: { key: string } }>("/api/settings/:key", {
    preHandler: [requireAuth, requireAdmin],
    handler: async (request, reply) => {
      const { key } = request.params;

      await query(`DELETE FROM Setting WHERE \`key\` = ?`, [key]);

      return reply.send({ 
        success: true, 
        key, 
        resetToDefault: defaultSettings[key]?.value ?? null 
      });
    },
  });
}
