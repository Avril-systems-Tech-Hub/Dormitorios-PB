"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteVisitorSaleAction } from "@/actions/visitor-sales";
import { Button } from "@/components/ui/button";
import { VISITOR_CONCEPT_LABELS, type VisitorConcept } from "@/lib/visitor-sales";
import { isNextRedirect } from "@/lib/utils";

type VisitorSaleDeleteButtonProps = {
  saleId: string;
  concept: VisitorConcept;
  visitorName: string | null;
  resourceNumber: string;
  amount: number;
};

export function VisitorSaleDeleteButton({
  saleId,
  concept,
  visitorName,
  resourceNumber,
  amount,
}: VisitorSaleDeleteButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const conceptLabel = VISITOR_CONCEPT_LABELS[concept];
  const name = visitorName?.trim() || "Invitado";

  return (
    <Button
      type="button"
      variant="danger"
      className="h-8 px-3 text-xs"
      disabled={isPending}
      onClick={() => {
        if (
          !confirm(
            `¿Eliminar el cobro de ${conceptLabel.toLowerCase()} ${resourceNumber} de ${name} ($${amount.toFixed(2)})?\n\nSe borrará de la base de datos y dejará de contar en los ingresos. No se puede deshacer.`,
          )
        ) {
          return;
        }

        startTransition(async () => {
          try {
            const formData = new FormData();
            formData.set("sale_id", saleId);
            formData.set("concept", concept);
            const result = await deleteVisitorSaleAction(formData);
            if (!result.ok) {
              toast.error(result.message);
              return;
            }
            toast.success(result.message);
            router.refresh();
          } catch (error) {
            if (isNextRedirect(error)) throw error;
            toast.error(
              error instanceof Error
                ? error.message
                : "No se pudo eliminar el cobro. Intenta de nuevo.",
            );
          }
        });
      }}
    >
      {isPending ? "Eliminando…" : "Eliminar"}
    </Button>
  );
}
