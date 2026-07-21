"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteExpenseAction } from "@/actions/operations";
import { Button } from "@/components/ui/button";

export function ExpenseDeleteButton({
  movementId,
  concept,
  amount,
}: {
  movementId: string;
  concept: string;
  amount: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="danger"
      className="h-8 px-3 text-xs"
      disabled={isPending}
      onClick={() => {
        if (
          !window.confirm(
            `¿Eliminar definitivamente este egreso?\n\n${concept}\n$${amount.toFixed(2)} MXN\n\nSe quitará de todas las sumas y no se puede deshacer.`,
          )
        ) {
          return;
        }

        startTransition(async () => {
          const formData = new FormData();
          formData.set("movement_id", movementId);
          const result = await deleteExpenseAction(formData);
          if (result.status === "error") {
            toast.error(result.message);
            return;
          }
          if (result.status === "partial") {
            toast.warning(result.message);
          } else {
            toast.success(result.message);
          }
          router.refresh();
        });
      }}
    >
      {isPending ? "Eliminando…" : "Eliminar"}
    </Button>
  );
}

