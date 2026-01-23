import fastify, { FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyMultipart from "@fastify/multipart";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyHelmet from "@fastify/helmet";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { env } from "./config/env";
import { eventRoutes } from "./routes/events";
import { venueRoutes } from "./routes/venues";
import productsRoutes from "./routes/products";
import alertsRoutes from "./routes/alerts";
import { userRoutes } from "./routes/users";
import { healthRoutes } from "./routes/health";
import { authRoutes } from "./routes/auth";
import { uploadRoutes } from "./routes/upload";
import { categoryRoutes } from "./routes/categories";
import { reservationsRoutes } from "./routes/reservations";
import { ticketsRoutes } from "./routes/tickets";
import { checkinRoutes } from "./routes/checkin";
import { adminStatsRoutes } from "./routes/admin-stats";
import { ordersRoutes } from "./routes/orders";
import { paymentsRoutes } from "./routes/payments";
import { couponRoutes } from "./routes/coupons";
import { settingsRoutes } from "./routes/settings";
import { reportsRoutes } from "./routes/reports";
import { adminRoutes } from "./routes/admin";
import layoutSectionsRoutes from "./routes/layout-sections";
import { artistsRoutes } from "./routes/artists";
import { playlistsRoutes } from "./routes/playlists";
import courtesyRoutes from "./routes/courtesies";
import { registerAuthHooks } from "./lib/authMiddleware";
import { cleanupExpiredReservations } from "./lib/reservations";
import { processAllReminders } from "./lib/reminderJob";

// Ensure uploads directory exists
const uploadsDir = join(process.cwd(), "uploads");
if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}
// Create subdirectories
const uploadSubdirs = ["events", "venues", "categories", "users", "misc", "audio"];
for (const dir of uploadSubdirs) {
  const fullPath = join(uploadsDir, dir);
  if (!existsSync(fullPath)) {
    mkdirSync(fullPath, { recursive: true });
  }
}

export function buildServer(): FastifyInstance {
  const app = fastify({
    logger: env.NODE_ENV !== "test",
    bodyLimit: 10 * 1024 * 1024, // 10MB para layouts grandes
  });

  // Security headers with Helmet
  app.register(fastifyHelmet, {
    contentSecurityPolicy: false, // Disable for API (CSP is for HTML)
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });

  // Rate limiting
  app.register(fastifyRateLimit, {
    max: 100, // 100 requests per window
    timeWindow: "1 minute",
    errorResponseBuilder: (request, context) => ({
      statusCode: 429,
      error: "Too Many Requests",
      message: `Demasiadas solicitudes. Por favor, espera ${Math.round(context.ttl / 1000)} segundos.`,
      retryAfter: Math.round(context.ttl / 1000),
    }),
    // Rutas con límites especiales
    keyGenerator: (request) => {
      // Usar IP + usuario autenticado si existe
      const user = (request as any).user;
      return user ? `${request.ip}-${user.id}` : request.ip;
    },
  });

  // Rate limit más estricto para rutas sensibles
  app.register(async (instance) => {
    await instance.register(fastifyRateLimit, {
      max: 5,
      timeWindow: "1 minute",
    });
    
    // Este plugin aplica solo a /api/auth/login y /api/auth/register
  }, { prefix: "/api/auth" });

  // Register multipart for file uploads
  app.register(fastifyMultipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max file size
      files: 10, // Max 10 files at once
    },
  });

  // Serve uploaded files statically
  app.register(fastifyStatic, {
    root: uploadsDir,
    prefix: "/uploads/",
    decorateReply: false,
  });

  app.addHook("onRequest", (request, reply, done) => {
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, If-Match, If-None-Match, X-Force-Overwrite");
    reply.header("Access-Control-Expose-Headers", "ETag");

    if (request.method === "OPTIONS") {
      reply.code(204).send();
      return;
    }

    done();
  });

  app.addHook("onSend", (request, reply, payload, done) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "SAMEORIGIN");
    reply.header("Referrer-Policy", "no-referrer");
    done(null, payload);
  });

  // Registrar hooks de autenticación
  registerAuthHooks(app);

  app.register(healthRoutes);
  app.register(authRoutes);
  app.register(eventRoutes);
  app.register(venueRoutes);
  app.register(productsRoutes);
  app.register(alertsRoutes);
  app.register(userRoutes);
  app.register(categoryRoutes);
  app.register(uploadRoutes);
  app.register(ticketsRoutes);
  app.register(checkinRoutes);
  app.register(adminStatsRoutes);
  app.register(ordersRoutes);
  app.register(paymentsRoutes);
  app.register(couponRoutes);
  app.register(settingsRoutes);
  app.register(reportsRoutes);
  app.register(adminRoutes);
  app.register(layoutSectionsRoutes, { prefix: "/api" });
  app.register(artistsRoutes);
  app.register(playlistsRoutes);
  app.register(courtesyRoutes);
  app.register(reservationsRoutes, { prefix: "/api/reservations" });

  // Cron job: limpiar reservas expiradas cada minuto
  const cleanupInterval = setInterval(async () => {
    try {
      const result = await cleanupExpiredReservations();
      if (result.cleaned > 0) {
        console.log(`[Reservations] Cleaned ${result.cleaned} expired reservation(s)`);
      }
    } catch (error) {
      console.error("[Reservations] Error cleaning expired reservations:", error);
    }
  }, 60 * 1000); // Cada 60 segundos

  // Cron job: enviar recordatorios de eventos cada 15 minutos
  const reminderInterval = setInterval(async () => {
    try {
      const result = await processAllReminders();
      const total24h = result.reminders24h.sent + result.reminders24h.errors;
      const total2h = result.reminders2h.sent + result.reminders2h.errors;
      
      if (total24h > 0 || total2h > 0) {
        console.log(`[Reminders] 24h: ${result.reminders24h.sent} sent, ${result.reminders24h.errors} errors | 2h: ${result.reminders2h.sent} sent, ${result.reminders2h.errors} errors`);
      }
    } catch (error) {
      console.error("[Reminders] Error processing reminders:", error);
    }
  }, 15 * 60 * 1000); // Cada 15 minutos

  // Limpiar los intervalos cuando el servidor se cierra
  app.addHook("onClose", async () => {
    clearInterval(cleanupInterval);
    clearInterval(reminderInterval);
  });

  return app;
}
