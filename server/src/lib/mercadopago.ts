/**
 * Servicio de Mercado Pago
 * 
 * Este archivo contiene la lógica para interactuar con la API de Mercado Pago.
 * Configurado con el SDK oficial v2.
 * 
 * Soporta:
 * - Checkout Pro (preferencias de pago con redirect)
 * - Checkout Bricks (pago embebido con card token)
 * - Webhooks IPN
 * - Reembolsos
 */

import { MercadoPagoConfig, Preference, Payment, PaymentRefund } from "mercadopago";
import { mercadoPagoConfig, isMercadoPagoConfigured, reloadMercadoPagoConfig } from "../config/mercadopago";
import crypto from "crypto";

// Cliente de MercadoPago (se inicializa bajo demanda)
let mpClient: MercadoPagoConfig | null = null;

function getMercadoPagoClient(): MercadoPagoConfig | null {
  if (!isMercadoPagoConfigured()) {
    return null;
  }
  
  if (!mpClient) {
    mpClient = new MercadoPagoConfig({ 
      accessToken: mercadoPagoConfig.accessToken!,
      options: { timeout: 5000 }
    });
  }
  
  return mpClient;
}

// Tipos
export interface PaymentPreferenceItem {
  id: string;
  title: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  currencyId?: string;
}

export interface PaymentPreference {
  items: PaymentPreferenceItem[];
  payer?: {
    name?: string;
    email: string;
    phone?: {
      areaCode?: string;
      number?: string;
    };
  };
  externalReference: string; // orderNumber
  metadata?: Record<string, any>;
}

export interface CreatePreferenceResult {
  success: boolean;
  preferenceId?: string;
  initPoint?: string; // URL para redirigir al usuario
  sandboxInitPoint?: string;
  error?: string;
}

export interface PaymentNotification {
  id: string;
  type: "payment" | "merchant_order" | "chargebacks";
  data: {
    id: string;
  };
}

