import { FastifyInstance } from "fastify";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { query, withTransaction } from "../lib/db";
import { requireAdmin, requireAuth } from "../lib/authMiddleware";
import { hashPassword, comparePassword } from "../utils/auth";
import { randomUUID } from "crypto";

type UserRow = RowDataPacket & {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  avatarUrl: string | null;
  lastLogin: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type UserStats = RowDataPacket & {
  totalOrders: number;
  totalSpent: number;
  ticketCount: number;
};

const toISO = (value: Date | string | null) => (value instanceof Date ? value.toISOString() : value);

export async function userRoutes(app: FastifyInstance) {
  // GET /api/users - Listar todos los usuarios (admin only)
  app.get("/api/users", {
    preHandler: [requireAdmin],
    handler: async (request, reply) => {
      const { search, role, status, limit = "50", offset = "0" } = request.query as {
        search?: string;
        role?: string;
        status?: string;
        limit?: string;
        offset?: string;
      };

      let sql = `
        SELECT id, name, email, role, status, last_login, created_at, updated_at
        FROM User
        WHERE 1=1
      `;
      const params: any[] = [];

      if (search) {
        sql += ` AND (name LIKE ? OR email LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
      }

      if (role) {
        sql += ` AND role = ?`;
        params.push(role);
      }

      if (status) {
        sql += ` AND status = ?`;
        params.push(status);
      }

      sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
      params.push(parseInt(limit), parseInt(offset));

      const users = await query<UserRow[]>(sql, params);

      // Get total count
      let countSql = `SELECT COUNT(*) as total FROM User WHERE 1=1`;
      const countParams: any[] = [];
      
      if (search) {
        countSql += ` AND (name LIKE ? OR email LIKE ?)`;
        countParams.push(`%${search}%`, `%${search}%`);
      }
      if (role) {
        countSql += ` AND role = ?`;
        countParams.push(role);
      }
      if (status) {
        countSql += ` AND status = ?`;
        countParams.push(status);
      }

      const [countResult] = await query<RowDataPacket[]>(countSql, countParams);
      const total = countResult?.total || 0;

      return reply.send({
        success: true,
        users: users.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          phone: null,
          role: user.role,
          status: user.status,
          avatarUrl: null,
          lastLogin: toISO(user.last_login),
          createdAt: toISO(user.created_at),
          updatedAt: toISO(user.updated_at),
        })),
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
        },
      });
    },
  });

  // GET /api/users/:id - Obtener usuario por ID (admin o el propio usuario)
  app.get<{ Params: { id: string } }>("/api/users/:id", {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { id } = request.params;
      const currentUser = (request as any).user;

      // Solo admins pueden ver otros usuarios
      if (currentUser.id !== id && currentUser.role !== "ADMIN") {
        return reply.status(403).send({
          success: false,
          error: "No tienes permiso para ver este usuario",
        });
      }

      const [user] = await query<UserRow[]>(
        `SELECT id, name, email, role, status, last_login, created_at, updated_at
         FROM User WHERE id = ?`,
        [id]
      );

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: "Usuario no encontrado",
        });
      }

      // Get user stats
      const [stats] = await query<UserStats[]>(
        `SELECT 
          COUNT(DISTINCT o.id) as totalOrders,
          COALESCE(SUM(o.total), 0) as totalSpent,
          COUNT(DISTINCT t.id) as ticketCount
         FROM User u
         LEFT JOIN \`Order\` o ON o.userId = u.id AND o.status = 'PAID'
         LEFT JOIN Ticket t ON t.orderId = o.id AND t.status = 'SOLD'
         WHERE u.id = ?`,
        [id]
      );

      return reply.send({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: null,
          role: user.role,
          status: user.status,
          avatarUrl: null,
          lastLogin: toISO(user.last_login),
          createdAt: toISO(user.created_at),
          updatedAt: toISO(user.updated_at),
          stats: {
            totalOrders: stats?.totalOrders || 0,
            totalSpent: Number(stats?.totalSpent) || 0,
            ticketCount: stats?.ticketCount || 0,
          },
        },
      });
    },
  });

  // POST /api/users - Crear usuario (admin only)
  app.post("/api/users", {
    preHandler: [requireAdmin],
    handler: async (request, reply) => {
      const { name, email, password, phone, role = "USER", status = "ACTIVE" } = request.body as {
        name: string;
        email: string;
        password: string;
        phone?: string;
        role?: string;
        status?: string;
      };

      if (!name || !email || !password) {
        return reply.status(400).send({
          success: false,
          error: "name, email y password son requeridos",
        });
      }

      // Verificar que el email no existe
      const [existing] = await query<RowDataPacket[]>(
        `SELECT id FROM User WHERE email = ?`,
        [email]
      );

      if (existing) {
        return reply.status(409).send({
          success: false,
          error: "Ya existe un usuario con este email",
        });
      }

      const userId = randomUUID();
      const hashedPassword = await hashPassword(password);

      await query(
        `INSERT INTO User (id, name, email, password, passwordHash, phone, role, status, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [userId, name, email, hashedPassword, hashedPassword, phone || null, role, status]
      );

      return reply.status(201).send({
        success: true,
        user: {
          id: userId,
          name,
          email,
          phone: phone || null,
          role,
          status,
        },
      });
    },
  });

  // PUT /api/users/:id - Actualizar usuario (admin o el propio usuario para datos básicos)
  app.put<{ Params: { id: string } }>("/api/users/:id", {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { id } = request.params;
      const currentUser = (request as any).user;
      const { name, email, phone, avatarUrl, role, status, password } = request.body as {
        name?: string;
        email?: string;
        phone?: string;
        avatarUrl?: string;
        role?: string;
        status?: string;
        password?: string;
      };

      // Solo admins pueden modificar otros usuarios
      const isOwnProfile = currentUser.id === id;
      const isAdmin = currentUser.role === "ADMIN";

      if (!isOwnProfile && !isAdmin) {
        return reply.status(403).send({
          success: false,
          error: "No tienes permiso para modificar este usuario",
        });
      }

      // Verificar que el usuario existe
      const [user] = await query<UserRow[]>(`SELECT id FROM User WHERE id = ?`, [id]);
      if (!user) {
        return reply.status(404).send({
          success: false,
          error: "Usuario no encontrado",
        });
      }

      // Construir query de actualización
      const updates: string[] = [];
      const params: any[] = [];

      if (name) {
        updates.push("name = ?");
        params.push(name);
      }

      if (email) {
        // Verificar que el nuevo email no existe
        const [existingEmail] = await query<RowDataPacket[]>(
          `SELECT id FROM User WHERE email = ? AND id != ?`,
          [email, id]
        );
        if (existingEmail) {
          return reply.status(409).send({
            success: false,
            error: "Ya existe un usuario con este email",
          });
        }
        updates.push("email = ?");
        params.push(email);
      }

      if (phone !== undefined) {
        updates.push("phone = ?");
        params.push(phone || null);
      }

      if (avatarUrl !== undefined) {
        updates.push("avatarUrl = ?");
        params.push(avatarUrl || null);
      }

      // Solo admins pueden cambiar rol y status
      if (isAdmin) {
        if (role) {
          updates.push("role = ?");
          params.push(role);
        }
        if (status) {
          updates.push("status = ?");
          params.push(status);
        }
      }

      // Solo admins o el propio usuario pueden cambiar password
      if (password && (isAdmin || isOwnProfile)) {
        const hashedPassword = await hashPassword(password);
        updates.push("password = ?");
        params.push(hashedPassword);
        updates.push("passwordHash = ?");
        params.push(hashedPassword);
      }

      if (updates.length === 0) {
        return reply.status(400).send({
          success: false,
          error: "No hay campos para actualizar",
        });
      }

      updates.push("updatedAt = NOW()");
      params.push(id);

      await query(
        `UPDATE User SET ${updates.join(", ")} WHERE id = ?`,
        params
      );

      // Obtener usuario actualizado
      const [updatedUser] = await query<UserRow[]>(
        `SELECT id, name, email, role, status, last_login, created_at, updated_at
         FROM User WHERE id = ?`,
        [id]
      );

      return reply.send({
        success: true,
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          phone: null,
          role: updatedUser.role,
          status: updatedUser.status,
          avatarUrl: null,
          lastLogin: toISO(updatedUser.last_login),
          createdAt: toISO(updatedUser.created_at),
          updatedAt: toISO(updatedUser.updated_at),
        },
      });
    },
  });

  // PATCH /api/users/:id/role - Cambiar rol de usuario (admin only)
  app.patch<{ Params: { id: string } }>("/api/users/:id/role", {
    preHandler: [requireAdmin],
    handler: async (request, reply) => {
      const { id } = request.params;
      const currentUser = (request as any).user;
      const { role } = request.body as { role: string };

      if (!role || !["USER", "ADMIN", "OPERATOR"].includes(role)) {
        return reply.status(400).send({
          success: false,
          error: "Rol inválido. Debe ser USER, ADMIN u OPERATOR",
        });
      }

      // No permitir que un admin se quite su propio rol de admin
      if (currentUser.id === id && role !== "ADMIN") {
        return reply.status(400).send({
          success: false,
          error: "No puedes quitarte el rol de administrador",
        });
      }

      const [user] = await query<UserRow[]>(`SELECT id FROM User WHERE id = ?`, [id]);
      if (!user) {
        return reply.status(404).send({
          success: false,
          error: "Usuario no encontrado",
        });
      }

      await query(`UPDATE User SET role = ?, updatedAt = NOW() WHERE id = ?`, [role, id]);

      return reply.send({
        success: true,
        message: `Rol actualizado a ${role}`,
      });
    },
  });

  // PATCH /api/users/:id/status - Cambiar status de usuario (admin only)
  app.patch<{ Params: { id: string } }>("/api/users/:id/status", {
    preHandler: [requireAdmin],
    handler: async (request, reply) => {
      const { id } = request.params;
      const currentUser = (request as any).user;
      const { status } = request.body as { status: string };

      if (!status || !["ACTIVE", "INACTIVE", "SUSPENDED"].includes(status)) {
        return reply.status(400).send({
          success: false,
          error: "Status inválido. Debe ser ACTIVE, INACTIVE o SUSPENDED",
        });
      }

      // No permitir que un admin se desactive a sí mismo
      if (currentUser.id === id && status !== "ACTIVE") {
        return reply.status(400).send({
          success: false,
          error: "No puedes desactivar tu propia cuenta",
        });
      }

      const [user] = await query<UserRow[]>(`SELECT id FROM User WHERE id = ?`, [id]);
      if (!user) {
        return reply.status(404).send({
          success: false,
          error: "Usuario no encontrado",
        });
      }

      await query(`UPDATE User SET status = ?, updatedAt = NOW() WHERE id = ?`, [status, id]);

      return reply.send({
        success: true,
        message: `Status actualizado a ${status}`,
      });
    },
  });

  // DELETE /api/users/:id - Eliminar usuario (admin only, soft delete)
  app.delete<{ Params: { id: string } }>("/api/users/:id", {
    preHandler: [requireAdmin],
    handler: async (request, reply) => {
      const { id } = request.params;
      const currentUser = (request as any).user;

      // No permitir que un admin se elimine a sí mismo
      if (currentUser.id === id) {
        return reply.status(400).send({
          success: false,
          error: "No puedes eliminar tu propia cuenta",
        });
      }

      const [user] = await query<UserRow[]>(`SELECT id, email FROM User WHERE id = ?`, [id]);
      if (!user) {
        return reply.status(404).send({
          success: false,
          error: "Usuario no encontrado",
        });
      }

      // Verificar si tiene órdenes activas
      const [activeOrders] = await query<RowDataPacket[]>(
        `SELECT COUNT(*) as count FROM \`Order\` WHERE userId = ? AND status IN ('PENDING', 'PAID')`,
        [id]
      );

      if (activeOrders?.count > 0) {
        // Soft delete: cambiar status a INACTIVE y anonimizar email
        await query(
          `UPDATE User SET status = 'DELETED', email = CONCAT('deleted_', id, '@deleted.local'), updatedAt = NOW() WHERE id = ?`,
          [id]
        );

        return reply.send({
          success: true,
          message: "Usuario desactivado (tiene órdenes activas)",
          softDeleted: true,
        });
      }

      // Hard delete si no tiene órdenes
      await withTransaction(async (connection) => {
        // Eliminar tickets no vendidos
        await connection.query(
          `DELETE t FROM Ticket t 
           JOIN \`Order\` o ON o.id = t.orderId 
           WHERE o.userId = ? AND t.status NOT IN ('SOLD')`,
          [id]
        );

        // Eliminar órdenes vacías
        await connection.query(
          `DELETE FROM \`Order\` WHERE userId = ? AND status NOT IN ('PAID')`,
          [id]
        );

        // Eliminar usuario
        await connection.query(`DELETE FROM User WHERE id = ?`, [id]);
      });

      return reply.send({
        success: true,
        message: "Usuario eliminado",
        softDeleted: false,
      });
    },
  });

  // GET /api/users/me - Obtener perfil del usuario actual
  app.get("/api/users/me", {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const currentUser = (request as any).user;

      const [user] = await query<UserRow[]>(
        `SELECT id, name, email, phone, role, status, last_login, created_at, updated_at
         FROM User WHERE id = ?`,
        [currentUser.id]
      );

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: "Usuario no encontrado",
        });
      }

      // Get user stats
      const [stats] = await query<UserStats[]>(
        `SELECT 
          COUNT(DISTINCT o.id) as totalOrders,
          COALESCE(SUM(o.total), 0) as totalSpent,
          COUNT(DISTINCT t.id) as ticketCount
         FROM User u
         LEFT JOIN \`Order\` o ON o.userId = u.id AND o.status = 'PAID'
         LEFT JOIN Ticket t ON t.orderId = o.id AND t.status = 'SOLD'
         WHERE u.id = ?`,
        [currentUser.id]
      );

      return reply.send({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone || null,
          role: user.role,
          status: user.status,
          avatarUrl: null,
          lastLogin: toISO(user.last_login),
          createdAt: toISO(user.created_at),
          updatedAt: toISO(user.updated_at),
          stats: {
            totalOrders: stats?.totalOrders || 0,
            totalSpent: Number(stats?.totalSpent) || 0,
            ticketCount: stats?.ticketCount || 0,
          },
        },
      });
    },
  });

  // PATCH /api/users/me - Actualizar perfil del usuario actual
  app.patch("/api/users/me", {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const currentUser = (request as any).user;
      const { name, phone } = request.body as { name?: string; phone?: string };

      // Validate input
      if (!name || name.trim().length < 2) {
        return reply.status(400).send({
          success: false,
          error: "El nombre debe tener al menos 2 caracteres",
        });
      }

      // Update user with name and phone
      await query(
        `UPDATE User SET name = ?, phone = ?, updated_at = NOW() WHERE id = ?`,
        [name.trim(), phone?.trim() || null, currentUser.id]
      );

      // Fetch updated user
      const [user] = await query<UserRow[]>(
        `SELECT id, name, email, phone, role, status, last_login, created_at, updated_at
         FROM User WHERE id = ?`,
        [currentUser.id]
      );

      return reply.send({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || null,
        role: user.role,
        status: user.status,
        lastLogin: toISO(user.last_login),
        createdAt: toISO(user.created_at),
        updatedAt: toISO(user.updated_at),
      });
    },
  });

  // PUT /api/users/me/password - Cambiar contraseña del usuario actual
  app.put("/api/users/me/password", {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const currentUser = (request as any).user;
      const { currentPassword, newPassword } = request.body as {
        currentPassword: string;
        newPassword: string;
      };

      // Validar input
      if (!currentPassword) {
        return reply.status(400).send({
          success: false,
          error: "Debes proporcionar tu contraseña actual",
        });
      }

      if (!newPassword || newPassword.length < 8) {
        return reply.status(400).send({
          success: false,
          error: "La nueva contraseña debe tener al menos 8 caracteres",
        });
      }

      // Obtener hash de contraseña actual
      const [user] = await query<RowDataPacket[]>(
        `SELECT password FROM User WHERE id = ?`,
        [currentUser.id]
      );

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: "Usuario no encontrado",
        });
      }

      // Verificar contraseña actual
      const isValid = await comparePassword(currentPassword, user.password);
      if (!isValid) {
        return reply.status(401).send({
          success: false,
          error: "La contraseña actual es incorrecta",
        });
      }

      // Hashear nueva contraseña y actualizar
      const hashedPassword = await hashPassword(newPassword);
      await query(
        `UPDATE User SET password = ?, passwordHash = ?, updated_at = NOW() WHERE id = ?`,
        [hashedPassword, hashedPassword, currentUser.id]
      );

      return reply.send({
        success: true,
        message: "Contraseña actualizada correctamente",
      });
    },
  });

  // PUT /api/users/:id/password - Cambiar contraseña (requiere contraseña actual)
  app.put<{ Params: { id: string } }>("/api/users/:id/password", {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { id } = request.params;
      const currentUser = (request as any).user;
      const { currentPassword, newPassword } = request.body as {
        currentPassword: string;
        newPassword: string;
      };

      // Solo el propio usuario o admins pueden cambiar la contraseña
      const isOwnProfile = currentUser.id === id;
      const isAdmin = currentUser.role === "ADMIN";

      if (!isOwnProfile && !isAdmin) {
        return reply.status(403).send({
          success: false,
          error: "No tienes permiso para cambiar esta contraseña",
        });
      }

      // Validar input
      if (!newPassword || newPassword.length < 6) {
        return reply.status(400).send({
          success: false,
          error: "La nueva contraseña debe tener al menos 6 caracteres",
        });
      }

      // Si es el propio usuario, verificar contraseña actual
      if (isOwnProfile) {
        if (!currentPassword) {
          return reply.status(400).send({
            success: false,
            error: "Debes proporcionar tu contraseña actual",
          });
        }

        // Obtener hash de contraseña actual
        const [user] = await query<RowDataPacket[]>(
          `SELECT password FROM User WHERE id = ?`,
          [id]
        );

        if (!user) {
          return reply.status(404).send({
            success: false,
            error: "Usuario no encontrado",
          });
        }

        // Verificar contraseña actual
        const isValid = await comparePassword(currentPassword, user.password);
        if (!isValid) {
          return reply.status(401).send({
            success: false,
            error: "La contraseña actual es incorrecta",
          });
        }
      }

      // Hashear nueva contraseña y actualizar
      const hashedPassword = await hashPassword(newPassword);
      await query(
        `UPDATE User SET password = ?, passwordHash = ?, updated_at = NOW() WHERE id = ?`,
        [hashedPassword, hashedPassword, id]
      );

      return reply.send({
        success: true,
        message: "Contraseña actualizada correctamente",
      });
    },
  });

  // ============================================
  // USER DASHBOARD ENDPOINTS
  // ============================================

  // GET /api/users/me/dashboard - Dashboard stats for current user
  app.get("/api/users/me/dashboard", {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const currentUser = (request as any).user;

      try {
        // Get user stats
        const [statsRow] = await query<RowDataPacket[]>(
          `SELECT 
            (SELECT COUNT(*) FROM Ticket t 
             JOIN \`Order\` o ON o.id = t.orderId 
             WHERE o.userId = ? AND t.status IN ('SOLD', 'RESERVED')) as totalTickets,
            (SELECT COUNT(DISTINCT es.id) FROM Ticket t 
             JOIN \`Order\` o ON o.id = t.orderId 
             JOIN EventSession es ON es.id = t.sessionId
             WHERE o.userId = ? AND t.status IN ('SOLD', 'RESERVED') AND es.startsAt > NOW()) as upcomingEvents,
            (SELECT COUNT(*) FROM \`Order\` WHERE userId = ? AND status = 'PAID') as totalOrders,
            (SELECT COALESCE(SUM(total), 0) FROM \`Order\` WHERE userId = ? AND status = 'PAID') as totalSpent`,
          [currentUser.id, currentUser.id, currentUser.id, currentUser.id]
        );

        // Get upcoming tickets - using columns that exist
        const upcomingTickets = await query<RowDataPacket[]>(
          `SELECT 
            t.id, t.status, t.seatId,
            e.name as eventName,
            es.startsAt as sessionDate,
            v.name as venueName, v.city as venueCity,
            s.label as seatLabel, vz.name as zoneName
           FROM Ticket t
           JOIN \`Order\` o ON o.id = t.orderId
           JOIN EventSession es ON es.id = t.sessionId
           JOIN Event e ON e.id = es.eventId
           LEFT JOIN Venue v ON v.id = e.venueId
           LEFT JOIN Seat s ON s.id = t.seatId
           LEFT JOIN VenueZone vz ON vz.id = s.zoneId
           WHERE o.userId = ? 
             AND t.status IN ('SOLD', 'RESERVED')
             AND es.startsAt > NOW()
           ORDER BY es.startsAt ASC
           LIMIT 5`,
          [currentUser.id]
        );

        // Get recent orders
        const recentOrders = await query<RowDataPacket[]>(
          `SELECT 
            o.id, o.total, o.status, o.createdAt,
            e.name as eventName,
            (SELECT COUNT(*) FROM Ticket WHERE orderId = o.id) as ticketCount
           FROM \`Order\` o
           LEFT JOIN Ticket t ON t.orderId = o.id
           LEFT JOIN EventSession es ON es.id = t.sessionId
           LEFT JOIN Event e ON e.id = es.eventId
           WHERE o.userId = ?
           GROUP BY o.id
           ORDER BY o.createdAt DESC
           LIMIT 5`,
          [currentUser.id]
        );

        return reply.send({
          success: true,
          stats: {
            totalTickets: Number(statsRow?.totalTickets) || 0,
            upcomingEvents: Number(statsRow?.upcomingEvents) || 0,
            totalOrders: Number(statsRow?.totalOrders) || 0,
            totalSpent: Number(statsRow?.totalSpent) || 0,
          },
          upcomingTickets: upcomingTickets.map((t: any) => ({
            id: t.id,
            eventName: t.eventName,
            eventImage: null,
            sessionDate: t.sessionDate,
            venueName: t.venueName,
            venueCity: t.venueCity,
            seatLabel: t.seatLabel,
            zoneName: t.zoneName,
            status: t.status,
          })),
          recentOrders: recentOrders.map((o: any) => ({
            id: o.id,
            orderNumber: o.id?.substring(0, 8)?.toUpperCase() || 'N/A',
            eventName: o.eventName || 'Evento',
            total: Number(o.total),
            status: o.status,
            createdAt: o.createdAt,
            ticketCount: o.ticketCount || 0,
          })),
        });
      } catch (error) {
        console.error("Error fetching user dashboard:", error);
        return reply.status(500).send({
          success: false,
          error: "Error al cargar el dashboard",
        });
      }
    },
  });

  // GET /api/users/me/orders - Get user's orders
  app.get("/api/users/me/orders", {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const currentUser = (request as any).user;

      try {
        const orders = await query<RowDataPacket[]>(
          `SELECT 
            o.id, o.id as orderNumber, o.total, o.status, o.createdAt, o.updatedAt,
            e.id as eventId, e.name as eventName,
            es.startsAt as sessionDate,
            (SELECT COUNT(*) FROM Ticket WHERE orderId = o.id) as ticketCount
           FROM \`Order\` o
           LEFT JOIN Ticket t ON t.orderId = o.id
           LEFT JOIN EventSession es ON es.id = t.sessionId
           LEFT JOIN Event e ON e.id = es.eventId
           WHERE o.userId = ?
           GROUP BY o.id
           ORDER BY o.createdAt DESC`,
          [currentUser.id]
        );

        return reply.send({
          success: true,
          orders: orders.map((o: any) => ({
            id: o.id,
            orderNumber: o.orderNumber?.substring(0, 8)?.toUpperCase() || o.id.substring(0, 8).toUpperCase(),
            eventName: o.eventName || 'Evento',
            eventId: o.eventId,
            sessionDate: o.sessionDate,
            total: Number(o.total),
            status: o.status,
            ticketCount: o.ticketCount || 0,
            createdAt: o.createdAt,
            paidAt: o.status === 'PAID' ? o.updatedAt : null,
          })),
        });
      } catch (error) {
        console.error("Error fetching user orders:", error);
        return reply.status(500).send({
          success: false,
          error: "Error al cargar las órdenes",
        });
      }
    },
  });

  // GET /api/users/me/upcoming - Get user's upcoming events
  app.get("/api/users/me/upcoming", {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const currentUser = (request as any).user;

      try {
        const events = await query<RowDataPacket[]>(
          `SELECT 
            es.id as sessionId, es.startsAt as sessionDate, es.title as sessionTitle,
            e.id as eventId, e.name as eventName,
            v.name as venueName, v.city as venueCity,
            GROUP_CONCAT(t.id) as ticketIds,
            GROUP_CONCAT(s.label) as seatLabels,
            GROUP_CONCAT(vz.name) as zoneNames,
            COUNT(t.id) as ticketCount
           FROM Ticket t
           JOIN \`Order\` o ON o.id = t.orderId
           JOIN EventSession es ON es.id = t.sessionId
           JOIN Event e ON e.id = es.eventId
           LEFT JOIN Venue v ON v.id = e.venueId
           LEFT JOIN Seat s ON s.id = t.seatId
           LEFT JOIN VenueZone vz ON vz.id = s.zoneId
           WHERE o.userId = ? 
             AND t.status IN ('SOLD', 'RESERVED')
             AND es.startsAt > NOW()
           GROUP BY es.id
           ORDER BY es.startsAt ASC`,
          [currentUser.id]
        );

        return reply.send({
          success: true,
          events: events.map((e: any) => {
            const ticketIds = e.ticketIds?.split(',') || [];
            const seatLabels = e.seatLabels?.split(',') || [];
            const zoneNames = e.zoneNames?.split(',') || [];
            
            return {
              id: e.sessionId,
              eventId: e.eventId,
              eventName: e.eventName,
              eventImage: null,
              sessionId: e.sessionId,
              sessionDate: e.sessionDate,
              sessionTitle: e.sessionTitle,
              venueName: e.venueName,
              venueCity: e.venueCity,
              ticketCount: e.ticketCount,
              tickets: ticketIds.map((id: string, i: number) => ({
                id,
                seatLabel: seatLabels[i] !== 'null' ? seatLabels[i] : null,
                zoneName: zoneNames[i] !== 'null' ? zoneNames[i] : null,
                status: 'SOLD',
              })),
            };
          }),
        });
      } catch (error) {
        console.error("Error fetching upcoming events:", error);
        return reply.status(500).send({
          success: false,
          error: "Error al cargar los eventos próximos",
        });
      }
    },
  });

  // GET /api/users/me/favorites - Get user's favorite events
  app.get("/api/users/me/favorites", {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const currentUser = (request as any).user;

      try {
        const favorites = await query<RowDataPacket[]>(
          `SELECT 
            uf.id,
            uf.eventId,
            uf.createdAt as favoritedAt,
            e.name as eventName,
            e.thumbnailImage as eventImage,
            e.status,
            v.name as venueName,
            v.city as venueCity,
            (SELECT MIN(es.startsAt) FROM EventSession es WHERE es.eventId = e.id AND es.startsAt > NOW()) as nextSessionDate,
            (SELECT MIN(s.price) FROM Seat s 
             JOIN VenueLayout vl ON vl.id = s.layoutId 
             WHERE vl.eventId = e.id AND s.status = 'AVAILABLE') as minPrice
           FROM UserFavorite uf
           JOIN Event e ON e.id = uf.eventId
           LEFT JOIN Venue v ON v.id = e.venueId
           WHERE uf.userId = ?
           ORDER BY uf.createdAt DESC`,
          [currentUser.id]
        );

        return reply.send({
          success: true,
          favorites: favorites.map((f: any) => ({
            id: f.id,
            eventId: f.eventId,
            eventName: f.eventName,
            eventImage: f.eventImage,
            nextSessionDate: f.nextSessionDate,
            venueName: f.venueName || 'Por definir',
            venueCity: f.venueCity || '',
            minPrice: Number(f.minPrice) || 0,
            status: f.status,
            favoritedAt: f.favoritedAt,
          })),
        });
      } catch (error) {
        console.error("Error fetching favorites:", error);
        return reply.status(500).send({
          success: false,
          error: "Error al cargar favoritos",
        });
      }
    },
  });

  // POST /api/users/me/favorites/:eventId - Add event to favorites
  app.post<{ Params: { eventId: string } }>("/api/users/me/favorites/:eventId", {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const currentUser = (request as any).user;
      const { eventId } = request.params;

      try {
        // Check if event exists
        const [event] = await query<RowDataPacket[]>(
          `SELECT id, name FROM Event WHERE id = ?`,
          [eventId]
        );

        if (!event) {
          return reply.status(404).send({
            success: false,
            error: "Evento no encontrado",
          });
        }

        // Check if already favorited
        const [existing] = await query<RowDataPacket[]>(
          `SELECT id FROM UserFavorite WHERE userId = ? AND eventId = ?`,
          [currentUser.id, eventId]
        );

        if (existing) {
          return reply.send({
            success: true,
            message: "Ya está en favoritos",
            alreadyFavorited: true,
          });
        }

        // Add to favorites
        const favoriteId = `fav_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        await query(
          `INSERT INTO UserFavorite (id, userId, eventId, createdAt) VALUES (?, ?, ?, NOW())`,
          [favoriteId, currentUser.id, eventId]
        );

        return reply.send({
          success: true,
          message: "Agregado a favoritos",
          favoriteId,
        });
      } catch (error) {
        console.error("Error adding favorite:", error);
        return reply.status(500).send({
          success: false,
          error: "Error al agregar a favoritos",
        });
      }
    },
  });

  // DELETE /api/users/me/favorites/:eventId - Remove favorite
  app.delete<{ Params: { eventId: string } }>("/api/users/me/favorites/:eventId", {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const currentUser = (request as any).user;
      const { eventId } = request.params;

      try {
        const result = await query<ResultSetHeader>(
          `DELETE FROM UserFavorite WHERE userId = ? AND eventId = ?`,
          [currentUser.id, eventId]
        );

        return reply.send({
          success: true,
          message: result.affectedRows > 0 ? "Eliminado de favoritos" : "No estaba en favoritos",
          removed: result.affectedRows > 0,
        });
      } catch (error) {
        console.error("Error removing favorite:", error);
        return reply.status(500).send({
          success: false,
          error: "Error al eliminar de favoritos",
        });
      }
    },
  });
}
