import { FastifyInstance } from "fastify";
import { RowDataPacket } from "mysql2";
import { randomUUID, randomBytes, createHash } from "crypto";
import { z } from "zod";
import { query } from "../lib/db";
import { comparePassword, hashPassword, signToken } from "../utils/auth";
import { sendEmail, getPasswordResetEmail, getEmailVerificationEmail } from "../lib/emailService";

type UserRow = RowDataPacket & {
  id: string;
  name: string;
  email: string;
  password: string;
  role: string;
  status: string;
  last_login: Date | null;
  created_at: Date;
  updated_at: Date;
};

const toISO = (value: Date | string | null) => (value instanceof Date ? value.toISOString() : value);

const publicUserFields = (user: UserRow) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  status: user.status,
  lastLogin: toISO(user.last_login),
  createdAt: toISO(user.created_at),
});

export async function authRoutes(app: FastifyInstance) {
  // DEV ONLY: Crear usuarios de prueba (GET para fácil acceso desde navegador)
  app.get("/api/auth/setup-test-users", async (request, reply) => {
    try {
      const adminEmail = 'admin@boletera.com';
      const userEmail = 'user@boletera.com';
      
      // Verificar si ya existen
      const existingAdmin = await query<UserRow[]>('SELECT id FROM User WHERE email = ?', [adminEmail]);
      const existingUser = await query<UserRow[]>('SELECT id FROM User WHERE email = ?', [userEmail]);
      
      const results = [];
      
      // Crear o actualizar admin
      if (existingAdmin.length > 0) {
        await query('UPDATE User SET password = ?, role = ?, updated_at = NOW() WHERE email = ?', 
          [hashPassword('Admin123!'), 'ADMIN', adminEmail]);
        results.push({ email: adminEmail, status: 'updated', role: 'ADMIN' });
      } else {
        await query(
          `INSERT INTO User (id, name, email, password, role, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [randomUUID(), 'Administrador', adminEmail, hashPassword('Admin123!'), 'ADMIN', 'ACTIVE']
        );
        results.push({ email: adminEmail, status: 'created', role: 'ADMIN' });
      }
      
      // Crear o actualizar usuario normal
      if (existingUser.length > 0) {
        await query('UPDATE User SET password = ?, role = ?, updated_at = NOW() WHERE email = ?', 
          [hashPassword('User123!'), 'VIEWER', userEmail]);
        results.push({ email: userEmail, status: 'updated', role: 'VIEWER' });
      } else {
        await query(
          `INSERT INTO User (id, name, email, password, role, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [randomUUID(), 'Usuario Normal', userEmail, hashPassword('User123!'), 'VIEWER', 'ACTIVE']
        );
        results.push({ email: userEmail, status: 'created', role: 'VIEWER' });
      }
      
      return { 
        success: true, 
        users: results,
        credentials: {
          admin: { email: adminEmail, password: 'Admin123!', role: 'ADMIN' },
          user: { email: userEmail, password: 'User123!', role: 'VIEWER' }
        }
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ message: 'Error creando usuarios de prueba', error: String(error) });
    }
  });

  // DEV ONLY: Crear usuarios de prueba (POST version)
  app.post("/api/auth/create-test-users", async (request, reply) => {
    try {
      const adminEmail = 'admin@boletera.com';
      const userEmail = 'user@boletera.com';
      
      // Verificar si ya existen
      const [existingAdmin] = await query<UserRow[]>('SELECT id FROM User WHERE email = ?', [adminEmail]);
      const [existingUser] = await query<UserRow[]>('SELECT id FROM User WHERE email = ?', [userEmail]);
      
      const results = [];
      
      // Crear o actualizar admin
      if (existingAdmin.length > 0) {
        await query('UPDATE User SET password = ?, role = ?, updated_at = NOW() WHERE email = ?', 
          [hashPassword('Admin123!'), 'ADMIN', adminEmail]);
        results.push({ email: adminEmail, status: 'updated', role: 'ADMIN' });
      } else {
        await query(
          `INSERT INTO User (id, name, email, password, role, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [randomUUID(), 'Administrador', adminEmail, hashPassword('Admin123!'), 'ADMIN', 'ACTIVE']
        );
        results.push({ email: adminEmail, status: 'created', role: 'ADMIN' });
      }
      
      // Crear o actualizar usuario normal
      if (existingUser.length > 0) {
        await query('UPDATE User SET password = ?, role = ?, updated_at = NOW() WHERE email = ?', 
          [hashPassword('User123!'), 'VIEWER', userEmail]);
        results.push({ email: userEmail, status: 'updated', role: 'VIEWER' });
      } else {
        await query(
          `INSERT INTO User (id, name, email, password, role, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [randomUUID(), 'Usuario Normal', userEmail, hashPassword('User123!'), 'VIEWER', 'ACTIVE']
        );
        results.push({ email: userEmail, status: 'created', role: 'VIEWER' });
      }
      
      return { 
        success: true, 
        users: results,
        credentials: {
          admin: { email: adminEmail, password: 'Admin123!', role: 'ADMIN' },
          user: { email: userEmail, password: 'User123!', role: 'VIEWER' }
        }
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ message: 'Error creando usuarios de prueba' });
    }
  });

  const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  });

  const registerSchema = z.object({
    name: z.string().min(2, "El nombre es obligatorio"),
    email: z.string().email(),
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  });

  app.post("/api/auth/login", async (request, reply) => {
    const { email, password } = loginSchema.parse(request.body);
    const normalizedEmail = email.toLowerCase();

    const [user] = await query<UserRow[]>(
      `SELECT id, name, email, password, role, status, last_login, created_at, updated_at
      FROM User
      WHERE email = ?
      LIMIT 1`,
      [normalizedEmail],
    );

    if (!user) {
      return reply.code(401).send({ message: "Credenciales inválidas" });
    }

    const isValid = await comparePassword(password, user.password);
    if (!isValid) {
      return reply.code(401).send({ message: "Credenciales inválidas" });
    }

    await query(
      `UPDATE User SET last_login = NOW(), updated_at = NOW() WHERE id = ?`,
      [user.id],
    );

    const token = signToken({ sub: user.id, email: user.email, role: user.role });

    return {
      token,
      user: publicUserFields(user),
    };
  });

  app.post("/api/auth/register", async (request, reply) => {
    const { name, email, password } = registerSchema.parse(request.body);
    const normalizedEmail = email.toLowerCase();

    const existing = await query<UserRow[]>(
      `SELECT id FROM User WHERE email = ? LIMIT 1`,
      [normalizedEmail],
    );

    if (existing.length > 0) {
      return reply.code(409).send({ message: "El correo ya está registrado" });
    }

    const id = randomUUID();
    const passwordHash = hashPassword(password);

    await query(
      `INSERT INTO User (id, name, email, password, role, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'VIEWER', 'ACTIVE', NOW(), NOW())`,
      [id, name, normalizedEmail, passwordHash],
    );

    const token = signToken({ sub: id, email: normalizedEmail, role: "VIEWER" });

    return {
      token,
      user: {
        id,
        name,
        email: normalizedEmail,
        role: "VIEWER",
        status: "ACTIVE",
        lastLogin: null,
        createdAt: new Date().toISOString(),
      },
    };
  });

  // POST /api/auth/forgot-password - Solicitar recuperación de contraseña
  app.post("/api/auth/forgot-password", async (request, reply) => {
    const { email } = z.object({ email: z.string().email() }).parse(request.body);
    const normalizedEmail = email.toLowerCase();

    // Buscar usuario
    const [user] = await query<UserRow[]>(
      `SELECT id, name, email FROM User WHERE email = ? LIMIT 1`,
      [normalizedEmail]
    );

    // Siempre responder éxito por seguridad (no revelar si email existe)
    if (!user) {
      return { success: true, message: "Si el email existe, recibirás instrucciones" };
    }

    // Generar token único
    const resetToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(resetToken).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    // Guardar token en DB (crear tabla si no existe)
    try {
      await query(
        `INSERT INTO PasswordResetToken (id, userId, tokenHash, expiresAt, createdAt)
         VALUES (?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE tokenHash = VALUES(tokenHash), expiresAt = VALUES(expiresAt), createdAt = NOW()`,
        [randomUUID(), user.id, tokenHash, expiresAt]
      );
    } catch (err: any) {
      // Si la tabla no existe, crearla
      if (err.code === "ER_NO_SUCH_TABLE") {
        await query(`
          CREATE TABLE IF NOT EXISTS PasswordResetToken (
            id VARCHAR(36) PRIMARY KEY,
            userId VARCHAR(36) NOT NULL,
            tokenHash VARCHAR(64) NOT NULL,
            expiresAt DATETIME NOT NULL,
            createdAt DATETIME NOT NULL,
            UNIQUE KEY unique_user (userId),
            FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
          )
        `);
        await query(
          `INSERT INTO PasswordResetToken (id, userId, tokenHash, expiresAt, createdAt)
           VALUES (?, ?, ?, ?, NOW())`,
          [randomUUID(), user.id, tokenHash, expiresAt]
        );
      } else {
        throw err;
      }
    }

    // Enviar email
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:8080";
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    await sendEmail({
      to: user.email,
      subject: "Recuperar contraseña - Boletera",
      html: getPasswordResetEmail(user.name, resetUrl),
    });

    return { success: true, message: "Si el email existe, recibirás instrucciones" };
  });

  // GET /api/auth/verify-reset-token - Verificar si token es válido
  app.get("/api/auth/verify-reset-token", async (request, reply) => {
    const { token } = request.query as { token: string };
    
    if (!token) {
      return reply.code(400).send({ valid: false, error: "Token requerido" });
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");
    
    const [resetToken] = await query<RowDataPacket[]>(
      `SELECT id, expiresAt FROM PasswordResetToken WHERE tokenHash = ? LIMIT 1`,
      [tokenHash]
    );

    if (!resetToken || new Date(resetToken.expiresAt) < new Date()) {
      return reply.code(400).send({ valid: false, error: "Token inválido o expirado" });
    }

    return { valid: true };
  });

  // POST /api/auth/reset-password - Restablecer contraseña con token
  app.post("/api/auth/reset-password", async (request, reply) => {
    const { token, password } = z.object({
      token: z.string(),
      password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
    }).parse(request.body);

    const tokenHash = createHash("sha256").update(token).digest("hex");

    // Buscar token válido
    const [resetToken] = await query<RowDataPacket[]>(
      `SELECT prt.id, prt.userId, prt.expiresAt, u.email
       FROM PasswordResetToken prt
       JOIN User u ON u.id = prt.userId
       WHERE prt.tokenHash = ?
       LIMIT 1`,
      [tokenHash]
    );

    if (!resetToken || new Date(resetToken.expiresAt) < new Date()) {
      return reply.code(400).send({ success: false, error: "Token inválido o expirado" });
    }

    // Actualizar contraseña
    const passwordHash = hashPassword(password);
    await query(
      `UPDATE User SET password = ?, updated_at = NOW() WHERE id = ?`,
      [passwordHash, resetToken.userId]
    );

    // Eliminar token usado
    await query(`DELETE FROM PasswordResetToken WHERE id = ?`, [resetToken.id]);

    return { success: true, message: "Contraseña actualizada correctamente" };
  });

  // POST /api/auth/send-verification - Enviar email de verificación
  app.post("/api/auth/send-verification", async (request, reply) => {
    const { email } = z.object({ email: z.string().email() }).parse(request.body);
    const normalizedEmail = email.toLowerCase();

    const [user] = await query<UserRow[]>(
      `SELECT id, name, email, emailVerified FROM User WHERE email = ? LIMIT 1`,
      [normalizedEmail]
    );

    if (!user) {
      return { success: true }; // No revelar si existe
    }

    if ((user as any).emailVerified) {
      return reply.code(400).send({ error: "El email ya está verificado" });
    }

    // Generar token
    const verifyToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(verifyToken).digest("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

    try {
      await query(
        `INSERT INTO EmailVerificationToken (id, userId, tokenHash, expiresAt, createdAt)
         VALUES (?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE tokenHash = VALUES(tokenHash), expiresAt = VALUES(expiresAt), createdAt = NOW()`,
        [randomUUID(), user.id, tokenHash, expiresAt]
      );
    } catch (err: any) {
      if (err.code === "ER_NO_SUCH_TABLE") {
        await query(`
          CREATE TABLE IF NOT EXISTS EmailVerificationToken (
            id VARCHAR(36) PRIMARY KEY,
            userId VARCHAR(36) NOT NULL,
            tokenHash VARCHAR(64) NOT NULL,
            expiresAt DATETIME NOT NULL,
            createdAt DATETIME NOT NULL,
            UNIQUE KEY unique_user (userId),
            FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
          )
        `);
        await query(
          `INSERT INTO EmailVerificationToken (id, userId, tokenHash, expiresAt, createdAt)
           VALUES (?, ?, ?, ?, NOW())`,
          [randomUUID(), user.id, tokenHash, expiresAt]
        );
      } else {
        throw err;
      }
    }

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:8080";
    const verifyUrl = `${frontendUrl}/verify-email?token=${verifyToken}`;

    await sendEmail({
      to: user.email,
      subject: "Verifica tu email - Boletera",
      html: getEmailVerificationEmail(user.name, verifyUrl),
    });

    return { success: true };
  });

  // GET /api/auth/verify-email - Verificar email con token
  app.get("/api/auth/verify-email", async (request, reply) => {
    const { token } = request.query as { token: string };

    if (!token) {
      return reply.code(400).send({ success: false, error: "Token requerido" });
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");

    const [verifyToken] = await query<RowDataPacket[]>(
      `SELECT id, userId, expiresAt FROM EmailVerificationToken WHERE tokenHash = ? LIMIT 1`,
      [tokenHash]
    );

    if (!verifyToken || new Date(verifyToken.expiresAt) < new Date()) {
      return reply.code(400).send({ success: false, error: "Token inválido o expirado" });
    }

    // Marcar email como verificado
    await query(
      `UPDATE User SET emailVerified = TRUE, updated_at = NOW() WHERE id = ?`,
      [verifyToken.userId]
    );

    // Eliminar token
    await query(`DELETE FROM EmailVerificationToken WHERE id = ?`, [verifyToken.id]);

    return { success: true, message: "Email verificado correctamente" };
  });
}
