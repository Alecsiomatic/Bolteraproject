import PDFDocument from "pdfkit";
import QRCode from "qrcode";

export interface TicketPDFData {
  ticketCode: string;
  eventName: string;
  eventDate: Date;
  venueName: string;
  venueAddress?: string;
  seatInfo?: {
    zone?: string;
    row?: string;
    seat?: string;
    table?: string;
  };
  tierName?: string;
  price: number;
  currency: string;
  holderName?: string;
  holderEmail?: string;
  orderNumber: string;
  purchasedAt?: Date;
}

/**
 * Genera un PDF para un ticket
 * Retorna un Buffer con el contenido del PDF
 */
export async function generateTicketPDF(data: TicketPDFData): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: [400, 600], // Tamaño tipo ticket/entrada
        margin: 20,
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Generar QR code como data URL
      const qrDataUrl = await QRCode.toDataURL(data.ticketCode, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 150,
      });

      // === HEADER ===
      doc
        .rect(0, 0, 400, 80)
        .fill("#1a1a2e");

      doc
        .fillColor("#ffffff")
        .fontSize(24)
        .font("Helvetica-Bold")
        .text("BOLETERA", 20, 25, { width: 200 });

      doc
        .fontSize(10)
        .font("Helvetica")
        .text("Tu entrada digital", 20, 52);

      // === NOMBRE DEL EVENTO ===
      doc
        .fillColor("#1a1a2e")
        .fontSize(18)
        .font("Helvetica-Bold")
        .text(data.eventName, 20, 100, { width: 360, align: "center" });

      // === FECHA Y LUGAR ===
      doc
        .fontSize(12)
        .font("Helvetica")
        .fillColor("#444444");

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

      doc.text(`📅 ${dateStr}`, 20, 140, { width: 360, align: "center" });
      doc.text(`🕐 ${timeStr}`, 20, 158, { width: 360, align: "center" });
      doc.text(`📍 ${data.venueName}`, 20, 176, { width: 360, align: "center" });
      
      if (data.venueAddress) {
        doc
          .fontSize(10)
          .fillColor("#666666")
          .text(data.venueAddress, 20, 194, { width: 360, align: "center" });
      }

      // === LÍNEA DIVISORIA ===
      doc
        .strokeColor("#dddddd")
        .lineWidth(1)
        .moveTo(20, 220)
        .lineTo(380, 220)
        .stroke();

      // === DETALLES DEL ASIENTO ===
      let yPos = 235;
      doc
        .fillColor("#1a1a2e")
        .fontSize(14)
        .font("Helvetica-Bold")
        .text("Detalles de tu lugar", 20, yPos);

      yPos += 25;
      doc
        .fontSize(11)
        .font("Helvetica")
        .fillColor("#444444");

      if (data.tierName) {
        doc.text(`Tipo: ${data.tierName}`, 20, yPos);
        yPos += 18;
      }

      if (data.seatInfo?.zone) {
        doc.text(`Zona: ${data.seatInfo.zone}`, 20, yPos);
        yPos += 18;
      }

      if (data.seatInfo?.table) {
        doc.text(`Mesa: ${data.seatInfo.table}`, 20, yPos);
        yPos += 18;
      } else {
        if (data.seatInfo?.row) {
          doc.text(`Fila: ${data.seatInfo.row}`, 20, yPos);
          yPos += 18;
        }
        if (data.seatInfo?.seat) {
          doc.text(`Asiento: ${data.seatInfo.seat}`, 20, yPos);
          yPos += 18;
        }
      }

      // === PRECIO ===
      doc
        .fillColor("#16a34a")
        .fontSize(16)
        .font("Helvetica-Bold")
        .text(`${data.currency} $${data.price.toFixed(2)}`, 20, yPos + 5);

      // === LÍNEA DIVISORIA ===
      doc
        .strokeColor("#dddddd")
        .lineWidth(1)
        .moveTo(20, yPos + 35)
        .lineTo(380, yPos + 35)
        .stroke();

      // === QR CODE ===
      const qrY = yPos + 50;
      
      // Convertir data URL a buffer
      const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, "");
      const qrBuffer = Buffer.from(qrBase64, "base64");
      
      doc.image(qrBuffer, 125, qrY, { width: 150, height: 150 });

      // === CÓDIGO DEL TICKET ===
      doc
        .fillColor("#1a1a2e")
        .fontSize(14)
        .font("Helvetica-Bold")
        .text(data.ticketCode, 20, qrY + 160, { width: 360, align: "center" });

      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#666666")
        .text("Presenta este código QR en la entrada", 20, qrY + 180, { width: 360, align: "center" });

      // === FOOTER ===
      doc
        .rect(0, 540, 400, 60)
        .fill("#f5f5f5");

      doc
        .fillColor("#888888")
        .fontSize(8)
        .font("Helvetica");

      if (data.holderName) {
        doc.text(`Comprado por: ${data.holderName}`, 20, 548, { width: 360 });
      }
      
      doc.text(`Orden: ${data.orderNumber}`, 20, 560, { width: 180 });
      
      if (data.purchasedAt) {
        const purchaseDate = new Date(data.purchasedAt).toLocaleDateString("es-MX");
        doc.text(`Fecha de compra: ${purchaseDate}`, 200, 560, { width: 180 });
      }

      doc.text("Este boleto es válido para una sola entrada.", 20, 575, { width: 360, align: "center" });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Genera múltiples tickets en un solo PDF
 */
