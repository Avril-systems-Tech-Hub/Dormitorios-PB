/**
 * Enviar mensajes WhatsApp vía YCloud API.
 *
 * WhatsApp tiene dos tipos de mensajes:
 * 1. **Template messages** (business-initiated): Para contactar usuarios que NO han
 *    enviado un mensaje previo. Requieren un template aprobido en WhatsApp Manager.
 * 2. **Non-template messages** (free-form): Solo se pueden enviar dentro de la
 *    ventana de 24 horas después de que el usuario envió un mensaje.
 *
 * Requiere las variables de entorno:
 * - YCLOUD_API_KEY
 * - YCLOUD_FROM_PHONE  (número WhatsApp Business sin "+")
 * - YCLOUD_TEMPLATE_NAME (nombre del template aprobido para confirmación de pago)
 * - YCLOUD_TEMPLATE_LANGUAGE (código de idioma del template, ej: "es", default: "es")
 */

type YCloudTextMessagePayload = {
  from: string;
  to: string;
  type: "text";
  text: {
    body: string;
  };
};

type YCloudTemplateMessagePayload = {
  from: string;
  to: string;
  type: "template";
  template: {
    name: string;
    language: {
      code: string;
    };
    components?: Array<{
      type: "body" | "header" | "button";
      parameters: Array<{
        type: "text";
        text: string;
      }>;
    }>;
  };
};

type YCloudResponse = {
  success: boolean;
  messageId?: string;
  error?: string;
  pricingCategory?: string;
};

