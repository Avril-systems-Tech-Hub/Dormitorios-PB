/**
 * PDF template sent over WhatsApp (same layout as the YCloud reservation webhook).
 */
import fs from "fs";
import path from "path";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";
import { formatBedLabel } from "@/lib/beds";

export type WhatsAppReservationPdfAssignment = {
  guestName: string;
  bedNumber: string | number;
  bedZone?: string | null;
  lockerNumber?: string | number | null;
  lockerDays?: number;
};

export type WhatsAppReservationPdfData = {
  guestName: string;
  folioCode: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  guestCount: number;
  totalAmount: number;
  /** After full payment: show paid copy instead of "total a pagar en caja". */
  paid?: boolean;
  assignments?: WhatsAppReservationPdfAssignment[];
};

function pdfText(value: string) {
  return value.replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "").slice(0, 80);
}

const primaryColor = rgb(0.09, 0.13, 0.2);
const secondaryColor = rgb(0.85, 0.35, 0.25);
const grayText = rgb(0.4, 0.4, 0.4);
const lightGray = rgb(0.95, 0.95, 0.95);
const white = rgb(1, 1, 1);
const greenColor = rgb(0.15, 0.55, 0.25);

export async function generateWhatsAppReservationPdf(
  data: WhatsAppReservationPdfData,
): Promise<Uint8Array> {
  const assignmentCount = data.assignments?.length ?? 0;
  const extra = assignmentCount > 0 ? 18 + assignmentCount * 14 : 0;
  const pageHeight = 600 + extra;
  const offsetY = extra;

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([400, pageHeight]);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  page.drawRectangle({ x: 0, y: 500 + offsetY, width: 400, height: 100, color: primaryColor });

  let image;
  try {
    const imagePath = path.join(process.cwd(), "public", "logo-dorm.png");
    const imageBytes = fs.readFileSync(imagePath);
    image = await pdfDoc.embedJpg(imageBytes);
  } catch (e) {
    console.error("[whatsapp-reservation-pdf] No se pudo cargar el logo:", e);
  }

  if (image) {
    const dims = image.scaleToFit(60, 60);
    page.drawImage(image, { x: 30, y: 520 + offsetY, width: dims.width, height: dims.height });
    page.drawText("Dormitorios Plaza Basilica", {
      x: 105, y: 555 + offsetY, size: 16, font: boldFont, color: white,
    });
    page.drawText("CONFIRMACION DE RESERVACION", {
      x: 105, y: 535 + offsetY, size: 9, font: regularFont, color: rgb(0.8, 0.8, 0.8),
    });
  } else {
    page.drawText("Dormitorios Plaza Basilica", {
      x: 40, y: 555 + offsetY, size: 16, font: boldFont, color: white,
    });
    page.drawText("CONFIRMACION DE RESERVACION", {
      x: 40, y: 535 + offsetY, size: 9, font: regularFont, color: rgb(0.8, 0.8, 0.8),
    });
  }

  page.drawRectangle({
    x: 40, y: 440 + offsetY, width: 320, height: 35,
    color: lightGray, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1,
  });
  page.drawText("Folio de Reserva:", { x: 55, y: 452 + offsetY, size: 11, font: regularFont, color: grayText });
  page.drawText(pdfText(data.folioCode), { x: 155, y: 452 + offsetY, size: 14, font: boldFont, color: primaryColor });

  const startY = 390 + offsetY;

  page.drawText("Titular:", { x: 40, y: startY, size: 10, font: regularFont, color: grayText });
  page.drawText(pdfText(data.guestName), { x: 40, y: startY - 14, size: 12, font: boldFont, color: primaryColor });

  page.drawText("Entrada:", { x: 40, y: startY - 45, size: 10, font: regularFont, color: grayText });
  page.drawText(pdfText(data.checkInDate), { x: 40, y: startY - 59, size: 12, font: boldFont, color: primaryColor });

  page.drawText("Noches:", { x: 40, y: startY - 90, size: 10, font: regularFont, color: grayText });
  page.drawText(data.nights.toString(), { x: 40, y: startY - 104, size: 12, font: boldFont, color: primaryColor });

  page.drawText("Personas:", { x: 220, y: startY, size: 10, font: regularFont, color: grayText });
  page.drawText(data.guestCount.toString(), { x: 220, y: startY - 14, size: 12, font: boldFont, color: primaryColor });

  page.drawText("Salida:", { x: 220, y: startY - 45, size: 10, font: regularFont, color: grayText });
  page.drawText(pdfText(data.checkOutDate), { x: 220, y: startY - 59, size: 12, font: boldFont, color: primaryColor });

  if (data.assignments?.length) {
    let assignY = startY - 118;
    page.drawText("Asignaciones:", { x: 40, y: assignY, size: 10, font: boldFont, color: primaryColor });
    for (const assignment of data.assignments) {
      assignY -= 14;
      let line = `${assignment.guestName}: ${formatBedLabel(assignment.bedNumber, assignment.bedZone) ?? `Cama ${assignment.bedNumber}`}`;
      const lockerDays = Number(assignment.lockerDays ?? 0);
      if (lockerDays > 0) {
        line += assignment.lockerNumber
          ? ` · Locker ${assignment.lockerNumber} (${lockerDays}d)`
          : ` · Locker pendiente (${lockerDays}d)`;
      }
      page.drawText(pdfText(line).slice(0, 62), { x: 40, y: assignY, size: 9, font: regularFont, color: primaryColor });
    }
  }

  page.drawLine({
    start: { x: 40, y: startY - 130 - extra },
    end: { x: 360, y: startY - 130 - extra },
    thickness: 1,
    color: rgb(0.9, 0.9, 0.9),
  });

  const boxY = startY - 185 - extra;
  page.drawRectangle({ x: 40, y: boxY, width: 320, height: 40, color: rgb(0.96, 0.98, 1) });
  if (data.paid) {
    page.drawText("Total pagado:", { x: 55, y: boxY + 14, size: 12, font: boldFont, color: primaryColor });
    page.drawText(`$${data.totalAmount.toFixed(2)} MXN`, {
      x: 220, y: boxY + 14, size: 14, font: boldFont, color: greenColor,
    });
  } else {
    page.drawText("Total a Pagar en Caja:", { x: 55, y: boxY + 14, size: 12, font: boldFont, color: primaryColor });
    page.drawText(`$${data.totalAmount.toFixed(2)} MXN`, {
      x: 220, y: boxY + 14, size: 14, font: boldFont, color: secondaryColor,
    });
  }

  try {
    const qrText = data.paid
      ? [
          `Folio: ${data.folioCode}`,
          `Titular: ${data.guestName}`,
          `Personas: ${data.guestCount}`,
          `Entrada: ${data.checkInDate}`,
          `Salida: ${data.checkOutDate}`,
          `Estado: PAGADO`,
          `Total: $${data.totalAmount.toFixed(2)} MXN`,
        ].join("\n")
      : [
          `Folio: ${data.folioCode}`,
          `Titular: ${data.guestName}`,
          `Personas: ${data.guestCount}`,
          `Entrada: ${data.checkInDate}`,
          `Salida: ${data.checkOutDate}`,
          `Total a Pagar: $${data.totalAmount.toFixed(2)} MXN`,
        ].join("\n");

    const qrBuffer = await QRCode.toBuffer(qrText, { errorCorrectionLevel: "M", margin: 1 });
    const qrImage = await pdfDoc.embedPng(qrBuffer);

    page.drawImage(qrImage, { x: 270, y: 65, width: 90, height: 90 });
    page.drawText("Gracias por elegirnos!", { x: 40, y: 130, size: 14, font: boldFont, color: primaryColor });
    page.drawText("Escanea este codigo QR", { x: 40, y: 110, size: 10, font: regularFont, color: grayText });
    if (data.paid) {
      page.drawText("para verificar tu", { x: 40, y: 95, size: 10, font: regularFont, color: grayText });
      page.drawText("confirmacion de pago.", { x: 40, y: 80, size: 10, font: regularFont, color: grayText });
    } else {
      page.drawText("en recepcion para agilizar", { x: 40, y: 95, size: 10, font: regularFont, color: grayText });
      page.drawText("tu asignacion de camas.", { x: 40, y: 80, size: 10, font: regularFont, color: grayText });
    }
  } catch (qrError) {
    console.error("[whatsapp-reservation-pdf] Error generando QR:", qrError);
  }

  page.drawLine({ start: { x: 40, y: 40 }, end: { x: 360, y: 40 }, thickness: 1, color: rgb(0.9, 0.9, 0.9) });
  page.drawText("Dormitorios Plaza Basilica  •  Check-in rapido, control en caja.", {
    x: 65, y: 20, size: 8, font: regularFont, color: grayText,
  });

  return pdfDoc.save();
}
