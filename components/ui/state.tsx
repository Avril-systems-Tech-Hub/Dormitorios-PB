import { Card } from "@/components/ui/card";

export function LoadingState({ label = "Cargando..." }: { label?: string }) {
  return (
    <Card className="animate-pulse text-sm text-text-muted">
      <p>{label}</p>
    </Card>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card>
      <p className="text-base font-semibold text-text-main">{title}</p>
      <p className="mt-1 text-sm text-text-muted">{description}</p>
    </Card>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <Card className="border-danger/30 bg-danger/5">
      <p className="text-sm font-medium text-danger">Error: {message}</p>
    </Card>
  );
}
