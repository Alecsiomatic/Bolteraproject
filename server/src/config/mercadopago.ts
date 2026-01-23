/**
 * Configuración de Mercado Pago
 * 
 * Carga credenciales desde:
 * 1. Base de datos (tabla Setting) - PRIORIDAD
 * 2. Variables de entorno - FALLBACK
 * 
 * Para producción, configura las siguientes variables de entorno:
 * - MP_ACCESS_TOKEN: Tu token de acceso de Mercado Pago
 * - MP_PUBLIC_KEY: Tu clave pública de Mercado Pago
 * - MP_WEBHOOK_SECRET: Secreto para validar webhooks
 * 
 * Obtén tus credenciales en: https://www.mercadopago.com.mx/developers/panel/credentials
 */

export interface MercadoPagoConfigType {
  // Credenciales
  accessToken: string;
  publicKey: string;
  webhookSecret: string;
  
  // URLs
  apiUrl: string;
  
  // Configuración de la integración
  integratorId: string;
  
  // URLs de retorno
  backUrls: {
    success: string;
    failure: string;
    pending: string;
  };
  
  // URL del webhook
  notificationUrl: string;
  
  // Configuración de expiración
  expirationMinutes: number;
  
  // País y moneda
  country: string;
  currency: string;
}

// Configuración inicial desde variables de entorno
export const mercadoPagoConfig: MercadoPagoConfigType = {
  // Credenciales (configurar en variables de entorno o desde admin)
  accessToken: process.env.MP_ACCESS_TOKEN || "",
  publicKey: process.env.MP_PUBLIC_KEY || "",
  webhookSecret: process.env.MP_WEBHOOK_SECRET || "",
  
  // URLs
  apiUrl: "https://api.mercadopago.com",
  
  // Configuración de la integración
  integratorId: process.env.MP_INTEGRATOR_ID || "",
  
  // URLs de retorno (configurar según tu dominio)
  backUrls: {
    success: process.env.APP_URL ? `${process.env.APP_URL}/payment/success` : "http://localhost:5173/payment/success",
    failure: process.env.APP_URL ? `${process.env.APP_URL}/payment/failure` : "http://localhost:5173/payment/failure",
    pending: process.env.APP_URL ? `${process.env.APP_URL}/payment/pending` : "http://localhost:5173/payment/pending",
  },
  
  // URL del webhook
  notificationUrl: process.env.MP_WEBHOOK_URL || "",
  
  // Configuración de expiración
  expirationMinutes: 30, // Tiempo de expiración del pago
  
  // País y moneda
  country: "MX",
  currency: "MXN",
};

export function isMercadoPagoConfigured(): boolean {
  return !!(mercadoPagoConfig.accessToken && mercadoPagoConfig.publicKey);
}

export function isTestMode(): boolean {
  return !mercadoPagoConfig.accessToken || mercadoPagoConfig.accessToken.startsWith("TEST-");
}

/**
 * Recargar configuración desde base de datos
 * Llamar esta función después de actualizar settings
 */
export async function reloadMercadoPagoConfig(query: Function): Promise<void> {
  try {
    const settings = await query(
      `SELECT \`key\`, value FROM Setting WHERE \`key\` LIKE 'mercadopago.%'`
    );
    
    for (const setting of settings) {
      switch (setting.key) {
        case "mercadopago.accessToken":
          mercadoPagoConfig.accessToken = setting.value;
          break;
        case "mercadopago.publicKey":
          mercadoPagoConfig.publicKey = setting.value;
          break;
        case "mercadopago.webhookSecret":
          mercadoPagoConfig.webhookSecret = setting.value;
          break;
        case "mercadopago.webhookUrl":
          mercadoPagoConfig.notificationUrl = setting.value;
          break;
        case "mercadopago.successUrl":
          mercadoPagoConfig.backUrls.success = setting.value;
          break;
        case "mercadopago.failureUrl":
          mercadoPagoConfig.backUrls.failure = setting.value;
          break;
        case "mercadopago.pendingUrl":
          mercadoPagoConfig.backUrls.pending = setting.value;
          break;
      }
    }
    
    console.log("[MercadoPago] Config reloaded from database", {
      configured: isMercadoPagoConfigured(),
      testMode: isTestMode(),
    });
  } catch (error) {
    console.error("[MercadoPago] Error loading config from database:", error);
  }
}

/**
 * Actualizar configuración en base de datos
 */
export async function updateMercadoPagoConfig(
  query: Function,
  config: Partial<{
    accessToken: string;
    publicKey: string;
    webhookSecret: string;
    webhookUrl: string;
    successUrl: string;
    failureUrl: string;
    pendingUrl: string;
  }>
): Promise<boolean> {
  try {
    const updates = Object.entries(config).filter(([, v]) => v !== undefined);
    
    for (const [key, value] of updates) {
      const settingKey = `mercadopago.${key}`;
      
      // Upsert setting
      await query(
        `INSERT INTO Setting (id, \`key\`, value, category, description, createdAt, updatedAt)
         VALUES (UUID(), ?, ?, 'payments', ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE value = VALUES(value), updatedAt = NOW()`,
        [settingKey, value, `MercadoPago ${key}`]
      );
    }
    
    // Recargar config
    await reloadMercadoPagoConfig(query);
    
    return true;
  } catch (error) {
    console.error("[MercadoPago] Error updating config:", error);
    return false;
  }
}