export async function generateMultipleTicketsPDF(tickets: TicketPDFData[]): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 20,
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      for (let i = 0; i < tickets.length; i++) {
        if (i > 0) {
          doc.addPage();
        }

        const ticket = tickets[i];
        const qrDataUrl = await QRCode.toDataURL(ticket.ticketCode, {
          errorCorrectionLevel: "M",
          margin: 1,
          width: 120,
        });

        // Header
        doc
          .rect(0, 0, 595, 60)
          .fill("#1a1a2e");

        doc
          .fillColor("#ffffff")
          .fontSize(20)
          .font("Helvetica-Bold")
          .text("BOLETERA", 40, 20);

        doc
          .fontSize(10)
          .font("Helvetica")
          .text(`Boleto ${i + 1} de ${tickets.length}`, 450, 25);

        // Event name
        doc
          .fillColor("#1a1a2e")
          .fontSize(24)
          .font("Helvetica-Bold")
          .text(ticket.eventName, 40, 90, { width: 515 });

        // Date and venue
        const eventDate = new Date(ticket.eventDate);
        doc
          .fontSize(12)
          .font("Helvetica")
          .fillColor("#444444")
          .text(
            `${eventDate.toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} - ${eventDate.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`,
            40,
            130
          )
          .text(ticket.venueName, 40, 148);

        // Seat details box
        doc
          .rect(40, 180, 250, 150)
          .fillAndStroke("#f9f9f9", "#dddddd");

        doc
          .fillColor("#1a1a2e")
          .fontSize(14)
          .font("Helvetica-Bold")
          .text("Detalles", 50, 195);

        let detailY = 220;
        doc
          .fontSize(11)
          .font("Helvetica")
          .fillColor("#444444");

        if (ticket.tierName) {
          doc.text(`Tipo: ${ticket.tierName}`, 50, detailY);
          detailY += 20;
        }
        if (ticket.seatInfo?.zone) {
          doc.text(`Zona: ${ticket.seatInfo.zone}`, 50, detailY);
          detailY += 20;
        }
        if (ticket.seatInfo?.table) {
          doc.text(`Mesa: ${ticket.seatInfo.table}`, 50, detailY);
          detailY += 20;
        }
        if (ticket.seatInfo?.row) {
          doc.text(`Fila: ${ticket.seatInfo.row}`, 50, detailY);
          detailY += 20;
        }
        if (ticket.seatInfo?.seat) {
          doc.text(`Asiento: ${ticket.seatInfo.seat}`, 50, detailY);
          detailY += 20;
        }

        doc
          .fillColor("#16a34a")
          .fontSize(16)
          .font("Helvetica-Bold")
          .text(`${ticket.currency} $${ticket.price.toFixed(2)}`, 50, 305);

        // QR code
        const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, "");
        const qrBuffer = Buffer.from(qrBase64, "base64");
        
        doc
          .rect(320, 180, 230, 150)
          .fillAndStroke("#ffffff", "#dddddd");

        doc.image(qrBuffer, 370, 190, { width: 120, height: 120 });

        doc
          .fillColor("#1a1a2e")
          .fontSize(11)
          .font("Helvetica-Bold")
          .text(ticket.ticketCode, 320, 315, { width: 230, align: "center" });

        // Footer
        doc
          .fillColor("#888888")
          .fontSize(9)
          .font("Helvetica")
          .text(`Orden: ${ticket.orderNumber}`, 40, 360)
          .text(
            ticket.purchasedAt
              ? `Comprado: ${new Date(ticket.purchasedAt).toLocaleDateString("es-MX")}`
              : "",
            40,
            375
          );

        // Divider
        doc
          .strokeColor("#dddddd")
          .lineWidth(1)
          .moveTo(40, 400)
          .lineTo(555, 400)
          .stroke();

        // Instructions
        doc
          .fillColor("#666666")
          .fontSize(10)
          .text("Instrucciones:", 40, 420)
          .fontSize(9)
          .text("• Presenta este código QR en la entrada del evento.", 40, 440)
          .text("• Este boleto es válido para una sola persona y una sola entrada.", 40, 455)
          .text("• Guarda este documento en tu dispositivo o imprímelo.", 40, 470)
          .text("• No compartas el código QR con terceros.", 40, 485);
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Genera un QR code como PNG buffer
 */
export async function generateQRCode(data: string, size: number = 200): Promise<Buffer> {
  return QRCode.toBuffer(data, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: size,
  });
}
