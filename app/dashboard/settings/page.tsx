import { ModulePage } from "@/components/layout/module-page";
import { DiscountRulesPanel } from "@/components/dashboard/discount-rules-panel";
import { requireRole } from "@/lib/auth/guards";
import { getAllDiscountRules } from "@/lib/discount-rules";

export default async function SettingsPage() {
  await requireRole(["admin"]);
  const discountRules = await getAllDiscountRules();

  return (
    <ModulePage
      title="Configuración"
      description="Parámetros operativos, usuarios y ajustes de negocio."
    >
      <DiscountRulesPanel initialRules={discountRules} />
    </ModulePage>
  );
}