export async function sendWhatsAppTextMessage(
  toPhone: string,
  body: string,
): Promise<YCloudResponse> {
  const apiKey = process.env.YCLOUD_API_KEY;
  const fromPhone = process.env.YCLOUD_FROM_PHONE;

  if (!apiKey || !fromPhone) {
    console.warn(
      "[YCloud] Faltan YCLOUD_API_KEY o YCLOUD_FROM_PHONE. No se enviará WhatsApp.",
    );
    return { success: false, error: "Missing YCloud configuration" };
  }

  // Limpiar el número: quitar "+" y espacios
  const cleanTo = toPhone.replace(/\+|\s|-/g, "");
  const cleanFrom = fromPhone.replace(/\+|\s|-/g, "");

  const payload: YCloudTextMessagePayload = {
    from: cleanFrom,
    to: cleanTo,
    type: "text",
    text: { body },
  };

  try {
    const response = await fetch(
      "https://api.ycloud.com/v2/whatsapp/messages/sendDirectly",
      {
        method: "POST",
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("[YCloud] Error enviando WhatsApp:", result);
      return {
        success: false,
        error: result.message || `HTTP ${response.status}`,
      };
    }

    console.log("[YCloud] WhatsApp enviado exitosamente:", result);
    return { success: true, messageId: result.id };
  } catch (err) {
    console.error("[YCloud] Excepción enviando WhatsApp:", err);
    return { success: false, error: String(err) };
  }
}

/**
 * Enviar un documento PDF por WhatsApp vía YCloud API.
 */
export async function sendWhatsAppDocument(
  toPhone: string,
  pdfUrl: string,
  filename: string,
  caption: string,
): Promise<YCloudResponse> {
  const apiKey = process.env.YCLOUD_API_KEY;
  const fromPhone = process.env.YCLOUD_FROM_PHONE;

  if (!apiKey || !fromPhone) {
    console.warn(
      "[YCloud] Faltan YCLOUD_API_KEY o YCLOUD_FROM_PHONE. No se enviará WhatsApp.",
    );
    return { success: false, error: "Missing YCloud configuration" };
  }

  const cleanTo = toPhone.replace(/\+|\s|-/g, "");
  const cleanFrom = fromPhone.replace(/\+|\s|-/g, "");

  const payload = {
    from: cleanFrom,
    to: cleanTo,
    type: "document",
    document: {
      link: pdfUrl,
      filename,
      caption,
    },
  };

  try {
    const response = await fetch(
      "https://api.ycloud.com/v2/whatsapp/messages/sendDirectly",
      {
        method: "POST",
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("[YCloud] Error enviando documento WhatsApp:", result);
      return {
        success: false,
        error: result.message || `HTTP ${response.status}`,
      };
    }

    console.log("[YCloud] Documento WhatsApp enviado exitosamente:", result);
    return { success: true, messageId: result.id };
  } catch (err) {
    console.error("[YCloud] Excepción enviando documento WhatsApp:", err);
    return { success: false, error: String(err) };
  }
}

/**
 * Enviar un mensaje template WhatsApp vía YCloud API.
 * Los template messages son necesarios para contactar usuarios que NUNCA han
 * enviado un mensaje al número de WhatsApp Business (business-initiated).
 * Requiere que el template esté creado y aprobado en WhatsApp Manager > Templates.
 */
export async function sendWhatsAppTemplateMessage(
  toPhone: string,
  templateName: string,
  languageCode: string,
  bodyParameters?: string[],
  headerParameters?: string[],
): Promise<YCloudResponse> {
  const apiKey = process.env.YCLOUD_API_KEY;
  const fromPhone = process.env.YCLOUD_FROM_PHONE;

  if (!apiKey || !fromPhone) {
    console.warn(
      "[YCloud] Faltan YCLOUD_API_KEY o YCLOUD_FROM_PHONE. No se enviará WhatsApp.",
    );
    return { success: false, error: "Missing YCloud configuration" };
  }

  const cleanTo = toPhone.replace(/\+|\s|-/g, "");
  const cleanFrom = fromPhone.replace(/\+|\s|-/g, "");

  // Construir componentes: header y body por separado
  const components: Array<{
    type: "body" | "header" | "button";
    parameters: Array<{ type: "text"; text: string }>;
  }> = [];

  if (headerParameters?.length) {
    components.push({
      type: "header",
      parameters: headerParameters.map((text) => ({
        type: "text" as const,
        text,
      })),
    });
  }

  if (bodyParameters?.length) {
    components.push({
      type: "body",
      parameters: bodyParameters.map((text) => ({
        type: "text" as const,
        text,
      })),
    });
  }

  const payload: YCloudTemplateMessagePayload = {
    from: cleanFrom,
    to: cleanTo,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: languageCode,
      },
      ...(components.length ? { components } : {}),
    },
  };

  try {
    const response = await fetch(
      "https://api.ycloud.com/v2/whatsapp/messages/sendDirectly",
      {
        method: "POST",
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("[YCloud] Error enviando template WhatsApp:", result);
      return {
        success: false,
        error: result.message || `HTTP ${response.status}`,
      };
    }

    console.log("[YCloud] Template WhatsApp enviado exitosamente:", result);
    return {
      success: true,
      messageId: result.id,
      pricingCategory: (result as { pricingCategory?: string }).pricingCategory,
    };
  } catch (err) {
    console.error("[YCloud] Excepción enviando template WhatsApp:", err);
    return { success: false, error: String(err) };
  }
}

/**
 * Genera el mensaje de confirmación de pago para un huésped.
 */
export function buildPaymentConfirmationMessage(opts: {
  guestName: string;
  folioCode: string;
  amount: number;
  method: string;
  balanceDue: number;
  paymentStatus: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
}): string {
  const methodLabels: Record<string, string> = {
    cash: "Efectivo",
    transfer: "Transferencia",
    card: "Tarjeta",
  };

  const methodLabel = methodLabels[opts.method] || opts.method;
  const isLiquidated = opts.paymentStatus === "liquidated";

  let msg = `✅ *Dormitorios Plaza Basílica*\n\n`;
  msg += `Hola *${opts.guestName}*, `;
  msg += isLiquidated
    ? `tu pago ha sido registrado con éxito. ¡Tu reservación está confirmada!\n\n`
    : `hemos recibido un pago parcial de tu reservación.\n\n`;

  msg += `📋 *Folio:* ${opts.folioCode}\n`;
  msg += `💰 *Monto pagado:* $${opts.amount.toFixed(2)} MXN\n`;
  msg += `💳 *Método:* ${methodLabel}\n`;

  if (!isLiquidated && opts.balanceDue > 0) {
    msg += `📊 *Saldo pendiente:* $${opts.balanceDue.toFixed(2)} MXN\n`;
  }

  msg += `\n📅 *Entrada:* ${opts.checkInDate}\n`;
  msg += `📅 *Salida:* ${opts.checkOutDate}\n`;
  msg += `🌙 *Noches:* ${opts.nights}\n`;

  msg += `\nPresenta tu folio en recepción al llegar. ¡Gracias por elegirnos! 🏨`;

  return msg;
}