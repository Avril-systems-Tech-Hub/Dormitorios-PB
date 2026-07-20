/**
 * Genera un PDF de confirmación de pago para una reservación.
 * Similar al que se genera en el webhook de YCloud pero enfocado en el pago.
 */
import fs from "fs";
import path from "path";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";

export type PaymentPdfData = {
  guestName: string;
  folioCode: string;
  amount: number;
  method: string;
  balanceDue: number;
  paymentStatus: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  guestCount: number;
  totalAmount: number;
  discountPercent?: number;
  discountAmount?: number;
  originalTotal?: number;
  assignments?: Array<{
    guestName: string;
    bedNumber: number;
    lockerNumber?: string | number | null;
    lockerDays?: number;
  }>;
};

const METHOD_LABELS: Record<string, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  card: "Tarjeta",
};

export async function generatePaymentConfirmationPdf(
  data: PaymentPdfData,
): Promise<Uint8Array> {
  // Calculamos la altura necesaria según si hay descuento o asignaciones
  const hasDiscount = !!(data.discountPercent && data.discountPercent > 0);
  const assignmentCount = data.assignments?.length ?? 0;
  const offsetY = (hasDiscount ? 60 : 0) + assignmentCount * 16;
  const pageHeight = 620 + offsetY;
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([400, pageHeight]);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Colores
  const primaryColor = rgb(0.09, 0.13, 0.2); // mkt-slate
  const secondaryColor = rgb(0.85, 0.35, 0.25); // terracotta
  const grayText = rgb(0.4, 0.4, 0.4);
  const lightGray = rgb(0.95, 0.95, 0.95);
  const white = rgb(1, 1, 1);
  const greenColor = rgb(0.15, 0.55, 0.25);

  // ---- Cabecera oscura ----
  page.drawRectangle({ x: 0, y: 520 + offsetY, width: 400, height: 100, color: primaryColor });

  // Logo
  let image;
  try {
    const imagePath = path.join(process.cwd(), "public", "logo-dorm.png");
    const imageBytes = fs.readFileSync(imagePath);
    image = await pdfDoc.embedJpg(imageBytes);
  } catch {
    console.warn("[payment-pdf] No se pudo cargar el logo.");
  }

  if (image) {
    const dims = image.scaleToFit(55, 55);
    page.drawImage(image, { x: 30, y: 540 + offsetY, width: dims.width, height: dims.height });
    page.drawText("Dormitorios Plaza Basilica", { x: 100, y: 575 + offsetY, size: 15, font: boldFont, color: white });
    page.drawText("CONFIRMACION DE PAGO", { x: 100, y: 555 + offsetY, size: 9, font: regularFont, color: rgb(0.8, 0.8, 0.8) });
  } else {
    page.drawText("Dormitorios Plaza Basilica", { x: 40, y: 575 + offsetY, size: 15, font: boldFont, color: white });
    page.drawText("CONFIRMACION DE PAGO", { x: 40, y: 555 + offsetY, size: 9, font: regularFont, color: rgb(0.8, 0.8, 0.8) });
  }

  // ---- Folio Badge ----
  page.drawRectangle({
    x: 40, y: 460 + offsetY, width: 320, height: 35,
    color: lightGray, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1,
  });
  page.drawText("Folio de Reserva:", { x: 55, y: 472 + offsetY, size: 11, font: regularFont, color: grayText });
  page.drawText(data.folioCode, { x: 160, y: 472 + offsetY, size: 14, font: boldFont, color: primaryColor });

  // ---- Estado del pago ----
  const isLiquidated = data.paymentStatus === "liquidated";
  const statusLabel = isLiquidated ? "PAGADO" : "PAGO PARCIAL";
  const statusColor = isLiquidated ? greenColor : secondaryColor;

  page.drawRectangle({ x: 40, y: 420 + offsetY, width: 320, height: 22, color: rgb(0.96, 0.98, 1) });
  page.drawText(`Estado: ${statusLabel}`, { x: 55, y: 426 + offsetY, size: 12, font: boldFont, color: statusColor });

  // ---- Datos del huésped ----
  const startY = 385 + offsetY;

  // Columna 1
  page.drawText("Titular:", { x: 40, y: startY, size: 10, font: regularFont, color: grayText });
  page.drawText(data.guestName, { x: 40, y: startY - 14, size: 12, font: boldFont, color: primaryColor });

  page.drawText("Entrada:", { x: 40, y: startY - 45, size: 10, font: regularFont, color: grayText });
  page.drawText(data.checkInDate, { x: 40, y: startY - 59, size: 12, font: boldFont, color: primaryColor });

  page.drawText("Noches:", { x: 40, y: startY - 90, size: 10, font: regularFont, color: grayText });
  page.drawText(data.nights.toString(), { x: 40, y: startY - 104, size: 12, font: boldFont, color: primaryColor });

  // Columna 2
  page.drawText("Personas:", { x: 220, y: startY, size: 10, font: regularFont, color: grayText });
  page.drawText(data.guestCount.toString(), { x: 220, y: startY - 14, size: 12, font: boldFont, color: primaryColor });

  page.drawText("Salida:", { x: 220, y: startY - 45, size: 10, font: regularFont, color: grayText });
  page.drawText(data.checkOutDate, { x: 220, y: startY - 59, size: 12, font: boldFont, color: primaryColor });

  if (data.assignments?.length) {
    let assignY = startY - 118;
    page.drawText("Asignaciones:", { x: 40, y: assignY, size: 10, font: boldFont, color: primaryColor });
    for (const assignment of data.assignments) {
      assignY -= 14;
      let line = `${assignment.guestName}: Cama ${assignment.bedNumber}`;
      const lockerDays = Number(assignment.lockerDays ?? 0);
      if (lockerDays > 0) {
        line += assignment.lockerNumber
          ? ` · Locker ${assignment.lockerNumber} (${lockerDays}d)`
          : ` · Locker pendiente (${lockerDays}d)`;
      }
      page.drawText(line, { x: 40, y: assignY, size: 9, font: regularFont, color: primaryColor });
    }
  }

  // ---- Línea separadora ----
  page.drawLine({
    start: { x: 40, y: startY - 130 },
    end: { x: 360, y: startY - 130 },
    thickness: 1,
    color: rgb(0.9, 0.9, 0.9),
  });

  // ---- Detalle de pago ----
  const payY = startY - 150;
  page.drawText("Detalle del Pago", { x: 40, y: payY, size: 12, font: boldFont, color: primaryColor });

  page.drawText("Monto pagado:", { x: 40, y: payY - 22, size: 10, font: regularFont, color: grayText });
  page.drawText(`$${data.amount.toFixed(2)} MXN`, { x: 220, y: payY - 22, size: 12, font: boldFont, color: greenColor });

  page.drawText("Metodo:", { x: 40, y: payY - 42, size: 10, font: regularFont, color: grayText });
  page.drawText(METHOD_LABELS[data.method] || data.method, { x: 220, y: payY - 42, size: 12, font: boldFont, color: primaryColor });

  // Discount section (if applicable)
  let discountLineOffset = 0;
  if (data.discountPercent && data.discountPercent > 0) {
    page.drawText("Subtotal:", { x: 40, y: payY - 62, size: 10, font: regularFont, color: grayText });
    page.drawText(`$${(data.originalTotal ?? data.totalAmount).toFixed(2)} MXN`, { x: 220, y: payY - 62, size: 12, font: boldFont, color: primaryColor });

    page.drawText(`Descuento (${data.discountPercent}%):`, { x: 40, y: payY - 82, size: 10, font: regularFont, color: grayText });
    page.drawText(`-$${(data.discountAmount ?? 0).toFixed(2)} MXN`, { x: 220, y: payY - 82, size: 12, font: boldFont, color: greenColor });

    page.drawText("Total con descuento:", { x: 40, y: payY - 102, size: 10, font: regularFont, color: grayText });
    page.drawText(`$${data.totalAmount.toFixed(2)} MXN`, { x: 220, y: payY - 102, size: 12, font: boldFont, color: primaryColor });

    if (!isLiquidated && data.balanceDue > 0) {
      page.drawText("Saldo pendiente:", { x: 40, y: payY - 122, size: 10, font: regularFont, color: grayText });
      page.drawText(`$${data.balanceDue.toFixed(2)} MXN`, { x: 220, y: payY - 122, size: 12, font: boldFont, color: secondaryColor });
    }
    discountLineOffset = 60;
  } else {
    page.drawText("Total de la reserva:", { x: 40, y: payY - 62, size: 10, font: regularFont, color: grayText });
    page.drawText(`$${data.totalAmount.toFixed(2)} MXN`, { x: 220, y: payY - 62, size: 12, font: boldFont, color: primaryColor });

    if (!isLiquidated && data.balanceDue > 0) {
      page.drawText("Saldo pendiente:", { x: 40, y: payY - 82, size: 10, font: regularFont, color: grayText });
      page.drawText(`$${data.balanceDue.toFixed(2)} MXN`, { x: 220, y: payY - 82, size: 12, font: boldFont, color: secondaryColor });
    }
  }

  // ---- Caja de estado final ----
  const boxY = payY - (isLiquidated ? 110 : 130) - discountLineOffset;
  page.drawRectangle({ x: 40, y: boxY, width: 320, height: 35, color: rgb(0.96, 0.98, 1) });
  if (isLiquidated) {
    page.drawText("Reservacion confirmada - Pago completo", {
      x: 55, y: boxY + 12, size: 11, font: boldFont, color: greenColor,
    });
  } else {
    page.drawText("Pago parcial registrado", {
      x: 55, y: boxY + 12, size: 11, font: boldFont, color: secondaryColor,
    });
  }

  // ---- QR Code ---- (posiciones relativas a boxY para evitar sobreposición)
  try {
    const qrText = [
      `Folio: ${data.folioCode}`,
      `Titular: ${data.guestName}`,
      `Estado: ${statusLabel}`,
      `Entrada: ${data.checkInDate}`,
      `Salida: ${data.checkOutDate}`,
      `Total: $${data.totalAmount.toFixed(2)} MXN`,
      `Pagado: $${data.amount.toFixed(2)} MXN`,
    ].join("\n");

    const qrSize = 80;
    const qrY = boxY - 20 - qrSize;
    const qrBuffer = await QRCode.toBuffer(qrText, { errorCorrectionLevel: "M", margin: 1 });
    const qrImage = await pdfDoc.embedPng(qrBuffer);
    page.drawImage(qrImage, { x: 275, y: qrY, width: qrSize, height: qrSize });

    const thanksY = qrY + qrSize - 10;
    page.drawText("Gracias por su pago!", { x: 40, y: thanksY, size: 13, font: boldFont, color: primaryColor });
    page.drawText("Escanea el codigo QR para", { x: 40, y: thanksY - 16, size: 10, font: regularFont, color: grayText });
    page.drawText("verificar tu confirmacion.", { x: 40, y: thanksY - 30, size: 10, font: regularFont, color: grayText });
  } catch (qrError) {
    console.error("[payment-pdf] Error generando QR:", qrError);
  }

  // ---- Pie de página ---- (fijo en la parte inferior)
  page.drawLine({ start: { x: 40, y: 30 }, end: { x: 360, y: 30 }, thickness: 1, color: rgb(0.9, 0.9, 0.9) });
  page.drawText("Dormitorios Plaza Basilica  •  Confirmacion de pago", {
    x: 80, y: 16, size: 8, font: regularFont, color: grayText,
  });

  return pdfDoc.save();
}