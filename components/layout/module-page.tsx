import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/state";

export function ModulePage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <>
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-text-main">{title}</h2>
            <p className="mt-1 text-sm text-text-muted">{description}</p>
          </div>
          <Badge variant="success">Etapa 1</Badge>
        </div>
      </Card>
      {children ?? (
        <EmptyState
          title="Módulo base listo"
          description="Esta pantalla ya está conectada al layout, navegación y permisos base."
        />
      )}
    </>
  );
}