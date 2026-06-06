import { closeShiftAction, openShiftAction } from "@/actions/operations";
import { Button } from "@/components/ui/button";

type ShiftActionButtonsProps = {
  hasOpenShift: boolean;
  returnTo: string;
};

export function ShiftActionButtons({ hasOpenShift, returnTo }: ShiftActionButtonsProps) {
  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
      <form action={openShiftAction} className="w-full sm:w-auto">
        <input type="hidden" name="return_to" value={returnTo} />
        <Button type="submit" variant="primary" className="w-full sm:w-auto" disabled={hasOpenShift}>
          Inicio de turno
        </Button>
      </form>
      <form action={closeShiftAction} className="w-full sm:w-auto">
        <input type="hidden" name="return_to" value={returnTo} />
        <Button type="submit" variant="outline" className="w-full sm:w-auto" disabled={!hasOpenShift}>
          Fin de turno
        </Button>
      </form>
    </div>
  );
}
