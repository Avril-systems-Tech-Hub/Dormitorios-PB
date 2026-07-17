import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import crypto from "crypto";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeMexicanPhone } from "@/lib/phone";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

// Función para validar que la petición realmente viene de Ycloud
function verifySignature(bodyText: string, headerValue: string | null, secret: string) {
  if (!headerValue || !secret) {
    console.error("Falta headerValue o secret.", { hasHeader: !!headerValue, secretLength: secret?.length });
    return false;
  }
  try {
    const parts = headerValue.split(',');
    const tPart = parts.find(p => p.trim().startsWith('t='));
    const sPart = parts.find(p => p.trim().startsWith('s='));

    if (!tPart || !sPart) {
      console.error("Formato de Ycloud-Signature inválido:", headerValue);
      return false;
    }

    const timestamp = tPart.split('=')[1].trim();
    const signature = sPart.split('=')[1].trim();
    const signedPayload = `${timestamp}.${bodyText}`;

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(signedPayload)
      .digest("hex");
      
    if (signature.length !== expectedSignature.length) {
       console.error("Las longitudes de las firmas no coinciden.", { received: signature.length, expected: expectedSignature.length });
       return false;
    }

    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );

    if (!isValid) console.error("La firma calculada no coincide con la recibida.");
    return isValid;
  } catch (e) {
    console.error("Excepción en verifySignature:", e);
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const bodyText = await req.text();
    const signature = req.headers.get("Ycloud-Signature");
    const secret = process.env.YCLOUD_WEBHOOK_SECRET || "";

    if (process.env.NODE_ENV === "production" && !verifySignature(bodyText, signature, secret)) {
      console.error("Firma de Ycloud inválida");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = JSON.parse(bodyText);
    console.log("--- WEBHOOK RECIBIDO DE YCLOUD ---");
    console.log(JSON.stringify(payload, null, 2));

    if (payload.type !== "whatsapp.inbound_message.received") {
      return NextResponse.json({ success: true, ignored: true }, { status: 200 });
    }

    const messageContent = payload.whatsappInboundMessage?.text?.body || "";
    const senderPhone = payload.whatsappInboundMessage?.from || "";

    // 1. Extraer Fechas y Notas
    const checkInMatch = messageContent.match(/Entrada:\s*(.+)/i);
    const checkOutMatch = messageContent.match(/Salida:\s*(.+)/i);
    const notesMatch = messageContent.match(/Notas:\s*(.+)/i);

    let checkInStr = checkInMatch ? checkInMatch[1].trim() : "";
    let checkOutStr = checkOutMatch ? checkOutMatch[1].trim() : "";
    const notes = notesMatch ? notesMatch[1].trim() : null;

    let checkInDate = new Date();
    let checkOutDate = new Date();
    if (checkInStr && checkOutStr) {
      checkInDate = new Date(checkInStr);
      checkOutDate = new Date(checkOutStr);
    } else {
      checkOutDate.setDate(checkInDate.getDate() + 1);
      checkInStr = checkInDate.toISOString().split('T')[0];
      checkOutStr = checkOutDate.toISOString().split('T')[0];
    }

    const diffTime = Math.abs(checkOutDate.getTime() - checkInDate.getTime());
    const nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

    // 2. Extraer Huéspedes
    const guests: { full_name: string; phone: string; email: string; sex: string }[] = [];
    const guestBlocks = messageContent.split(/---\s*Huésped\s+\d+\s*---/i).slice(1);

    if (guestBlocks.length > 0) {
      for (const block of guestBlocks) {
        const nameMatch = block.match(/Nombre:\s*(.+)/i);
        const phoneMatch = block.match(/WhatsApp:\s*(.+)/i);
        const emailMatch = block.match(/Correo:\s*(.+)/i);
        const sexMatch = block.match(/Sexo:\s*(.+)/i);

        if (nameMatch && phoneMatch) {
          guests.push({
            full_name: nameMatch[1].trim(),
            phone: phoneMatch[1].trim(),
            email: emailMatch ? emailMatch[1].trim() : "",
            sex: sexMatch ? sexMatch[1].trim() : "unknown",
          });
        }
      }
    } else {
      // Fallback para WhatsappCta (un solo huésped)
      const nameMatch = messageContent.match(/Nombre:\s*(.+)/i);
      const phoneMatch = messageContent.match(/WhatsApp:\s*(.+)/i);
      if (nameMatch && phoneMatch) {
        guests.push({
          full_name: nameMatch[1].trim(),
          phone: phoneMatch[1].trim(),
          email: "",
          sex: "unknown",
        });
      }
    }

    if (guests.length === 0) {
      return NextResponse.json({ success: true, ignored: true, reason: "No guest info found" });
    }

    const supabase = createAdminClient();

    // 3. Registrar/Actualizar Huéspedes en BD
    const guestIds: string[] = [];
    for (const g of guests) {
      const normalizedPhone = normalizeMexicanPhone(g.phone);
      const { data: existingGuest } = await supabase
        .from("guests")
        .select("id")
        .eq("normalized_phone", normalizedPhone)
        .maybeSingle();

      if (existingGuest) {
        guestIds.push(existingGuest.id);
        await supabase.from("guests").update({
          full_name: g.full_name,
          email: g.email || undefined,
        }).eq("id", existingGuest.id);
      } else {
        const { data: newGuest } = await supabase
          .from("guests")
          .insert({
            full_name: g.full_name,
            phone: g.phone,
            normalized_name: g.full_name.toLowerCase(),
            normalized_phone: normalizedPhone,
            email: g.email || null,
            sex: g.sex || "unknown"
          })
          .select("id")
          .single();
        if (newGuest) guestIds.push(newGuest.id);
      }
    }

    if (guestIds.length === 0) {
      return NextResponse.json({ success: false, reason: "Failed to insert guests" });
    }

    // 5. Crear Folio y Reservación
    const folioCode = `WA-${Date.now().toString().slice(-6)}`;
    const baseRate = 120; // Tarifa fija por defecto
    const totalAmount = baseRate * nights * guestIds.length;

    const { data: folio, error: folioError } = await supabase
      .from("folios")
      .insert({
        folio_code: folioCode,
        total_amount: totalAmount,
        balance_due: totalAmount,
        paid_amount: 0,
        payment_status: "pending"
      })
      .select("id")
      .single();

    if (!folioError && folio) {
      const { data: reservation } = await supabase
        .from("reservations")
        .insert({
          folio_id: folio.id,
          created_by: null, // Sistema automatizado
          check_in_date: checkInStr,
          check_out_date: checkOutStr,
          check_in_at: `${checkInStr}T15:00:00`,
          check_out_at: `${checkOutStr}T12:00:00`,
          nights: nights,
          notes: notes,
          reservation_source: "guest_app"
        })
        .select("id")
        .single();

      if (reservation) {
        // 6. Registrar huéspedes sin cama asignada
        const guestInserts = guestIds.map((gId) => ({
          reservation_id: reservation.id,
          guest_id: gId,
          bed_id: null,
          nightly_rate: baseRate,
          discount_amount: 0,
          final_rate: baseRate,
          locker_amount: 0,
          social_bonus_status: "captured",
        }));
        await supabase.from("reservation_guests").insert(guestInserts);

        // --- 7. GENERAR EL PDF ---
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([400, 600]);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

        // Colores
        const primaryColor = rgb(0.09, 0.13, 0.20); // Oscuro mkt-slate
        const secondaryColor = rgb(0.85, 0.35, 0.25); // Terracotta aprox
        const grayText = rgb(0.4, 0.4, 0.4);
        const lightGray = rgb(0.95, 0.95, 0.95);
        const white = rgb(1, 1, 1);

        // Cabecera oscura
        page.drawRectangle({ x: 0, y: 500, width: 400, height: 100, color: primaryColor });

        // Logo
        let image;
        try {
          const imagePath = path.join(process.cwd(), "public", "logo-dorm.png");
          const imageBytes = fs.readFileSync(imagePath);
          image = await pdfDoc.embedJpg(imageBytes);
        } catch (e) {
          console.error("No se pudo cargar el logo:", e);
        }

        if (image) {
          const dims = image.scaleToFit(60, 60);
          page.drawImage(image, { x: 30, y: 520, width: dims.width, height: dims.height });
          page.drawText('Dormitorios Plaza Basilica', { x: 105, y: 555, size: 16, font: boldFont, color: white });
          page.drawText('CONFIRMACIÓN DE RESERVACIÓN', { x: 105, y: 535, size: 9, font: regularFont, color: rgb(0.8, 0.8, 0.8) });
        } else {
          page.drawText('Dormitorios Plaza Basilica', { x: 40, y: 555, size: 16, font: boldFont, color: white });
          page.drawText('CONFIRMACIÓN DE RESERVACIÓN', { x: 40, y: 535, size: 9, font: regularFont, color: rgb(0.8, 0.8, 0.8) });
        }

        // Folio Badge
        page.drawRectangle({ x: 40, y: 440, width: 320, height: 35, color: lightGray, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1 });
        page.drawText('Folio de Reserva:', { x: 55, y: 452, size: 11, font: regularFont, color: grayText });
        page.drawText(folioCode, { x: 155, y: 452, size: 14, font: boldFont, color: primaryColor });

        // Datos del huésped y estancia
        const startY = 390;

        // Columna 1
        page.drawText('Titular:', { x: 40, y: startY, size: 10, font: regularFont, color: grayText });
        page.drawText(guests[0].full_name, { x: 40, y: startY - 14, size: 12, font: boldFont, color: primaryColor });

        page.drawText('Entrada:', { x: 40, y: startY - 45, size: 10, font: regularFont, color: grayText });
        page.drawText(checkInStr, { x: 40, y: startY - 59, size: 12, font: boldFont, color: primaryColor });

        page.drawText('Noches:', { x: 40, y: startY - 90, size: 10, font: regularFont, color: grayText });
        page.drawText(nights.toString(), { x: 40, y: startY - 104, size: 12, font: boldFont, color: primaryColor });

        // Columna 2
        page.drawText('Personas:', { x: 220, y: startY, size: 10, font: regularFont, color: grayText });
        page.drawText(guests.length.toString(), { x: 220, y: startY - 14, size: 12, font: boldFont, color: primaryColor });

        page.drawText('Salida:', { x: 220, y: startY - 45, size: 10, font: regularFont, color: grayText });
        page.drawText(checkOutStr, { x: 220, y: startY - 59, size: 12, font: boldFont, color: primaryColor });

        // Linea separadora
        page.drawLine({ start: { x: 40, y: startY - 130 }, end: { x: 360, y: startY - 130 }, thickness: 1, color: rgb(0.9, 0.9, 0.9) });

        // Caja de Total
        page.drawRectangle({ x: 40, y: startY - 185, width: 320, height: 40, color: rgb(0.96, 0.98, 1) });
        page.drawText('Total a Pagar en Caja:', { x: 55, y: startY - 171, size: 12, font: boldFont, color: primaryColor });
        page.drawText(`$${totalAmount.toFixed(2)} MXN`, { x: 220, y: startY - 171, size: 14, font: boldFont, color: secondaryColor });

        // --- GENERAR QR ---
        try {
          const qrText = `Folio: ${folioCode}\nTitular: ${guests[0].full_name}\nPersonas: ${guests.length}\nEntrada: ${checkInStr}\nSalida: ${checkOutStr}\nTotal a Pagar: $${totalAmount.toFixed(2)} MXN`;
          const qrBuffer = await QRCode.toBuffer(qrText, { errorCorrectionLevel: 'M', margin: 1 });
          const qrImage = await pdfDoc.embedPng(qrBuffer);
          
          page.drawImage(qrImage, { x: 270, y: 65, width: 90, height: 90 });
          
          page.drawText('¡Gracias por elegirnos!', { x: 40, y: 130, size: 14, font: boldFont, color: primaryColor });
          page.drawText('Escanea este código QR', { x: 40, y: 110, size: 10, font: regularFont, color: grayText });
          page.drawText('en recepción para agilizar', { x: 40, y: 95, size: 10, font: regularFont, color: grayText });
          page.drawText('tu asignación de camas.', { x: 40, y: 80, size: 10, font: regularFont, color: grayText });
        } catch (qrError) {
          console.error("Error generando el QR:", qrError);
        }

        // Pie de página
        page.drawLine({ start: { x: 40, y: 40 }, end: { x: 360, y: 40 }, thickness: 1, color: rgb(0.9, 0.9, 0.9) });
        page.drawText('Dormitorios Plaza Basílica • Check-in rápido, control en caja.', { x: 65, y: 20, size: 9, font: regularFont, color: grayText });

        const pdfBytes = await pdfDoc.save();

        // --- 8. SUBIR PDF A SUPABASE STORAGE ---
        const bucketName = "whatsapp-pdfs";
        await supabase.storage.createBucket(bucketName, { public: true }).catch(() => {});

        const fileName = `reserva-${folioCode}.pdf`;
        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(fileName, pdfBytes, {
            contentType: 'application/pdf',
            upsert: true
          });

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(fileName);
          const pdfPublicUrl = publicUrlData.publicUrl;
          console.log("PDF URL generada:", pdfPublicUrl);

          // --- 9. ENVIAR MENSAJE Y PDF VIA YCLOUD ---
          const ycloudApiKey = process.env.YCLOUD_API_KEY;
          const ycloudFromPhone = process.env.YCLOUD_FROM_PHONE;

          if (ycloudApiKey && ycloudFromPhone) {
            const response = await fetch("https://api.ycloud.com/v2/whatsapp/messages/sendDirectly", {
              method: "POST",
              headers: {
                "X-API-Key": ycloudApiKey,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: ycloudFromPhone.replace('+', ''),
                to: senderPhone.replace('+', ''),
                type: "document",
                document: { 
                  link: pdfPublicUrl,
                  filename: `Confirmacion_${folioCode}.pdf`,
                  caption: `¡Hola ${guests[0].full_name}! Tu reservación para ${guests.length} persona(s) está confirmada.\n\nFolio: *${folioCode}*\n\nPor favor, presenta el PDF adjunto en recepción para realizar tu pago y recibir las camas.`
                }
              }),
            });
            const result = await response.json();
            console.log("Respuesta de Ycloud al enviar PDF:", result);
          }
        }
      }
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/reservations");
    revalidatePath("/dashboard/folios");
    revalidatePath("/dashboard/guests");
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error procesando el webhook:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
