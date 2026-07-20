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

import { digitsOnly, formatMexicanPhoneE164 } from "@/lib/phone";
import { formatBedLabel } from "@/lib/beds";

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

type YCloudErrorBody = {
  message?: string;
  error?: {
    status?: number;
    code?: string;
    message?: string;
    target?: string;
    whatsappApiError?: {
      message?: string;
      code?: string | number;
    };
  };
};

/** Digits YCloud accepts for `to` / `from` (E.164 without "+"). */
function cleanWhatsAppPhone(phone: string): string {
  const e164 = formatMexicanPhoneE164(phone);
  if (e164) return digitsOnly(e164);
  return digitsOnly(phone);
}

function formatYCloudError(status: number, result: YCloudErrorBody): string {
  const nested = result.error;
  const code = nested?.code;
  const message =
    nested?.message ||
    nested?.whatsappApiError?.message ||
    result.message;
  const waCode = nested?.whatsappApiError?.code;

  if (code && message) {
    return waCode ? `${code}: ${message} (WA ${waCode})` : `${code}: ${message}`;
  }
  if (message) return message;
  if (code) return `${code} (HTTP ${status})`;
  return `HTTP ${status}`;
}

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

  const cleanTo = cleanWhatsAppPhone(toPhone);
  const cleanFrom = cleanWhatsAppPhone(fromPhone);

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

    const result = (await response.json()) as YCloudErrorBody & { id?: string };

    if (!response.ok) {
      console.error("[YCloud] Error enviando WhatsApp:", result);
      return {
        success: false,
        error: formatYCloudError(response.status, result),
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

  const cleanTo = cleanWhatsAppPhone(toPhone);
  const cleanFrom = cleanWhatsAppPhone(fromPhone);

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

    const result = (await response.json()) as YCloudErrorBody & { id?: string };

    if (!response.ok) {
      console.error("[YCloud] Error enviando documento WhatsApp:", result);
      return {
        success: false,
        error: formatYCloudError(response.status, result),
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
 *
 * Si se pasa `documentHeader`, el header del template se envía como tipo DOCUMENT
 * con la URL del PDF y el filename. El template debe tener un header de tipo DOCUMENT
 * configurado en Meta Business Manager.
 */
export async function sendWhatsAppTemplateMessage(
  toPhone: string,
  templateName: string,
  languageCode: string,
  bodyParameters?: string[],
  headerParameters?: string[],
  documentHeader?: { pdfUrl: string; filename: string },
): Promise<YCloudResponse> {
  const apiKey = process.env.YCLOUD_API_KEY;
  const fromPhone = process.env.YCLOUD_FROM_PHONE;

  if (!apiKey || !fromPhone) {
    console.warn(
      "[YCloud] Faltan YCLOUD_API_KEY o YCLOUD_FROM_PHONE. No se enviará WhatsApp.",
    );
    return { success: false, error: "Missing YCloud configuration" };
  }

  const cleanTo = cleanWhatsAppPhone(toPhone);
  const cleanFrom = cleanWhatsAppPhone(fromPhone);

  // Construir componentes: header y body por separado
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const components: Array<any> = [];

  // Header: documento PDF o texto
  if (documentHeader) {
    components.push({
      type: "header",
      parameters: [
        {
          type: "document",
          document: {
            link: documentHeader.pdfUrl,
            filename: documentHeader.filename,
          },
        },
      ],
    });
  } else if (headerParameters?.length) {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {
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

    const result = (await response.json()) as YCloudErrorBody & {
      id?: string;
      pricingCategory?: string;
    };

    if (!response.ok) {
      console.error("[YCloud] Error enviando template WhatsApp:", result);
      return {
        success: false,
        error: formatYCloudError(response.status, result),
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

export type PaymentGuestAssignment = {
  guestName: string;
  bedNumber: string | number;
  bedZone?: string | null;
  lockerNumber?: string | number | null;
  lockerDays?: number;
};

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
  assignments?: PaymentGuestAssignment[];
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

  if (opts.assignments?.length) {
    msg += `\n🛏️ *Asignaciones:*\n`;
    for (const assignment of opts.assignments) {
      msg += `• *${assignment.guestName}*: ${formatBedLabel(assignment.bedNumber, assignment.bedZone) ?? `Cama ${assignment.bedNumber}`}`;
      const lockerDays = Number(assignment.lockerDays ?? 0);
      if (lockerDays > 0) {
        msg += assignment.lockerNumber
          ? ` · Locker ${assignment.lockerNumber} (${lockerDays} día${lockerDays === 1 ? "" : "s"})`
          : ` · Locker pendiente (${lockerDays} día${lockerDays === 1 ? "" : "s"})`;
      }
      msg += `\n`;
    }
  }

  msg += `\nConserva este comprobante. ¡Gracias por elegirnos! 🏨`;

  return msg;
}