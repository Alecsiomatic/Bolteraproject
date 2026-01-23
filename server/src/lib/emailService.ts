import nodemailer from "nodemailer";
import { env } from "../config/env";

// Configuración del transporter
// En desarrollo, podemos usar un servicio como Mailtrap, Ethereal, o el fake SMTP
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.ethereal.email",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true", // true para 465, false para otros
  auth: {
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
  },
});

// Si no hay credenciales, crear cuenta de prueba de Ethereal
let testAccountPromise: Promise<nodemailer.TestAccount | null> | null = null;

async function getTransporter() {
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    return transporter;
  }

  // En desarrollo, usar Ethereal (fake SMTP para pruebas)
  if (!testAccountPromise) {
    testAccountPromise = nodemailer.createTestAccount().catch(() => null);
  }

  const testAccount = await testAccountPromise;
  if (testAccount) {
    return nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }

  // Si todo falla, retornar el transporter original (fallará silenciosamente)
  return transporter;
}

const FROM_EMAIL = process.env.EMAIL_FROM || "Boletera <noreply@boletera.com>";
const APP_NAME = process.env.APP_NAME || "Boletera";
const APP_URL = process.env.APP_URL || "http://localhost:8080";

export interface OrderEmailData {
  orderNumber: string;
  buyerName: string;
  buyerEmail: string;
  total: number;
  currency: string;
  eventName: string;
  eventDate: Date;
  venueName: string;
  tickets: Array<{
    ticketCode: string;
    tierName?: string;
    seatInfo?: string;
    price: number;
  }>;
}

export interface ReminderEmailData {
  buyerName: string;
  buyerEmail: string;
  eventName: string;
  eventDate: Date;
  venueName: string;
  venueAddress?: string;
  ticketCount: number;
  orderNumber: string;
}

/**
 * Envía email de confirmación de compra
 */
