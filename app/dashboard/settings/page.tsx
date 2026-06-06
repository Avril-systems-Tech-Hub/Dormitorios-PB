import { ModulePage } from "@/components/layout/module-page";
import { DiscountRulesPanel } from "@/components/dashboard/discount-rules-panel";
import { PromoCodesPanel } from "@/components/dashboard/promo-codes-panel";
import { PromotionsSummaryPanel } from "@/components/dashboard/promotions-summary-panel";
import { requireRole } from "@/lib/auth/guards";
import { getAllDiscountRules } from "@/lib/discount-rules";
import { getAllPromoCodes } from "@/lib/promo-codes";

export default async function SettingsPage() {
  await requireRole(["admin"]);
  const discountRules = await getAllDiscountRules();
  const promoCodes = await getAllPromoCodes();

  return (
    <ModulePage
      title="Configuración"
      description="Parámetros operativos, usuarios y ajustes de negocio."
    >
      <div className="space-y-8">
        <PromotionsSummaryPanel initialCodes={promoCodes} initialRules={discountRules} />
        <PromoCodesPanel initialCodes={promoCodes} />
        <DiscountRulesPanel initialRules={discountRules} />
      </div>
    </ModulePage>
  );
}
