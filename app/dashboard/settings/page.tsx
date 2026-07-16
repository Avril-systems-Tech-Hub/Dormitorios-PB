import { ModulePage } from "@/components/layout/module-page";
import { DiscountRulesPanel } from "@/components/dashboard/discount-rules-panel";
import { PromoCodesPanel } from "@/components/dashboard/promo-codes-panel";
import { PromotionsSummaryPanel } from "@/components/dashboard/promotions-summary-panel";
import { CreateUserPanel } from "@/components/dashboard/create-user-panel";
import { requireRole } from "@/lib/auth/guards";
import { getAllRoles } from "@/lib/auth/permissions";
import { getAllDiscountRules } from "@/lib/discount-rules";
import { getAllPromoCodes } from "@/lib/promo-codes";

export default async function SettingsPage() {
  await requireRole(["admin"]);
  const discountRules = await getAllDiscountRules();
  const promoCodes = await getAllPromoCodes();
  const roles = await getAllRoles();
  const roleOptions = roles.map((role) => ({
    id: role.id,
    name: role.name,
    label: role.label,
  }));

  return (
    <ModulePage
      title="Configuración"
      description="Parámetros operativos, usuarios y ajustes de negocio."
    >
      <div className="space-y-8">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-text-main">Accesos del personal</h2>
          <CreateUserPanel roles={roleOptions} returnTo="/dashboard/settings" />
        </section>
        <PromotionsSummaryPanel initialCodes={promoCodes} initialRules={discountRules} />
        <PromoCodesPanel initialCodes={promoCodes} />
        <DiscountRulesPanel initialRules={discountRules} />
      </div>
    </ModulePage>
  );
}
