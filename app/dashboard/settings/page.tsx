import Link from "next/link";
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
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-text-main">Accesos del personal</h2>
            <Link
              href="/dashboard/users"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-border-soft bg-white px-4 py-2 text-sm font-medium text-text-main transition-colors hover:bg-surface-soft"
            >
              Administrar usuarios y contraseñas
            </Link>
          </div>
          <CreateUserPanel roles={roleOptions} returnTo="/dashboard/settings" />
        </section>
        <PromotionsSummaryPanel initialCodes={promoCodes} initialRules={discountRules} />
        <PromoCodesPanel initialCodes={promoCodes} />
        <DiscountRulesPanel initialRules={discountRules} />
      </div>
    </ModulePage>
  );
}
