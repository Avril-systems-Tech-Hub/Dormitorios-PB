import { ModulePage } from "@/components/layout/module-page";
import { requireRole } from "@/lib/auth/guards";

export default async function SettingsPage() {
  await requireRole(["admin"]);

  return (
    <ModulePage
      title="Configuración"
      description="Parámetros operativos, usuarios y ajustes de negocio."
    />
  );
}
