/**
 * Job de recordatorios de eventos
 * Envía emails a compradores 24 horas y 2 horas antes del evento
 */

import { query } from "./db";
import { RowDataPacket } from "mysql2";
import { sendEventReminderEmail, ReminderEmailData } from "./emailService";

interface UpcomingTicket extends RowDataPacket {
  orderId: string;
  orderNumber: string;
  buyerName: string;
  buyerEmail: string;
  eventName: string;
  eventDate: Date;
  venueName: string;
  venueAddress: string | null;
  ticketCount: number;
  hoursUntilEvent: number;
}

// Tabla para rastrear recordatorios enviados (evitar duplicados)
const REMINDER_TABLE = `
CREATE TABLE IF NOT EXISTS EventReminder (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  orderId VARCHAR(36) NOT NULL,
  sessionId VARCHAR(36) NOT NULL,
  reminderType ENUM('24h', '2h') NOT NULL,
  sentAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_reminder (orderId, sessionId, reminderType),
  INDEX idx_session (sessionId)
)
`;

let tableCreated = false;

async function ensureReminderTable(): Promise<void> {
  if (tableCreated) return;
  
  try {
    await query(REMINDER_TABLE);
    tableCreated = true;
  } catch (error) {
    // Tabla ya existe, ignorar
    tableCreated = true;
  }
}

/**
 * Busca tickets de eventos próximos (24h o 2h) que no hayan recibido recordatorio
 */
async function getUpcomingEventsForReminder(hoursAhead: number, reminderType: '24h' | '2h'): Promise<UpcomingTicket[]> {
  await ensureReminderTable();
  
  // Buscar órdenes con tickets para eventos en las próximas X horas
  // que no hayan recibido este tipo de recordatorio
  const sql = `
    SELECT 
      o.id as orderId,
      o.orderNumber,
      o.buyerName,
      o.buyerEmail,
      e.name as eventName,
      es.startsAt as eventDate,
      v.name as venueName,
      v.address as venueAddress,
      es.id as sessionId,
      COUNT(t.id) as ticketCount,
      TIMESTAMPDIFF(HOUR, NOW(), es.startsAt) as hoursUntilEvent
    FROM \`Order\` o
    JOIN Ticket t ON t.orderId = o.id
    JOIN EventSession es ON es.id = t.sessionId
    JOIN Event e ON e.id = es.eventId
    JOIN Venue v ON v.id = e.venueId
    LEFT JOIN EventReminder er ON er.orderId = o.id 
      AND er.sessionId = es.id 
      AND er.reminderType = ?
    WHERE 
      o.status = 'PAID'
      AND t.status = 'SOLD'
      AND es.startsAt > NOW()
      AND TIMESTAMPDIFF(HOUR, NOW(), es.startsAt) <= ?
      AND TIMESTAMPDIFF(HOUR, NOW(), es.startsAt) > ?
      AND er.id IS NULL  -- No ha recibido este recordatorio
    GROUP BY o.id, o.orderNumber, o.buyerName, o.buyerEmail, 
             e.name, es.startsAt, v.name, v.address, es.id
    ORDER BY es.startsAt ASC
    LIMIT 100
  `;
  
  // Para 24h: eventos entre 2-24 horas (excluir los de 2h)
  // Para 2h: eventos en las próximas 2 horas
  const minHours = reminderType === '24h' ? 2 : 0;
  
  const tickets = await query<UpcomingTicket[]>(sql, [reminderType, hoursAhead, minHours]);
  return tickets;
}

/**
 * Marca un recordatorio como enviado
 */
async function markReminderSent(orderId: string, sessionId: string, reminderType: '24h' | '2h'): Promise<void> {
  await query(
    `INSERT INTO EventReminder (orderId, sessionId, reminderType) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE sentAt = NOW()`,
    [orderId, sessionId, reminderType]
  );
}

/**
 * Procesa recordatorios de 24 horas
 */
export async function process24HourReminders(): Promise<{ sent: number; errors: number }> {
  const tickets = await getUpcomingEventsForReminder(24, '24h');
  let sent = 0;
  let errors = 0;
  
  for (const ticket of tickets) {
    try {
      const data: ReminderEmailData = {
        buyerName: ticket.buyerName,
        buyerEmail: ticket.buyerEmail,
        eventName: ticket.eventName,
        eventDate: ticket.eventDate,
        venueName: ticket.venueName,
        venueAddress: ticket.venueAddress || undefined,
        ticketCount: Number(ticket.ticketCount),
        orderNumber: ticket.orderNumber,
      };
      
      const result = await sendEventReminderEmail(data, Number(ticket.hoursUntilEvent));
      
      if (result.success) {
        await markReminderSent(ticket.orderId, (ticket as any).sessionId, '24h');
        sent++;
        console.log(`[Reminder] 24h reminder sent to ${ticket.buyerEmail} for "${ticket.eventName}"`);
      } else {
        errors++;
        console.error(`[Reminder] Failed to send 24h reminder: ${result.error}`);
      }
    } catch (error) {
      errors++;
      console.error(`[Reminder] Error processing 24h reminder:`, error);
    }
  }
  
  return { sent, errors };
}

/**
 * Procesa recordatorios de 2 horas
 */
export async function process2HourReminders(): Promise<{ sent: number; errors: number }> {
  const tickets = await getUpcomingEventsForReminder(2, '2h');
  let sent = 0;
  let errors = 0;
  
  for (const ticket of tickets) {
    try {
      const data: ReminderEmailData = {
        buyerName: ticket.buyerName,
        buyerEmail: ticket.buyerEmail,
        eventName: ticket.eventName,
        eventDate: ticket.eventDate,
        venueName: ticket.venueName,
        venueAddress: ticket.venueAddress || undefined,
        ticketCount: Number(ticket.ticketCount),
        orderNumber: ticket.orderNumber,
      };
      
      const result = await sendEventReminderEmail(data, Number(ticket.hoursUntilEvent));
      
      if (result.success) {
        await markReminderSent(ticket.orderId, (ticket as any).sessionId, '2h');
        sent++;
        console.log(`[Reminder] 2h reminder sent to ${ticket.buyerEmail} for "${ticket.eventName}"`);
      } else {
        errors++;
        console.error(`[Reminder] Failed to send 2h reminder: ${result.error}`);
      }
    } catch (error) {
      errors++;
      console.error(`[Reminder] Error processing 2h reminder:`, error);
    }
  }
  
  return { sent, errors };
}

/**
 * Ejecuta todos los trabajos de recordatorios
 */
export async function processAllReminders(): Promise<{ 
  reminders24h: { sent: number; errors: number };
  reminders2h: { sent: number; errors: number };
}> {
  const reminders24h = await process24HourReminders();
  const reminders2h = await process2HourReminders();
  
  return { reminders24h, reminders2h };
}
