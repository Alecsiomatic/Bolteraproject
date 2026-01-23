import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { verifyToken, JwtPayload } from "../utils/auth";

// Extender el tipo de FastifyRequest para incluir el usuario
declare module "fastify" {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}

/**
 * Extrae el token del header Authorization
 */
function extractToken(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;
  if (!authHeader) return null;
  
  // Formato: "Bearer <token>"
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;
  
  return parts[1];
}

/**
 * Middleware que REQUIERE autenticación
 * Si no hay token válido, retorna 401
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const token = extractToken(request);
  
  if (!token) {
    return reply.code(401).send({ 
      error: "unauthorized",
      message: "Token de autenticación requerido" 
    });
  }
  
  try {
    const payload = verifyToken(token);
    request.user = payload;
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      return reply.code(401).send({ 
        error: "token_expired",
        message: "El token ha expirado, inicia sesión nuevamente" 
      });
    }
    return reply.code(401).send({ 
      error: "invalid_token",
      message: "Token inválido" 
    });
  }
}

/**
 * Middleware que requiere rol ADMIN
 */
export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  await requireAuth(request, reply);
  
  // Si requireAuth ya envió respuesta, salir
  if (reply.sent) return;
  
  if (request.user?.role !== "ADMIN") {
    return reply.code(403).send({ 
      error: "forbidden",
      message: "Se requiere rol de administrador" 
    });
  }
}

/**
 * Middleware que requiere rol ADMIN u OPERATOR
 */
export async function requireOperator(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  await requireAuth(request, reply);
  
  if (reply.sent) return;
  
  const role = request.user?.role;
  if (role !== "ADMIN" && role !== "OPERATOR") {
    return reply.code(403).send({ 
      error: "forbidden",
      message: "Se requiere rol de operador o administrador" 
    });
  }
}

/**
 * Middleware OPCIONAL de autenticación
 * No falla si no hay token, pero si hay uno válido, lo decodifica
 */
export async function optionalAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const token = extractToken(request);
  
  if (!token) {
    return; // Continúa sin usuario
  }
  
  try {
    const payload = verifyToken(token);
    request.user = payload;
  } catch {
    // Token inválido pero opcional, continuar sin usuario
  }
}

/**
 * Registra los hooks de autenticación en la app
 */
export function registerAuthHooks(app: FastifyInstance) {
  // Decorar request con user
  app.decorateRequest("user", undefined);
  
  // Hook global para logging
  app.addHook("onRequest", async (request) => {
    const token = extractToken(request);
    if (token) {
      try {
        request.user = verifyToken(token);
      } catch {
        // Token inválido, continuar sin usuario
      }
    }
  });
}
