import { Button } from "@/components/ui/button";

export function Modal({
  open,
  title,
  description,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  onClose?: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-lg">
        <h3 className="text-lg font-semibold text-text-main">{title}</h3>
        <p className="mt-2 text-sm text-text-muted">{description}</p>
        <div className="mt-4 flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}