export async function sendOrderConfirmationEmail(data: OrderEmailData): Promise<{ success: boolean; messageId?: string; previewUrl?: string; error?: string }> {
  try {
    const mailer = await getTransporter();
    
    const ticketRows = data.tickets
      .map(
        (t) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${t.ticketCode}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${t.tierName || "General"}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${t.seatInfo || "Sin asiento asignado"}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${data.currency} $${t.price.toFixed(2)}</td>
        </tr>
      `
      )
      .join("");

    const eventDate = new Date(data.eventDate);
    const dateStr = eventDate.toLocaleDateString("es-MX", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const timeStr = eventDate.toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #1a1a2e; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px;">${APP_NAME}</h1>
        <p style="color: #cccccc; margin: 10px 0 0;">¡Gracias por tu compra!</p>
      </div>
      
      <div style="background: #ffffff; padding: 30px; border: 1px solid #eee;">
        <h2 style="color: #1a1a2e; margin-top: 0;">Hola ${data.buyerName},</h2>
        
        <p>Tu compra ha sido confirmada. Aquí están los detalles de tu orden:</p>
        
        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0 0 10px; color: #1a1a2e;">${data.eventName}</h3>
          <p style="margin: 5px 0;"><strong>📅 Fecha:</strong> ${dateStr}</p>
          <p style="margin: 5px 0;"><strong>🕐 Hora:</strong> ${timeStr}</p>
          <p style="margin: 5px 0;"><strong>📍 Lugar:</strong> ${data.venueName}</p>
        </div>
        
        <h3 style="color: #1a1a2e;">Tus boletos</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th style="padding: 10px; text-align: left;">Código</th>
              <th style="padding: 10px; text-align: left;">Tipo</th>
              <th style="padding: 10px; text-align: left;">Asiento</th>
              <th style="padding: 10px; text-align: right;">Precio</th>
            </tr>
          </thead>
          <tbody>
            ${ticketRows}
          </tbody>
          <tfoot>
            <tr style="background: #1a1a2e; color: #ffffff;">
              <td colspan="3" style="padding: 15px;"><strong>Total</strong></td>
              <td style="padding: 15px; text-align: right;"><strong>${data.currency} $${data.total.toFixed(2)}</strong></td>
            </tr>
          </tfoot>
        </table>
        
        <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #2e7d32;"><strong>📋 Número de orden:</strong> ${data.orderNumber}</p>
        </div>
        
        <p style="margin-top: 20px;">
          <a href="${APP_URL}/orders/${data.orderNumber}" style="display: inline-block; background: #1a1a2e; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            Ver mis boletos
          </a>
        </p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        
        <h3 style="color: #1a1a2e;">Instrucciones importantes</h3>
        <ul style="padding-left: 20px;">
          <li>Guarda este correo o descarga tus boletos en PDF</li>
          <li>Presenta el código QR de cada boleto en la entrada</li>
          <li>Cada boleto es válido para una sola entrada</li>
          <li>Llega con anticipación al evento</li>
        </ul>
      </div>
      
      <div style="background: #f5f5f5; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; color: #666;">
        <p style="margin: 0;">${APP_NAME} - Tu plataforma de boletos</p>
        <p style="margin: 5px 0;">Si tienes preguntas, contáctanos en soporte@boletera.com</p>
      </div>
    </body>
    </html>
    `;

    const info = await mailer.sendMail({
      from: FROM_EMAIL,
      to: data.buyerEmail,
      subject: `✅ Confirmación de compra - ${data.eventName}`,
      html,
    });

    // Para emails de prueba de Ethereal, obtener URL de preview
    const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;

    if (previewUrl) {
      console.log(`[Email] Preview URL: ${previewUrl}`);
    }

    return { success: true, messageId: info.messageId, previewUrl };
  } catch (error: any) {
    console.error("[Email] Error sending order confirmation:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Envía email de bienvenida a nuevo usuario
 */
export async function sendWelcomeEmail(name: string, email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const mailer = await getTransporter();

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #1a1a2e; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🎉 ¡Bienvenido a ${APP_NAME}!</h1>
      </div>
      
      <div style="background: #ffffff; padding: 30px; border: 1px solid #eee;">
        <h2 style="color: #1a1a2e; margin-top: 0;">Hola ${name},</h2>
        
        <p>Tu cuenta ha sido creada exitosamente. Ahora puedes explorar y comprar boletos para los mejores eventos.</p>
        
        <h3 style="color: #1a1a2e;">¿Qué puedes hacer?</h3>
        <ul style="padding-left: 20px;">
          <li>🎭 Explorar eventos de música, teatro, deportes y más</li>
          <li>🎟️ Comprar boletos de manera segura</li>
          <li>📱 Acceder a tus boletos digitales</li>
          <li>🔔 Recibir notificaciones de eventos que te interesan</li>
        </ul>
        
        <p style="margin-top: 25px;">
          <a href="${APP_URL}/events" style="display: inline-block; background: #1a1a2e; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-size: 16px;">
            Explorar eventos
          </a>
        </p>
      </div>
      
      <div style="background: #f5f5f5; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; color: #666;">
        <p style="margin: 0;">${APP_NAME}</p>
      </div>
    </body>
    </html>
    `;

    await mailer.sendMail({
      from: FROM_EMAIL,
      to: email,
      subject: `🎉 ¡Bienvenido a ${APP_NAME}!`,
      html,
    });

    return { success: true };
  } catch (error: any) {
    console.error("[Email] Error sending welcome email:", error);
    return { success: false, error: error.message };
  }
}

export interface TicketTransferEmailData {
  newHolderName: string;
  newHolderEmail: string;
  previousHolderName: string;
  previousHolderEmail: string;
  ticketCode: string;
  eventName: string;
  eventDate: Date;
  venueName: string;
  seatInfo?: string;
  personalMessage?: string;
}

/**
 * Envía email de notificación de transferencia de boleto al nuevo titular
 */
export async function sendTicketTransferEmail(data: TicketTransferEmailData): Promise<{ success: boolean; messageId?: string; previewUrl?: string; error?: string }> {
  try {
    const mailer = await getTransporter();
    
    const eventDate = new Date(data.eventDate);
    const dateStr = eventDate.toLocaleDateString("es-MX", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const timeStr = eventDate.toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const personalMessageHtml = data.personalMessage ? `
      <div style="background: #fff8e1; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
        <p style="margin: 0; font-style: italic;">"${data.personalMessage}"</p>
        <p style="margin: 10px 0 0; font-size: 12px; color: #666;">- ${data.previousHolderName}</p>
      </div>
    ` : "";

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🎁 ¡Te han transferido un boleto!</h1>
      </div>
      
      <div style="background: #ffffff; padding: 30px; border: 1px solid #eee;">
        <h2 style="color: #1a1a2e; margin-top: 0;">Hola ${data.newHolderName},</h2>
        
        <p><strong>${data.previousHolderName}</strong> te ha transferido un boleto para el siguiente evento:</p>
        
        ${personalMessageHtml}
        
        <div style="background: #f0f9f4; padding: 25px; border-radius: 10px; margin: 25px 0; border-left: 4px solid #38ef7d;">
          <h3 style="margin: 0 0 15px; color: #1a1a2e; font-size: 22px;">🎫 ${data.eventName}</h3>
          <p style="margin: 8px 0; font-size: 16px;"><strong>📅 Fecha:</strong> ${dateStr}</p>
          <p style="margin: 8px 0; font-size: 16px;"><strong>🕐 Hora:</strong> ${timeStr}</p>
          <p style="margin: 8px 0; font-size: 16px;"><strong>📍 Lugar:</strong> ${data.venueName}</p>
          ${data.seatInfo ? `<p style="margin: 8px 0; font-size: 16px;"><strong>💺 Asiento:</strong> ${data.seatInfo}</p>` : ""}
        </div>
        
        <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <p style="margin: 0 0 10px; font-size: 14px; color: #666;">Tu código de boleto:</p>
          <p style="margin: 0; font-size: 24px; font-weight: bold; color: #2e7d32; letter-spacing: 2px;">${data.ticketCode}</p>
        </div>
        
        <p style="margin-top: 20px; text-align: center;">
          <a href="${APP_URL}/my-tickets" style="display: inline-block; background: #1a1a2e; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Ver mi boleto
          </a>
        </p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        
        <h3 style="color: #1a1a2e;">¿Qué hacer ahora?</h3>
        <ul style="padding-left: 20px;">
          <li>Este boleto ahora está registrado a tu nombre</li>
          <li>Inicia sesión en ${APP_NAME} con este email para ver todos tus boletos</li>
          <li>Presenta el código QR del boleto en la entrada del evento</li>
          <li>¡Disfruta del evento!</li>
        </ul>
        
        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin-top: 20px;">
          <p style="margin: 0; font-size: 13px; color: #666;">
            <strong>Nota:</strong> Si no solicitaste esta transferencia o no conoces a ${data.previousHolderName}, 
            por favor contáctanos inmediatamente.
          </p>
        </div>
      </div>
      
      <div style="background: #f5f5f5; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; color: #666;">
        <p style="margin: 0;">${APP_NAME} - Tu plataforma de boletos</p>
        <p style="margin: 5px 0;">Si tienes preguntas, contáctanos en soporte@boletera.com</p>
      </div>
    </body>
    </html>
    `;

    const info = await mailer.sendMail({
      from: FROM_EMAIL,
      to: data.newHolderEmail,
      subject: `🎁 ${data.previousHolderName} te ha transferido un boleto para ${data.eventName}`,
      html,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
    if (previewUrl) {
      console.log(`[Email] Transfer Preview URL: ${previewUrl}`);
    }

    return { success: true, messageId: info.messageId, previewUrl };
  } catch (error: any) {
    console.error("[Email] Error sending transfer email:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Envía email de confirmación de reembolso
 */
export async function sendRefundConfirmationEmail(
  buyerName: string,
  buyerEmail: string,
  orderNumber: string,
  eventName: string,
  refundAmount: number,
  currency: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const mailer = await getTransporter();

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #1a1a2e; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px;">${APP_NAME}</h1>
      </div>
      
      <div style="background: #ffffff; padding: 30px; border: 1px solid #eee;">
        <h2 style="color: #1a1a2e; margin-top: 0;">Hola ${buyerName},</h2>
        
        <p>Te confirmamos que tu solicitud de reembolso ha sido procesada.</p>
        
        <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0 0 10px; color: #1565c0;">Detalles del reembolso</h3>
          <p style="margin: 5px 0;"><strong>Orden:</strong> ${orderNumber}</p>
          <p style="margin: 5px 0;"><strong>Evento:</strong> ${eventName}</p>
          <p style="margin: 5px 0;"><strong>Monto reembolsado:</strong> ${currency} $${refundAmount.toFixed(2)}</p>
        </div>
        
        <p>El reembolso se reflejará en tu método de pago original en un plazo de 5-10 días hábiles, dependiendo de tu banco o institución financiera.</p>
        
        <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>
      </div>
      
      <div style="background: #f5f5f5; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; color: #666;">
        <p style="margin: 0;">${APP_NAME}</p>
      </div>
    </body>
    </html>
    `;

    await mailer.sendMail({
      from: FROM_EMAIL,
      to: buyerEmail,
      subject: `💰 Reembolso procesado - Orden ${orderNumber}`,
      html,
    });

    return { success: true };
  } catch (error: any) {
    console.error("[Email] Error sending refund email:", error);
    return { success: false, error: error.message };
  }
}

// Verificar conexión al iniciar (opcional, silencioso en desarrollo)
transporter.verify().catch(() => {
  console.log("[Email] SMTP not configured. Emails will use Ethereal test account.");
});

// Alias para usar en auth.ts
export const sendEmail = async (options: { to: string; subject: string; html: string }) => {
  try {
    const mailer = await getTransporter();
    const info = await mailer.sendMail({
      from: FROM_EMAIL,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
    
    // En desarrollo con Ethereal, mostrar URL de preview
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log("[Email] Preview URL:", previewUrl);
    }
    
    return { success: true, messageId: info.messageId, previewUrl };
  } catch (error: any) {
    console.error("[Email] Error sending email:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Genera HTML para email de recuperación de contraseña
 */
export function getPasswordResetEmail(userName: string, resetUrl: string): string {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px;">${APP_NAME}</h1>
      <p style="color: #00d4ff; margin: 10px 0 0;">Recuperar contraseña</p>
    </div>
    
    <div style="background: #ffffff; padding: 30px; border: 1px solid #eee;">
      <h2 style="color: #1a1a2e; margin-top: 0;">Hola ${userName},</h2>
      
      <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
      
      <p>Haz clic en el siguiente botón para crear una nueva contraseña:</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" 
           style="background: linear-gradient(135deg, #00d4ff 0%, #0066ff 100%); 
                  color: #ffffff; 
                  padding: 15px 40px; 
                  text-decoration: none; 
                  border-radius: 8px; 
                  font-weight: bold;
                  display: inline-block;">
          Restablecer contraseña
        </a>
      </div>
      
      <p style="color: #666; font-size: 14px;">Este enlace expirará en <strong>1 hora</strong>.</p>
      
      <p style="color: #666; font-size: 14px;">Si no solicitaste este cambio, puedes ignorar este email. Tu contraseña permanecerá sin cambios.</p>
      
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      
      <p style="color: #999; font-size: 12px;">Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
      <p style="color: #999; font-size: 12px; word-break: break-all;">${resetUrl}</p>
    </div>
    
    <div style="background: #f5f5f5; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; color: #666;">
      <p style="margin: 0;">© ${new Date().getFullYear()} ${APP_NAME}. Todos los derechos reservados.</p>
    </div>
  </body>
  </html>
  `;
}

/**
 * Genera HTML para email de verificación
 */
export function getEmailVerificationEmail(userName: string, verifyUrl: string): string {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px;">${APP_NAME}</h1>
      <p style="color: #00d4ff; margin: 10px 0 0;">Verifica tu email</p>
    </div>
    
    <div style="background: #ffffff; padding: 30px; border: 1px solid #eee;">
      <h2 style="color: #1a1a2e; margin-top: 0;">¡Bienvenido ${userName}!</h2>
      
      <p>Gracias por registrarte en ${APP_NAME}. Para completar tu registro, verifica tu dirección de email.</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verifyUrl}" 
           style="background: linear-gradient(135deg, #00d4ff 0%, #0066ff 100%); 
                  color: #ffffff; 
                  padding: 15px 40px; 
                  text-decoration: none; 
                  border-radius: 8px; 
                  font-weight: bold;
                  display: inline-block;">
          Verificar mi email
        </a>
      </div>
      
      <p style="color: #666; font-size: 14px;">Este enlace expirará en <strong>24 horas</strong>.</p>
      
      <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: #2e7d32;"><strong>¿Por qué verificar?</strong></p>
        <ul style="margin: 10px 0 0; padding-left: 20px; color: #666;">
          <li>Recuperar tu cuenta si olvidas tu contraseña</li>
          <li>Recibir confirmaciones de compra</li>
          <li>Recibir tus boletos digitales</li>
        </ul>
      </div>
      
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      
      <p style="color: #999; font-size: 12px;">Si el botón no funciona, copia y pega este enlace:</p>
      <p style="color: #999; font-size: 12px; word-break: break-all;">${verifyUrl}</p>
    </div>
    
    <div style="background: #f5f5f5; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; color: #666;">
      <p style="margin: 0;">© ${new Date().getFullYear()} ${APP_NAME}. Todos los derechos reservados.</p>
    </div>
  </body>
  </html>
  `;
}

/**
 * Envía email de recordatorio de evento
 */
export async function sendEventReminderEmail(data: ReminderEmailData, hoursUntilEvent: number): Promise<{ success: boolean; messageId?: string; previewUrl?: string; error?: string }> {
  try {
    const mailer = await getTransporter();
    
    const eventDate = new Date(data.eventDate);
    const dateStr = eventDate.toLocaleDateString("es-MX", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const timeStr = eventDate.toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
    });
    
    const urgencyText = hoursUntilEvent <= 2 
      ? "¡Tu evento es en menos de 2 horas!" 
      : hoursUntilEvent <= 24 
        ? "¡Tu evento es mañana!" 
        : `Tu evento es en ${Math.round(hoursUntilEvent)} horas`;
    
    const urgencyColor = hoursUntilEvent <= 2 ? "#e53935" : "#ff9800";

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px;">⏰ Recordatorio</h1>
        <p style="color: ${urgencyColor}; margin: 10px 0 0; font-weight: bold; font-size: 18px;">${urgencyText}</p>
      </div>
      
      <div style="background: #ffffff; padding: 30px; border: 1px solid #eee;">
        <h2 style="color: #1a1a2e; margin-top: 0;">Hola ${data.buyerName},</h2>
        
        <p>Este es un recordatorio de que tienes un evento próximo. ¡No olvides asistir!</p>
        
        <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 25px; border-radius: 12px; margin: 20px 0; border-left: 4px solid ${urgencyColor};">
          <h3 style="margin: 0 0 15px; color: #1a1a2e; font-size: 22px;">🎭 ${data.eventName}</h3>
          <p style="margin: 8px 0; font-size: 16px;"><strong>📅 Fecha:</strong> ${dateStr}</p>
          <p style="margin: 8px 0; font-size: 16px;"><strong>🕐 Hora:</strong> ${timeStr}</p>
          <p style="margin: 8px 0; font-size: 16px;"><strong>📍 Lugar:</strong> ${data.venueName}</p>
          ${data.venueAddress ? `<p style="margin: 8px 0; color: #666;"><strong>📌 Dirección:</strong> ${data.venueAddress}</p>` : ''}
          <p style="margin: 15px 0 0; padding-top: 15px; border-top: 1px solid #ddd;"><strong>🎟️ Boletos:</strong> ${data.ticketCount} entrada(s)</p>
        </div>
        
        <div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #e65100;"><strong>💡 Consejos para el día del evento:</strong></p>
          <ul style="margin: 10px 0 0; padding-left: 20px; color: #666;">
            <li>Llega con al menos 30 minutos de anticipación</li>
            <li>Ten listo el código QR de tus boletos en tu celular</li>
            <li>Revisa las restricciones del venue (no cámaras, bolsas, etc.)</li>
            <li>Verifica el estacionamiento o transporte disponible</li>
          </ul>
        </div>
        
        <div style="text-align: center; margin: 25px 0;">
          <a href="${APP_URL}/my-tickets" 
             style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); 
                    color: #ffffff; 
                    padding: 15px 40px; 
                    text-decoration: none; 
                    border-radius: 8px; 
                    font-weight: bold;
                    display: inline-block;">
            Ver mis boletos
          </a>
        </div>
        
        <p style="color: #666; font-size: 14px; text-align: center;">Orden: <strong>${data.orderNumber}</strong></p>
      </div>
      
      <div style="background: #f5f5f5; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; color: #666;">
        <p style="margin: 0;">© ${new Date().getFullYear()} ${APP_NAME}. Todos los derechos reservados.</p>
        <p style="margin: 5px 0 0;">¿Preguntas? Contáctanos en soporte@boletera.com</p>
      </div>
    </body>
    </html>
    `;

    const subject = hoursUntilEvent <= 2 
      ? `⚡ ¡${data.eventName} es en menos de 2 horas!`
      : hoursUntilEvent <= 24 
        ? `⏰ Recordatorio: ${data.eventName} es mañana`
        : `📅 Recordatorio: ${data.eventName}`;

    const info = await mailer.sendMail({
      from: FROM_EMAIL,
      to: data.buyerEmail,
      subject,
      html,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
    if (previewUrl) {
      console.log(`[Email] Reminder preview: ${previewUrl}`);
    }

    return { success: true, messageId: info.messageId, previewUrl };
  } catch (error: any) {
    console.error("[Email] Error sending reminder:", error);
    return { success: false, error: error.message };
  }
}