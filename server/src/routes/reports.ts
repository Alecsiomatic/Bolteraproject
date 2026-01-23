import { FastifyInstance } from "fastify";
import { RowDataPacket } from "mysql2";
import { query } from "../lib/db";
import { requireAuth, requireAdmin } from "../lib/authMiddleware";
import { z } from "zod";
import PDFDocument from "pdfkit";

interface SaleRow extends RowDataPacket {
  orderNumber: string;
  orderDate: Date;
  total: number;
  currency: string;
  status: string;
  paymentMethod: string | null;
  buyerName: string;
  buyerEmail: string;
  eventName: string;
  sessionDate: Date;
  venueName: string | null;
  ticketCount: number;
}

interface TicketRow extends RowDataPacket {
  code: string;
  status: string;
  price: number;
  currency: string;
  eventName: string;
  sessionDate: Date;
  venueName: string | null;
  zoneName: string | null;
  seatLabel: string | null;
  buyerName: string;
  buyerEmail: string;
  purchaseDate: Date;
  checkedInAt: Date | null;
}

// Escapar campos CSV
const escapeCSV = (value: any): string => {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

// Generar CSV desde array de objetos
const generateCSV = (data: Record<string, any>[], columns: { key: string; header: string }[]): string => {
  const header = columns.map(c => escapeCSV(c.header)).join(",");
  const rows = data.map(row => 
    columns.map(c => escapeCSV(row[c.key])).join(",")
  );
  return [header, ...rows].join("\n");
};

// Generar PDF desde datos
const generatePDF = async (
  title: string,
  subtitle: string,
  data: Record<string, any>[],
  columns: { key: string; header: string; width?: number }[],
  summary?: { label: string; value: string }[]
): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Header
    doc.fontSize(20).fillColor("#1a1a2e").text(title, { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor("#666").text(subtitle, { align: "center" });
    doc.moveDown(0.5);
    
    // Date
    doc.fontSize(9).fillColor("#999")
      .text(`Generado: ${new Date().toLocaleString("es-MX")}`, { align: "right" });
    doc.moveDown(1);

    // Table headers
    const startX = 40;
    const startY = doc.y;
    const pageWidth = doc.page.width - 80;
    const defaultWidth = pageWidth / columns.length;
    
    // Header background
    doc.rect(startX - 5, startY - 5, pageWidth + 10, 20).fill("#1a1a2e");
    
    let x = startX;
    doc.fillColor("#ffffff").fontSize(8);
    columns.forEach((col) => {
      const width = col.width || defaultWidth;
      doc.text(col.header, x, startY, { width, align: "left" });
      x += width;
    });

    doc.moveDown(0.8);
    
    // Table rows
    doc.fillColor("#333").fontSize(7);
    let rowCount = 0;
    const maxRowsPerPage = 25;

    data.forEach((row, index) => {
      if (rowCount >= maxRowsPerPage) {
        doc.addPage();
        rowCount = 0;
        
        // Repeat header on new page
        const newY = 40;
        doc.rect(startX - 5, newY - 5, pageWidth + 10, 20).fill("#1a1a2e");
        let hx = startX;
        doc.fillColor("#ffffff").fontSize(8);
        columns.forEach((col) => {
          const width = col.width || defaultWidth;
          doc.text(col.header, hx, newY, { width, align: "left" });
          hx += width;
        });
        doc.moveDown(0.8);
        doc.fillColor("#333").fontSize(7);
      }

      // Alternate row background
      if (index % 2 === 0) {
        doc.rect(startX - 5, doc.y - 2, pageWidth + 10, 14).fill("#f8f9fa");
        doc.fillColor("#333");
      }

      x = startX;
      const y = doc.y;
      columns.forEach((col) => {
        const width = col.width || defaultWidth;
        const value = row[col.key] ?? "";
        const displayValue = String(value).substring(0, 30); // Truncate long values
        doc.text(displayValue, x, y, { width, align: "left" });
        x += width;
      });
      doc.moveDown(0.5);
      rowCount++;
    });

    // Summary
    if (summary && summary.length > 0) {
      doc.moveDown(2);
      doc.rect(startX - 5, doc.y - 5, pageWidth + 10, 25 + summary.length * 15).fill("#e8f5e9");
      doc.fillColor("#2e7d32").fontSize(10);
      doc.text("Resumen", startX, doc.y, { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(9).fillColor("#333");
      summary.forEach(s => {
        doc.text(`${s.label}: ${s.value}`);
      });
    }

    // Footer
    doc.fontSize(8).fillColor("#999")
      .text(
        "Boletera OS - Sistema de Gestión de Boletos",
        40,
        doc.page.height - 30,
        { align: "center" }
      );

    doc.end();
  });
};

export async function reportsRoutes(app: FastifyInstance) {

  // GET /api/reports/sales - Export sales report
  app.get("/api/reports/sales", {
    preHandler: [requireAuth, requireAdmin],
    handler: async (request, reply) => {
      const { 
        startDate, 
        endDate, 
        eventId,
        format = "csv" 
      } = request.query as {
        startDate?: string;
        endDate?: string;
        eventId?: string;
        format?: "csv" | "json" | "pdf";
      };

      let whereClause = "WHERE 1=1";
      const params: any[] = [];

      if (startDate) {
        whereClause += " AND o.createdAt >= ?";
        params.push(startDate);
      }

      if (endDate) {
        whereClause += " AND o.createdAt <= ?";
        params.push(endDate + " 23:59:59");
      }

      if (eventId) {
        whereClause += " AND e.id = ?";
        params.push(eventId);
      }

      const sales = await query<SaleRow[]>(
        `SELECT 
          o.orderNumber,
          o.createdAt as orderDate,
          o.total,
          o.currency,
          o.status,
          o.paymentMethod,
          u.name as buyerName,
          u.email as buyerEmail,
          e.name as eventName,
          es.startsAt as sessionDate,
          v.name as venueName,
          COUNT(t.id) as ticketCount
        FROM \`Order\` o
        JOIN User u ON u.id = o.userId
        JOIN Ticket t ON t.orderId = o.id
        JOIN EventSession es ON es.id = t.sessionId
        JOIN Event e ON e.id = es.eventId
        LEFT JOIN Venue v ON v.id = e.venueId
        ${whereClause}
        GROUP BY o.id
        ORDER BY o.createdAt DESC`,
        params
      );

      if (format === "json") {
        return reply.send({
          success: true,
          count: sales.length,
          data: sales.map(s => ({
            orderNumber: s.orderNumber,
            orderDate: s.orderDate,
            total: s.total,
            currency: s.currency,
            status: s.status,
            paymentMethod: s.paymentMethod,
            buyerName: s.buyerName,
            buyerEmail: s.buyerEmail,
            eventName: s.eventName,
            sessionDate: s.sessionDate,
            venueName: s.venueName,
            ticketCount: s.ticketCount,
          })),
        });
      }

      const columns = [
        { key: "orderNumber", header: "Número de Orden", width: 90 },
        { key: "orderDate", header: "Fecha de Orden", width: 75 },
        { key: "total", header: "Total", width: 55 },
        { key: "currency", header: "Moneda", width: 40 },
        { key: "status", header: "Estado", width: 55 },
        { key: "paymentMethod", header: "Método de Pago", width: 70 },
        { key: "buyerName", header: "Comprador", width: 90 },
        { key: "buyerEmail", header: "Email", width: 110 },
        { key: "eventName", header: "Evento", width: 100 },
        { key: "venueName", header: "Venue", width: 80 },
        { key: "ticketCount", header: "Boletos", width: 45 },
      ];

      const formattedData = sales.map(s => ({
        ...s,
        orderDate: new Date(s.orderDate).toLocaleDateString("es-MX"),
        sessionDate: new Date(s.sessionDate).toLocaleDateString("es-MX"),
        total: `$${Number(s.total).toFixed(2)}`,
      }));

      // PDF format
      if (format === "pdf") {
        const totalRevenue = sales.reduce((sum, s) => sum + Number(s.total), 0);
        const totalTickets = sales.reduce((sum, s) => sum + Number(s.ticketCount), 0);
        
        const subtitle = startDate && endDate 
          ? `Período: ${startDate} - ${endDate}`
          : "Todas las ventas";

        const pdfBuffer = await generatePDF(
          "Reporte de Ventas",
          subtitle,
          formattedData,
          columns,
          [
            { label: "Total de órdenes", value: String(sales.length) },
            { label: "Total de boletos", value: String(totalTickets) },
            { label: "Ingresos totales", value: `$${totalRevenue.toFixed(2)} ${sales[0]?.currency || "MXN"}` },
          ]
        );

        reply.header("Content-Type", "application/pdf");
        reply.header("Content-Disposition", `attachment; filename="ventas_${new Date().toISOString().split("T")[0]}.pdf"`);
        return reply.send(pdfBuffer);
      }

      // CSV format (default)
      const csv = generateCSV(
        formattedData,
        columns.map(c => ({ key: c.key, header: c.header }))
      );

      reply.header("Content-Type", "text/csv; charset=utf-8");
      reply.header("Content-Disposition", `attachment; filename="ventas_${new Date().toISOString().split("T")[0]}.csv"`);
      return reply.send(csv);
    },
  });

  // GET /api/reports/tickets - Export tickets report
  app.get("/api/reports/tickets", {
    preHandler: [requireAuth, requireAdmin],
    handler: async (request, reply) => {
      const { 
        startDate, 
        endDate, 
        eventId,
        status,
        format = "csv" 
      } = request.query as {
        startDate?: string;
        endDate?: string;
        eventId?: string;
        status?: string;
        format?: "csv" | "json" | "pdf";
      };

      let whereClause = "WHERE 1=1";
      const params: any[] = [];

      if (startDate) {
        whereClause += " AND t.createdAt >= ?";
        params.push(startDate);
      }

      if (endDate) {
        whereClause += " AND t.createdAt <= ?";
        params.push(endDate + " 23:59:59");
      }

      if (eventId) {
        whereClause += " AND e.id = ?";
        params.push(eventId);
      }

      if (status) {
        whereClause += " AND t.status = ?";
        params.push(status.toUpperCase());
      }

      const tickets = await query<TicketRow[]>(
        `SELECT 
          t.ticketCode as code,
          t.status,
          t.price,
          t.currency,
          e.name as eventName,
          es.startsAt as sessionDate,
          v.name as venueName,
          vz.name as zoneName,
          s.label as seatLabel,
          u.name as buyerName,
          u.email as buyerEmail,
          t.purchasedAt as purchaseDate,
          t.checkedInAt
        FROM Ticket t
        JOIN EventSession es ON es.id = t.sessionId
        JOIN Event e ON e.id = es.eventId
        LEFT JOIN Venue v ON v.id = e.venueId
        LEFT JOIN Seat s ON s.id = t.seatId
        LEFT JOIN VenueZone vz ON vz.id = s.zoneId
        LEFT JOIN \`Order\` o ON o.id = t.orderId
        LEFT JOIN User u ON u.id = o.userId
        ${whereClause}
        ORDER BY t.createdAt DESC`,
        params
      );

      if (format === "json") {
        return reply.send({
          success: true,
          count: tickets.length,
          data: tickets,
        });
      }

      const columns = [
        { key: "code", header: "Código", width: 85 },
        { key: "status", header: "Estado", width: 55 },
        { key: "price", header: "Precio", width: 50 },
        { key: "eventName", header: "Evento", width: 120 },
        { key: "sessionDate", header: "Fecha Evento", width: 70 },
        { key: "venueName", header: "Venue", width: 80 },
        { key: "zoneName", header: "Zona", width: 60 },
        { key: "seatLabel", header: "Asiento", width: 50 },
        { key: "buyerName", header: "Comprador", width: 90 },
        { key: "buyerEmail", header: "Email", width: 100 },
        { key: "checkedInAt", header: "Check-in", width: 70 },
      ];

      const formattedData = tickets.map(t => ({
        ...t,
        sessionDate: t.sessionDate ? new Date(t.sessionDate).toLocaleDateString("es-MX") : "",
        purchaseDate: t.purchaseDate ? new Date(t.purchaseDate).toLocaleDateString("es-MX") : "",
        checkedInAt: t.checkedInAt ? new Date(t.checkedInAt).toLocaleString("es-MX") : "-",
        price: `$${Number(t.price).toFixed(2)}`,
      }));

      // PDF format
      if (format === "pdf") {
        const soldCount = tickets.filter(t => t.status === "SOLD").length;
        const usedCount = tickets.filter(t => t.status === "USED").length;
        const totalRevenue = tickets.reduce((sum, t) => sum + Number(t.price), 0);
        
        const subtitle = startDate && endDate 
          ? `Período: ${startDate} - ${endDate}`
          : status 
            ? `Estado: ${status}`
            : "Todos los boletos";

        const pdfBuffer = await generatePDF(
          "Reporte de Boletos",
          subtitle,
          formattedData,
          columns,
          [
            { label: "Total de boletos", value: String(tickets.length) },
            { label: "Vendidos", value: String(soldCount) },
            { label: "Usados (check-in)", value: String(usedCount) },
            { label: "Valor total", value: `$${totalRevenue.toFixed(2)} ${tickets[0]?.currency || "MXN"}` },
          ]
        );

        reply.header("Content-Type", "application/pdf");
        reply.header("Content-Disposition", `attachment; filename="boletos_${new Date().toISOString().split("T")[0]}.pdf"`);
        return reply.send(pdfBuffer);
      }

      // CSV format (default)
      const csv = generateCSV(
        formattedData,
        columns.map(c => ({ key: c.key, header: c.header }))
      );

      reply.header("Content-Type", "text/csv; charset=utf-8");
      reply.header("Content-Disposition", `attachment; filename="boletos_${new Date().toISOString().split("T")[0]}.csv"`);
      return reply.send(csv);
    },
  });

  // GET /api/reports/summary - Get summary statistics
  app.get("/api/reports/summary", {
    preHandler: [requireAuth, requireAdmin],
    handler: async (request, reply) => {
      const { startDate, endDate, eventId } = request.query as {
        startDate?: string;
        endDate?: string;
        eventId?: string;
      };

      let dateClause = "";
      const params: any[] = [];

      if (startDate) {
        dateClause += " AND o.createdAt >= ?";
        params.push(startDate);
      }

      if (endDate) {
        dateClause += " AND o.createdAt <= ?";
        params.push(endDate + " 23:59:59");
      }

      // Total sales
      const [salesStats] = await query<RowDataPacket[]>(
        `SELECT 
          COUNT(DISTINCT o.id) as totalOrders,
          SUM(o.total) as totalRevenue,
          AVG(o.total) as avgOrderValue,
          o.currency
        FROM \`Order\` o
        WHERE o.status = 'COMPLETED'${dateClause}
        GROUP BY o.currency`,
        params
      );

      // Tickets by status
      const ticketStats = await query<RowDataPacket[]>(
        `SELECT status, COUNT(*) as count
         FROM Ticket
         GROUP BY status`
      );

      // Top events
      const topEvents = await query<RowDataPacket[]>(
        `SELECT 
          e.id, e.name,
          COUNT(DISTINCT o.id) as orders,
          SUM(o.total) as revenue
        FROM Event e
        JOIN EventSession es ON es.eventId = e.id
        JOIN Ticket t ON t.sessionId = es.id
        JOIN \`Order\` o ON o.id = t.orderId
        WHERE o.status = 'COMPLETED'
        GROUP BY e.id
        ORDER BY revenue DESC
        LIMIT 5`
      );

      // Daily sales trend
      const salesTrend = await query<RowDataPacket[]>(
        `SELECT 
          DATE(o.createdAt) as date,
          COUNT(*) as orders,
          SUM(o.total) as revenue
        FROM \`Order\` o
        WHERE o.status = 'COMPLETED'
          AND o.createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY DATE(o.createdAt)
        ORDER BY date ASC`
      );

      return reply.send({
        success: true,
        summary: {
          sales: salesStats || { totalOrders: 0, totalRevenue: 0, avgOrderValue: 0, currency: "MXN" },
          tickets: Object.fromEntries(ticketStats.map(t => [t.status, t.count])),
          topEvents,
          salesTrend: salesTrend.map(s => ({
            date: s.date,
            orders: Number(s.orders),
            revenue: Number(s.revenue),
          })),
        },
      });
    },
  });
}
