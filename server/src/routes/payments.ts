import { FastifyInstance } from "fastify";
import { RowDataPacket } from "mysql2";
import { query } from "../lib/db";
import { requireAuth, requireAdmin } from "../lib/authMiddleware";
import { 
  createPaymentPreference, 
  getPaymentStatus, 
  validateWebhookSignature,
  processDirectPayment,
  PaymentPreferenceItem 
} from "../lib/mercadopago";
import { mercadoPagoConfig, isMercadoPagoConfigured, isTestMode, reloadMercadoPagoConfig, updateMercadoPagoConfig } from "../config/mercadopago";
import { confirmReservation } from "../lib/reservations";
import { sendOrderConfirmationEmail, OrderEmailData } from "../lib/emailService";
import { randomUUID } from "crypto";

export async function paymentsRoutes(app: FastifyInstance) {
  
  // Cargar config de MP desde DB al iniciar
  await reloadMercadoPagoConfig(query);
  
  // GET /api/payments/config - Obtener configuración pública de pagos
  app.get("/api/payments/config", async (request, reply) => {
    return reply.send({
      success: true,
      provider: "mercadopago",
      configured: isMercadoPagoConfigured(),
      publicKey: mercadoPagoConfig.publicKey || null,
      country: mercadoPagoConfig.country,
      currency: mercadoPagoConfig.currency,
      testMode: isTestMode(),
    });
  });
  
  // GET /api/payments/admin/config - Obtener configuración completa (solo admin)
  app.get("/api/payments/admin/config", {
    preHandler: [requireAuth, requireAdmin],
    handler: async (request, reply) => {
      // Ocultar parte del access token por seguridad
      const maskedToken = mercadoPagoConfig.accessToken 
        ? `${mercadoPagoConfig.accessToken.slice(0, 12)}...${mercadoPagoConfig.accessToken.slice(-4)}`
        : "";
      
      return reply.send({
        success: true,
        config: {
          accessToken: maskedToken,
          publicKey: mercadoPagoConfig.publicKey,
          webhookSecret: mercadoPagoConfig.webhookSecret ? "••••••••" : "",
          webhookUrl: mercadoPagoConfig.notificationUrl,
          backUrls: mercadoPagoConfig.backUrls,
          country: mercadoPagoConfig.country,
          currency: mercadoPagoConfig.currency,
          configured: isMercadoPagoConfigured(),
          testMode: isTestMode(),
        },
      });
    },
  });
  
  // PUT /api/payments/admin/config - Actualizar configuración de MercadoPago
  app.put("/api/payments/admin/config", {
    preHandler: [requireAuth, requireAdmin],
    handler: async (request, reply) => {
      const { accessToken, publicKey, webhookSecret, webhookUrl, successUrl, failureUrl, pendingUrl } = request.body as {
        accessToken?: string;
        publicKey?: string;
        webhookSecret?: string;
        webhookUrl?: string;
        successUrl?: string;
        failureUrl?: string;
        pendingUrl?: string;
      };
      
      const success = await updateMercadoPagoConfig(query, {
        accessToken,
        publicKey,
        webhookSecret,
        webhookUrl,
        successUrl,
        failureUrl,
        pendingUrl,
      });
      
      if (!success) {
        return reply.status(500).send({
          success: false,
          error: "Error al actualizar configuración",
        });
      }
      
      return reply.send({
        success: true,
        message: "Configuración actualizada correctamente",
        configured: isMercadoPagoConfigured(),
        testMode: isTestMode(),
      });
    },
  });

  // POST /api/payments/preference - Crear preferencia de pago para una reserva
  app.post("/api/payments/preference", {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { ticketIds, buyerName, buyerEmail, buyerPhone } = request.body as {
        ticketIds: string[];
        buyerName: string;
        buyerEmail: string;
        buyerPhone?: string;
      };
      const user = (request as any).user;

      if (!ticketIds || ticketIds.length === 0) {
        return reply.status(400).send({
          success: false,
          error: "ticketIds es requerido",
        });
      }

      // Obtener tickets reservados
      const tickets = await query<RowDataPacket[]>(
        `SELECT t.id, t.price, t.currency, t.sessionId, t.seatId, t.tierId, t.holderEmail,
                pt.label as tierName,
                e.id as eventId, e.name as eventName,
                es.startsAt as eventDate,
                v.name as venueName, v.address as venueAddress,
                s.label as seatLabel, s.rowLabel as seatRow,
                vz.name as zoneName
         FROM Ticket t
         LEFT JOIN EventPriceTier pt ON pt.id = t.tierId
         JOIN EventSession es ON es.id = t.sessionId
         JOIN Event e ON e.id = es.eventId
         JOIN Venue v ON v.id = e.venueId
         LEFT JOIN Seat s ON s.id = t.seatId
         LEFT JOIN VenueZone vz ON vz.id = s.zoneId
         WHERE t.id IN (?) AND t.status = 'RESERVED'`,
        [ticketIds]
      );

      if (tickets.length !== ticketIds.length) {
        return reply.status(400).send({
          success: false,
          error: "Algunos tickets no están disponibles o ya expiraron",
        });
      }

      // Verificar que las reservas pertenecen al usuario
      const isOwner = tickets.every((t: any) => t.holderEmail === user.email);
      if (!isOwner) {
        return reply.status(403).send({
          success: false,
          error: "No tienes permiso para pagar estos tickets",
        });
      }

      // Crear orden temporal
      const orderId = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const total = tickets.reduce((sum: number, t: any) => sum + Number(t.price), 0);

      // Preparar items para Mercado Pago
      const items: PaymentPreferenceItem[] = tickets.map((ticket: any, index: number) => ({
        id: ticket.id,
        title: `${ticket.eventName} - ${ticket.tierName || "General"}`,
        description: ticket.seatLabel 
          ? `${ticket.zoneName || ""} Fila ${ticket.seatRow} Asiento ${ticket.seatLabel}`.trim()
          : "Acceso general",
        quantity: 1,
        unitPrice: Number(ticket.price),
        currencyId: ticket.currency,
      }));

      // Crear preferencia
      const result = await createPaymentPreference({
        items,
        payer: {
          name: buyerName,
          email: buyerEmail,
          phone: buyerPhone ? { number: buyerPhone } : undefined,
        },
        externalReference: orderId,
        metadata: {
          ticketIds,
          userId: user.id,
          buyerName,
          buyerEmail,
          buyerPhone,
        },
      });

      if (!result.success) {
        return reply.status(500).send({
          success: false,
          error: result.error || "Error al crear preferencia de pago",
        });
      }

      return reply.send({
        success: true,
        preference: {
          id: result.preferenceId,
          initPoint: result.initPoint,
          sandboxInitPoint: result.sandboxInitPoint,
        },
        order: {
          id: orderId,
          total,
          currency: tickets[0]?.currency || "MXN",
          items: items.length,
        },
      });
    },
  });

  // POST /api/payments/webhook - Webhook de Mercado Pago
  app.post("/api/payments/webhook", async (request, reply) => {
    const { type, data } = request.body as {
      type: string;
      data: { id: string };
    };

    console.log(`[Webhook] Received: ${type}`, data);

    // Validar firma (cuando esté configurado)
    const signature = request.headers["x-signature"] as string;
    const requestId = request.headers["x-request-id"] as string;
    
    if (mercadoPagoConfig.webhookSecret && signature) {
      const isValid = validateWebhookSignature(signature, requestId, data.id);
      if (!isValid) {
        console.error("[Webhook] Invalid signature");
        return reply.status(401).send({ error: "Invalid signature" });
      }
    }

    // Procesar según el tipo de notificación
    if (type === "payment") {
      const payment = await getPaymentStatus(data.id);
      
      if (payment && payment.status === "approved") {
        // Buscar la orden por external_reference
        const orderNumber = payment.externalReference;
        
        console.log(`[Webhook] Payment approved for order: ${orderNumber}`);
        
        // Buscar orden pendiente con este orderNumber
        const [order] = await query<RowDataPacket[]>(
          `SELECT id, userId, status FROM \`Order\` WHERE orderNumber = ? AND status = 'PENDING' LIMIT 1`,
          [orderNumber]
        );

        if (order) {
          // Obtener tickets de esta orden
          const tickets = await query<RowDataPacket[]>(
            `SELECT t.id FROM Ticket t
             WHERE t.orderId = ? AND t.status = 'RESERVED'`,
            [order.id]
          );

          if (tickets.length > 0) {
            const ticketIds = tickets.map(t => t.id);
            
            // Confirmar la reservación
            const confirmResult = await confirmReservation(ticketIds, order.id, {
              paymentMethod: payment.paymentMethodId || "mercadopago",
              paymentReference: data.id,
              holderEmail: payment.payerEmail || "",
              holderName: "",
            });

            if (confirmResult.success) {
              console.log(`[Webhook] Order ${orderNumber} confirmed with ${ticketIds.length} tickets`);
              
              // Enviar email de confirmación
              try {
                const [orderDetails] = await query<RowDataPacket[]>(
                  `SELECT o.*, u.email as buyerEmail, u.name as buyerName,
                          e.name as eventName, es.startsAt as eventDate,
                          v.name as venueName
                   FROM \`Order\` o
                   JOIN User u ON u.id = o.userId
                   JOIN Ticket t ON t.orderId = o.id
                   JOIN EventSession es ON es.id = t.sessionId
                   JOIN Event e ON e.id = es.eventId
                   LEFT JOIN Venue v ON v.id = e.venueId
                   WHERE o.id = ?
                   LIMIT 1`,
                  [order.id]
                );

                const ticketDetails = await query<RowDataPacket[]>(
                  `SELECT t.ticketCode, t.price, pt.label as tierName,
                          CONCAT_WS(' ', s.rowLabel, s.label) as seatInfo
                   FROM Ticket t
                   LEFT JOIN EventPriceTier pt ON pt.id = t.tierId
                   LEFT JOIN Seat s ON s.id = t.seatId
                   WHERE t.orderId = ?`,
                  [order.id]
                );

                if (orderDetails) {
                  await sendOrderConfirmationEmail({
                    orderNumber: orderNumber!,
                    buyerName: orderDetails.buyerName,
                    buyerEmail: orderDetails.buyerEmail,
                    total: orderDetails.total,
                    currency: orderDetails.currency || "MXN",
                    eventName: orderDetails.eventName,
                    eventDate: new Date(orderDetails.eventDate),
                    venueName: orderDetails.venueName || "Por confirmar",
                    tickets: ticketDetails.map(t => ({
                      ticketCode: t.ticketCode,
                      tierName: t.tierName,
                      seatInfo: t.seatInfo,
                      price: t.price,
                    })),
                  });
                }
              } catch (emailErr) {
                console.error("[Webhook] Error sending confirmation email:", emailErr);
              }
            } else {
              console.error(`[Webhook] Failed to confirm order ${orderNumber}:`, confirmResult.error);
            }
          }
        } else {
          console.log(`[Webhook] Order ${orderNumber} not found or already processed`);
        }
      }
    }

    // Siempre responder 200 para que MP no reintente
    return reply.send({ received: true });
  });

  // GET /api/payments/verify - Verificar pago y obtener orden (para página de success)
  app.get("/api/payments/verify", async (request, reply) => {
    const { external_reference, payment_id } = request.query as {
      external_reference?: string;
      payment_id?: string;
    };

    if (!external_reference) {
      return reply.status(400).send({ success: false, error: "Referencia requerida" });
    }

    // Buscar orden por external_reference (orderNumber)
    const [order] = await query<RowDataPacket[]>(
      `SELECT o.id, o.orderNumber, o.total, o.currency, o.status,
              e.id as eventId, e.name as eventName,
              es.startsAt, es.endsAt,
              v.name as venueName, v.city as venueCity
       FROM \`Order\` o
       JOIN Ticket t ON t.orderId = o.id
       JOIN EventSession es ON es.id = t.sessionId
       JOIN Event e ON e.id = es.eventId
       LEFT JOIN Venue v ON v.id = e.venueId
       WHERE o.orderNumber = ?
       LIMIT 1`,
      [external_reference]
    );

    if (!order) {
      // Puede que el webhook aún no haya procesado
      return reply.send({ success: false, pending: true });
    }

    // Obtener tickets de la orden
    const tickets = await query<RowDataPacket[]>(
      `SELECT t.ticketCode as code, s.label as seatLabel, vz.name as zoneName
       FROM Ticket t
       LEFT JOIN Seat s ON s.id = t.seatId
       LEFT JOIN VenueZone vz ON vz.id = s.zoneId
       WHERE t.orderId = ?`,
      [order.id]
    );

    return reply.send({
      success: true,
      order: {
        orderNumber: order.orderNumber,
        total: order.total,
        currency: order.currency || "MXN",
        status: order.status,
        event: {
          id: order.eventId,
          name: order.eventName,
        },
        session: {
          startsAt: order.startsAt,
          endsAt: order.endsAt,
        },
        venue: order.venueName ? {
          name: order.venueName,
          city: order.venueCity,
        } : null,
        tickets: tickets.map(t => ({
          code: t.code,
          seatLabel: t.seatLabel,
          zoneName: t.zoneName,
        })),
      },
    });
  });

  // GET /api/payments/:paymentId/status - Verificar estado de un pago
  app.get<{ Params: { paymentId: string } }>("/api/payments/:paymentId/status", {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { paymentId } = request.params;

      const payment = await getPaymentStatus(paymentId);

      if (!payment) {
        return reply.status(404).send({
          success: false,
          error: "Pago no encontrado",
        });
      }

      return reply.send({
        success: true,
        payment: {
          id: payment.id,
          status: payment.status,
          statusDetail: payment.statusDetail,
          amount: payment.transactionAmount,
          currency: payment.currencyId,
          paymentMethod: payment.paymentMethodId,
        },
      });
    },
  });

  // POST /api/payments/simulate-success - Simular pago exitoso (solo desarrollo)
  app.post("/api/payments/simulate-success", {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      // Solo permitir en modo test/desarrollo
      if (isMercadoPagoConfigured() && !mercadoPagoConfig.accessToken.startsWith("TEST-")) {
        return reply.status(403).send({
          success: false,
          error: "Esta funcionalidad solo está disponible en modo de prueba",
        });
      }

      const { ticketIds, buyerName, buyerEmail, buyerPhone, couponCode, couponDiscount } = request.body as {
        ticketIds: string[];
        buyerName: string;
        buyerEmail: string;
        buyerPhone?: string;
        couponCode?: string;
        couponDiscount?: number;
      };
      const user = (request as any).user;

      if (!ticketIds || ticketIds.length === 0) {
        return reply.status(400).send({
          success: false,
          error: "ticketIds es requerido",
        });
      }

      // Obtener tickets
      const tickets = await query<RowDataPacket[]>(
        `SELECT t.id, t.price, t.currency, t.sessionId,
                pt.label as tierName,
                e.name as eventName,
                es.startsAt as eventDate,
                v.name as venueName,
                s.label as seatLabel, s.rowLabel as seatRow,
                vz.name as zoneName
         FROM Ticket t
         LEFT JOIN EventPriceTier pt ON pt.id = t.tierId
         JOIN EventSession es ON es.id = t.sessionId
         JOIN Event e ON e.id = es.eventId
         JOIN Venue v ON v.id = e.venueId
         LEFT JOIN Seat s ON s.id = t.seatId
         LEFT JOIN VenueZone vz ON vz.id = s.zoneId
         WHERE t.id IN (?) AND t.status = 'RESERVED'`,
        [ticketIds]
      );

      if (tickets.length === 0) {
        return reply.status(400).send({
          success: false,
          error: "No hay tickets válidos para confirmar",
        });
      }

      const subtotal = tickets.reduce((sum: number, t: any) => sum + Number(t.price), 0);
      const discount = couponDiscount || 0;
      const total = Math.max(0, subtotal - discount);
      const orderId = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

      // Crear orden en la base de datos
      const orderUUID = require("crypto").randomUUID();
      await query(
        `INSERT INTO \`Order\` (id, userId, orderNumber, buyerName, buyerEmail, buyerPhone, subtotal, total, couponCode, couponDiscount, currency, status, paymentMethod, paymentReference, paidAt, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'MXN', 'PAID', 'simulated', ?, NOW(), NOW(), NOW())`,
        [orderUUID, user.id, orderId, buyerName, buyerEmail, buyerPhone || null, subtotal, total, couponCode || null, discount || null, `SIM-${Date.now()}`]
      );

      // Si hay cupón, incrementar el usedCount y registrar el uso
      if (couponCode) {
        await query(`UPDATE Coupon SET usedCount = usedCount + 1, updatedAt = NOW() WHERE code = ?`, [couponCode]);
        
        const [coupon] = await query<RowDataPacket[]>(`SELECT id FROM Coupon WHERE code = ?`, [couponCode]);
        if (coupon) {
          await query(
            `INSERT INTO CouponUsage (id, couponId, userId, orderId, discountApplied, usedAt)
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [require("crypto").randomUUID(), coupon.id, user.id, orderUUID, discount]
          );
        }
      }

      // Confirmar reserva
      const confirmResult = await confirmReservation(ticketIds, orderUUID, {
        paymentReference: `SIM-${Date.now()}`,
        paymentMethod: "simulated",
        holderName: buyerName,
        holderEmail: buyerEmail,
      });

      if (!confirmResult.success) {
        // Rollback orden y cupón
        await query(`DELETE FROM \`Order\` WHERE id = ?`, [orderUUID]);
        if (couponCode) {
          await query(`UPDATE Coupon SET usedCount = usedCount - 1 WHERE code = ?`, [couponCode]);
          await query(`DELETE FROM CouponUsage WHERE orderId = ?`, [orderUUID]);
        }
        return reply.status(500).send({
          success: false,
          error: confirmResult.error,
        });
      }

      // Enviar email de confirmación
      const firstTicket = tickets[0] as any;
      const emailData: OrderEmailData = {
        orderNumber: orderId,
        buyerName,
        buyerEmail,
        total,
        currency: "MXN",
        eventName: firstTicket.eventName,
        eventDate: firstTicket.eventDate,
        venueName: firstTicket.venueName,
        tickets: tickets.map((t: any, i: number) => ({
          ticketCode: confirmResult.ticketCodes[i],
          tierName: t.tierName,
          seatInfo: t.seatLabel ? `${t.zoneName || ""} Fila ${t.seatRow} Asiento ${t.seatLabel}` : undefined,
          price: Number(t.price),
        })),
      };

      const emailResult = await sendOrderConfirmationEmail(emailData);
      if (emailResult.previewUrl) {
        console.log(`[Email Preview] ${emailResult.previewUrl}`);
      }

      return reply.send({
        success: true,
        message: "Pago simulado exitosamente",
        order: {
          id: orderUUID,
          orderNumber: orderId,
          total,
          currency: "MXN",
          status: "PAID",
        },
        ticketCodes: confirmResult.ticketCodes,
        emailSent: emailResult.success,
        emailPreviewUrl: emailResult.previewUrl,
      });
    },
  });

  // POST /api/payments/process - Procesar pago directo con tarjeta (Checkout Bricks)
  app.post("/api/payments/process", {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { 
        ticketIds, 
        amount, 
        currency = "MXN",
        cardToken, 
        buyerName, 
        buyerEmail, 
        buyerPhone,
        couponCode,
        couponDiscount,
        cardData, // Para simulación cuando no hay token
      } = request.body as {
        ticketIds: string[];
        amount: number;
        currency?: string;
        cardToken?: string;
        buyerName: string;
        buyerEmail: string;
        buyerPhone?: string;
        couponCode?: string;
        couponDiscount?: number;
        cardData?: { lastFourDigits: string; cardType: string };
      };
      const user = (request as any).user;

      if (!ticketIds || ticketIds.length === 0) {
        return reply.status(400).send({
          success: false,
          error: "ticketIds es requerido",
        });
      }

      // Obtener tickets reservados
      const tickets = await query<RowDataPacket[]>(
        `SELECT t.id, t.price, t.currency, t.sessionId,
                pt.label as tierName,
                e.name as eventName,
                es.startsAt as eventDate,
                v.name as venueName,
                s.label as seatLabel, s.rowLabel as seatRow,
                vz.name as zoneName
         FROM Ticket t
         LEFT JOIN EventPriceTier pt ON pt.id = t.tierId
         JOIN EventSession es ON es.id = t.sessionId
         JOIN Event e ON e.id = es.eventId
         JOIN Venue v ON v.id = e.venueId
         LEFT JOIN Seat s ON s.id = t.seatId
         LEFT JOIN VenueZone vz ON vz.id = s.zoneId
         WHERE t.id IN (?) AND t.status = 'RESERVED'`,
        [ticketIds]
      );

      if (tickets.length === 0) {
        return reply.status(400).send({
          success: false,
          error: "No hay tickets válidos para confirmar. Puede que hayan expirado.",
        });
      }

      // Calcular totales
      const subtotal = tickets.reduce((sum: number, t: any) => sum + Number(t.price), 0);
      const discount = couponDiscount || 0;
      const total = Math.max(0, subtotal - discount);
      
      // Verificar que el monto coincide (tolerancia de $1 por redondeo)
      if (Math.abs(total - amount) > 1) {
        return reply.status(400).send({
          success: false,
          error: `Monto incorrecto. Esperado: $${total}, Recibido: $${amount}`,
        });
      }

      const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`;
      const firstTicket = tickets[0] as any;

      // Procesar pago con MercadoPago
      let paymentResult;
      let paymentMethod = "card";
      let paymentReference = "";

      if (cardToken && isMercadoPagoConfigured()) {
        // Pago REAL con MercadoPago
        paymentResult = await processDirectPayment({
          amount: total,
          cardToken,
          description: `${firstTicket.eventName} - ${tickets.length} boleto(s)`,
          email: buyerEmail,
          externalReference: orderNumber,
        });

        if (!paymentResult.success) {
          return reply.status(400).send({
            success: false,
            error: paymentResult.error || "Error procesando el pago",
            status: paymentResult.status,
            statusDetail: paymentResult.statusDetail,
          });
        }

        paymentMethod = "mercadopago";
        paymentReference = paymentResult.paymentId || "";
      } else {
        // Pago SIMULADO (modo desarrollo o sin MP configurado)
        console.log("[Payments] Processing simulated payment (no MP config or token)");
        paymentResult = {
          success: true,
          paymentId: `SIM-${Date.now()}`,
          status: "approved" as const,
        };
        paymentMethod = cardData ? `card_${cardData.cardType}_${cardData.lastFourDigits}` : "simulated";
        paymentReference = paymentResult.paymentId;
      }

      // Crear orden en la base de datos
      const orderUUID = randomUUID();
      await query(
        `INSERT INTO \`Order\` (id, userId, orderNumber, buyerName, buyerEmail, buyerPhone, subtotal, total, couponCode, couponDiscount, currency, status, paymentMethod, paymentReference, paidAt, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PAID', ?, ?, NOW(), NOW(), NOW())`,
        [orderUUID, user.id, orderNumber, buyerName, buyerEmail, buyerPhone || null, subtotal, total, couponCode || null, discount || null, currency, paymentMethod, paymentReference]
      );

      // Si hay cupón, incrementar usedCount
      if (couponCode) {
        await query(`UPDATE Coupon SET usedCount = usedCount + 1, updatedAt = NOW() WHERE code = ?`, [couponCode]);
        
        const [coupon] = await query<RowDataPacket[]>(`SELECT id FROM Coupon WHERE code = ?`, [couponCode]);
        if (coupon) {
          await query(
            `INSERT INTO CouponUsage (id, couponId, userId, orderId, discountApplied, usedAt)
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [randomUUID(), coupon.id, user.id, orderUUID, discount]
          );
        }
      }

      // Confirmar reserva
      const confirmResult = await confirmReservation(ticketIds, orderUUID, {
        paymentReference,
        paymentMethod,
        holderName: buyerName,
        holderEmail: buyerEmail,
      });

      if (!confirmResult.success) {
        // Rollback
        await query(`DELETE FROM \`Order\` WHERE id = ?`, [orderUUID]);
        if (couponCode) {
          await query(`UPDATE Coupon SET usedCount = usedCount - 1 WHERE code = ?`, [couponCode]);
          await query(`DELETE FROM CouponUsage WHERE orderId = ?`, [orderUUID]);
        }
        return reply.status(500).send({
          success: false,
          error: confirmResult.error || "Error confirmando tickets",
        });
      }

      // Enviar email de confirmación
      try {
        const emailData: OrderEmailData = {
          orderNumber,
          buyerName,
          buyerEmail,
          total,
          currency,
          eventName: firstTicket.eventName,
          eventDate: firstTicket.eventDate,
          venueName: firstTicket.venueName,
          tickets: tickets.map((t: any, i: number) => ({
            ticketCode: confirmResult.ticketCodes[i],
            tierName: t.tierName,
            seatInfo: t.seatLabel ? `${t.zoneName || ""} Fila ${t.seatRow} Asiento ${t.seatLabel}` : undefined,
            price: Number(t.price),
          })),
        };

        const emailResult = await sendOrderConfirmationEmail(emailData);
        if (emailResult.previewUrl) {
          console.log(`[Email Preview] ${emailResult.previewUrl}`);
        }
      } catch (emailErr) {
        console.error("[Payments] Error sending confirmation email:", emailErr);
      }

      return reply.send({
        success: true,
        message: "Pago procesado exitosamente",
        order: {
          id: orderUUID,
          orderNumber,
          subtotal,
          discount,
          total,
          currency,
          status: "PAID",
        },
        ticketCodes: confirmResult.ticketCodes,
        payment: {
          id: paymentResult.paymentId,
          method: paymentMethod,
          status: paymentResult.status,
        },
      });
    },
  });
}