export interface PaymentStatus {
  id: string;
  status: "pending" | "approved" | "authorized" | "in_process" | "in_mediation" | "rejected" | "cancelled" | "refunded" | "charged_back";
  statusDetail: string;
  externalReference: string;
  transactionAmount: number;
  currencyId: string;
  paymentMethodId: string;
  paymentTypeId: string;
  payerEmail?: string;
  payer: {
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

/**
 * Crear una preferencia de pago
 */
export async function createPaymentPreference(
  preference: PaymentPreference
): Promise<CreatePreferenceResult> {
  const client = getMercadoPagoClient();
  
  if (!client) {
    console.log("[MercadoPago] No configurado. Retornando preferencia de prueba.");
    
    // Retornar datos de prueba para desarrollo
    return {
      success: true,
      preferenceId: `test_pref_${Date.now()}`,
      initPoint: `${mercadoPagoConfig.backUrls.success}?external_reference=${preference.externalReference}`,
      sandboxInitPoint: `${mercadoPagoConfig.backUrls.success}?external_reference=${preference.externalReference}`,
    };
  }

  try {
    const preferenceClient = new Preference(client);
    
    const result = await preferenceClient.create({
      body: {
        items: preference.items.map(item => ({
          id: item.id,
          title: item.title,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          currency_id: item.currencyId || mercadoPagoConfig.currency,
        })),
        payer: preference.payer ? {
          name: preference.payer.name,
          email: preference.payer.email,
          phone: preference.payer.phone ? {
            area_code: preference.payer.phone.areaCode,
            number: preference.payer.phone.number,
          } : undefined,
        } : undefined,
        back_urls: mercadoPagoConfig.backUrls,
        auto_return: "approved",
        external_reference: preference.externalReference,
        notification_url: mercadoPagoConfig.notificationUrl || undefined,
        expires: true,
        expiration_date_from: new Date().toISOString(),
        expiration_date_to: new Date(Date.now() + mercadoPagoConfig.expirationMinutes * 60 * 1000).toISOString(),
        metadata: preference.metadata,
      },
    });

    return {
      success: true,
      preferenceId: result.id,
      initPoint: result.init_point,
      sandboxInitPoint: result.sandbox_init_point,
    };
  } catch (error: any) {
    console.error("[MercadoPago] Error creating preference:", error);
    return {
      success: false,
      error: error.message || "Error al crear preferencia de pago",
    };
  }
}

/**
 * Obtener estado de un pago
 */
export async function getPaymentStatus(paymentId: string): Promise<PaymentStatus | null> {
  const client = getMercadoPagoClient();
  
  if (!client) {
    console.log("[MercadoPago] No configurado");
    return null;
  }

  try {
    const paymentClient = new Payment(client);
    const payment = await paymentClient.get({ id: paymentId });

    return {
      id: payment.id?.toString() || "",
      status: payment.status as PaymentStatus["status"],
      statusDetail: payment.status_detail || "",
      externalReference: payment.external_reference || "",
      transactionAmount: payment.transaction_amount || 0,
      currencyId: payment.currency_id || mercadoPagoConfig.currency,
      paymentMethodId: payment.payment_method_id || "",
      paymentTypeId: payment.payment_type_id || "",
      payerEmail: payment.payer?.email || "",
      payer: {
        email: payment.payer?.email || "",
        firstName: payment.payer?.first_name,
        lastName: payment.payer?.last_name,
      },
    };
  } catch (error: any) {
    console.error("[MercadoPago] Error getting payment status:", error);
    return null;
  }
}

/**
 * Procesar reembolso REAL en MercadoPago
 */
export async function processRefund(
  paymentId: string, 
  amount?: number
): Promise<{ success: boolean; refundId?: string; error?: string }> {
  const client = getMercadoPagoClient();
  
  if (!client) {
    console.log("[MercadoPago] No configurado. Reembolso simulado.");
    return { success: true, refundId: `test_refund_${Date.now()}` };
  }

  try {
    const refundClient = new PaymentRefund(client);
    
    // Si no se especifica amount, se hace reembolso total
    const result = await refundClient.create({
      payment_id: parseInt(paymentId),
      body: amount ? { amount } : {},
    });

    console.log(`[MercadoPago] Refund created: ${result.id} for payment ${paymentId}`);
    
    return {
      success: true,
      refundId: result.id?.toString(),
    };
  } catch (error: any) {
    console.error("[MercadoPago] Error processing refund:", error);
    
    // Manejar errores específicos de MP
    const errorMessage = error.message || "Error procesando reembolso";
    const apiError = error.cause?.find?.((e: any) => e.description);
    
    return { 
      success: false, 
      error: apiError?.description || errorMessage 
    };
  }
}

/**
 * Procesar pago directo con token de tarjeta (Checkout Bricks)
 */
export interface ProcessPaymentParams {
  amount: number;
  cardToken: string;
  description: string;
  email: string;
  externalReference: string;
  installments?: number;
  paymentMethodId?: string;
  issuerId?: string;
}

export interface ProcessPaymentResult {
  success: boolean;
  paymentId?: string;
  status?: "approved" | "pending" | "in_process" | "rejected" | "cancelled";
  statusDetail?: string;
  error?: string;
}

export async function processDirectPayment(
  params: ProcessPaymentParams
): Promise<ProcessPaymentResult> {
  const client = getMercadoPagoClient();
  
  if (!client) {
    console.log("[MercadoPago] No configurado. Pago simulado.");
    // Simular pago exitoso en modo desarrollo
    return {
      success: true,
      paymentId: `test_payment_${Date.now()}`,
      status: "approved",
      statusDetail: "accredited",
    };
  }

  try {
    const paymentClient = new Payment(client);
    
    const result = await paymentClient.create({
      body: {
        transaction_amount: params.amount,
        token: params.cardToken,
        description: params.description,
        installments: params.installments || 1,
        payment_method_id: params.paymentMethodId,
        issuer_id: params.issuerId ? parseInt(params.issuerId) : undefined,
        payer: {
          email: params.email,
        },
        external_reference: params.externalReference,
        notification_url: mercadoPagoConfig.notificationUrl || undefined,
      },
    });

    console.log(`[MercadoPago] Payment created: ${result.id} - Status: ${result.status}`);

    return {
      success: result.status === "approved",
      paymentId: result.id?.toString(),
      status: result.status as ProcessPaymentResult["status"],
      statusDetail: result.status_detail || undefined,
      error: result.status !== "approved" ? `Pago ${result.status}: ${result.status_detail}` : undefined,
    };
  } catch (error: any) {
    console.error("[MercadoPago] Error processing payment:", error);
    
    const errorMessage = error.message || "Error procesando pago";
    const apiError = error.cause?.find?.((e: any) => e.description);
    
    return {
      success: false,
      status: "rejected",
      error: apiError?.description || errorMessage,
    };
  }
}

/**
 * Validar firma del webhook
 */
export function validateWebhookSignature(
  signature: string,
  requestId: string,
  dataId: string
): boolean {
  if (!mercadoPagoConfig.webhookSecret) {
    console.log("[MercadoPago] No webhook secret configured, skipping validation");
    return true; // En desarrollo sin secret, aceptar
  }

  try {
    // Formato de signature: "ts=xxx,v1=xxx"
    const parts = signature.split(",");
    const ts = parts.find(p => p.startsWith("ts="))?.split("=")[1];
    const v1 = parts.find(p => p.startsWith("v1="))?.split("=")[1];
    
    if (!ts || !v1) {
      console.error("[MercadoPago] Invalid signature format");
      return false;
    }
    
    // Construir el manifest para verificar
    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    
    // Calcular HMAC
    const hmac = crypto
      .createHmac("sha256", mercadoPagoConfig.webhookSecret)
      .update(manifest)
      .digest("hex");
    
    const isValid = hmac === v1;
    
    if (!isValid) {
      console.error("[MercadoPago] Signature mismatch");
    }
    
    return isValid;
  } catch (error) {
    console.error("[MercadoPago] Error validating signature:", error);
    return false;
  }
}
