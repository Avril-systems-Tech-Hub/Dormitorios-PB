"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { deleteGuestAction } from "@/actions/operations";
import { Button } from "@/components/ui/button";
import { isNextRedirect } from "@/lib/utils";

type GuestDeleteButtonProps = {
  guestId: string;
  guestName: string;
  stayCount: number;
  returnTo?: string;
};

export function GuestDeleteButton({
  guestId,
  guestName,
  stayCount,
  returnTo = "/dashboard/guests",
}: GuestDeleteButtonProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="danger"
      className="h-8 px-3 text-xs"
      disabled={isPending}
      onClick={() => {
        const stayLabel =
          stayCount === 1 ? "1 estadía" : `${stayCount} estadías`;
        if (
          !confirm(
            `¿Eliminar a ${guestName}?\n\nSe borrará el huésped y sus ${stayLabel}, folios y pagos. Esto afecta las sumas del dashboard y no se puede deshacer.`,
          )
        ) {
          return;
        }

        startTransition(async () => {
          try {
            const formData = new FormData();
            formData.set("guest_id", guestId);
            formData.set("return_to", returnTo);
            await deleteGuestAction(formData);
          } catch (error) {
            if (isNextRedirect(error)) throw error;
            toast.error(
              error instanceof Error
                ? error.message
                : "No se pudo eliminar el huésped. Intenta de nuevo.",
            );
          }
        });
      }}
    >
      {isPending ? "Eliminando…" : "Eliminar"}
    </Button>
  );
}
