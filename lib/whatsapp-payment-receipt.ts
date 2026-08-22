import { createAdminClient } from "@/lib/supabase/admin";
import {
  generateWhatsAppReservationPdf,
  type WhatsAppReservationPdfData,
} from "@/lib/whatsapp-reservation-pdf";
import {
  buildPaymentConfirmationMessage,
  sendWhatsAppTemplateMessage,
  sendWhatsAppTextMessage,
  type PaymentGuestAssignment,
} from "@/lib/ycloud";

export async function deliverWhatsAppReservationReceipt(input: {
  guestPhone: string;
  guestName: string;
  pdf: WhatsAppReservationPdfData;
  fallback?: {
    folioCode: string;
    amount: number;
    method: string;
    balanceDue: number;
    paymentStatus: string;
    checkInDate: string;
    checkOutDate: string;
    nights: number;
    assignments?: PaymentGuestAssignment[];
  };
}): Promise<{ success: boolean; error?: string; messageId?: string; pricingCategory?: string }> {
  const supabase = createAdminClient();
  const pdfBytes = await generateWhatsAppReservationPdf(input.pdf);
  const bucketName = "whatsapp-pdfs";
  await supabase.storage.createBucket(bucketName, { public: true }).catch(() => {});
  const pdfFileName = `reserva-${input.pdf.folioCode}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(pdfFileName, pdfBytes, { contentType: "application/pdf", upsert: true });

  if (!uploadError) {
    const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(pdfFileName);
    return sendWhatsAppTemplateMessage(
      input.guestPhone,
      process.env.YCLOUD_TEMPLATE_NAME || "payment_confirmation",
      process.env.YCLOUD_TEMPLATE_LANGUAGE || "es",
      [input.guestName, input.pdf.folioCode, `$${input.pdf.totalAmount.toFixed(2)} MXN`],
      undefined,
      {
        pdfUrl: publicUrlData.publicUrl,
        filename: `Confirmacion_${input.pdf.folioCode}.pdf`,
      },
    );
  }

  console.error("[deliverWhatsAppReservationReceipt] Error subiendo PDF:", uploadError);
  if (input.fallback) {
    return sendWhatsAppTextMessage(
      input.guestPhone,
      buildPaymentConfirmationMessage({
        guestName: input.guestName,
        folioCode: input.fallback.folioCode,
        amount: input.fallback.amount,
        method: input.fallback.method,
        balanceDue: input.fallback.balanceDue,
        paymentStatus: input.fallback.paymentStatus,
        checkInDate: input.fallback.checkInDate,
        checkOutDate: input.fallback.checkOutDate,
        nights: input.fallback.nights,
        assignments: input.fallback.assignments,
      }),
    );
  }

  return { success: false, error: uploadError.message };
}
