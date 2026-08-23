import { Suspense } from "react";
import Link from "next/link";
import { groupDashboardLinks, groupModules } from "@/lib/navigation";
import type { UserRole } from "@/types/domain";
import type { SystemModule } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { ReceptionSessionNav } from "@/components/dashboard/reception-session-nav";
import {
  DashboardHeaderTitle,
  DashboardNav,
  DashboardNavMobileBar,
} from "@/components/layout/dashboard-nav";
import { DashboardScrollRestoration } from "@/components/layout/dashboard-scroll-restoration";

export function DashboardShell({
  title,
  role,
  userName,
  roleLabel,
  modules,
  children,
}: {
  title: string;
  role: UserRole;
  userName?: string;
  roleLabel?: string;
  modules?: SystemModule[];
  children: React.ReactNode;
}) {
  const navGroups =
    modules && modules.length > 0 ? groupModules(modules, role) : groupDashboardLinks(role);

  const isReception = role === "reception";
  const primaryNavGroups = isReception
    ? navGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => item.href !== "/dashboard/register-stay"),
        }))
        .filter((group) => group.items.length > 0)
    : navGroups;
  if (
    isReception &&
    !primaryNavGroups.some((group) =>
      group.items.some((item) => item.href === "/dashboard"),
    )
  ) {
    if (primaryNavGroups.length > 0) {
      primaryNavGroups[0] = {
        ...primaryNavGroups[0],
        items: [
          { href: "/dashboard", label: "Inicio" },
          ...primaryNavGroups[0].items,
        ],
      };
    } else {
      primaryNavGroups.push({
        label: "Operación",
        items: [{ href: "/dashboard", label: "Inicio" }],
      });
    }
  }
  const showSidebar = role === "admin" || (modules !== undefined && modules.length > 0);
  const showSidebarNav = showSidebar && role !== "reception";
  const primaryNavItemCount = primaryNavGroups.reduce(
    (count, group) => count + group.items.length,
    0,
  );
  const showPrimaryNav =
    isReception || (showSidebar && primaryNavItemCount > 1);

  return (
    <div className="dashboard-canvas min-h-screen overflow-x-hidden">
      <Suspense fallback={null}>
        <DashboardScrollRestoration />
      </Suspense>
      <div className="sticky top-0 z-30">
        <header className="dashboard-brand-header safe-area-pt-header shadow-sm">
          {isReception ? (
            <div className="mx-auto grid w-full max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:px-4 sm:py-3 lg:flex lg:px-6">
              <div className="min-w-0 lg:flex-1">
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-mkt-terracotta sm:text-xs">
                  Dormitorios Plaza Basílica
                </p>
                <DashboardHeaderTitle fallback={title} branded />
              </div>

              <div className="flex min-w-0 items-center justify-end gap-2 lg:order-3">
                {userName ? (
                  <div className="min-w-0 max-w-[6.5rem] text-right sm:max-w-[12rem]">
                    <p className="truncate text-xs font-semibold leading-tight text-white sm:text-sm">
                      {userName}
                    </p>
                    <p className="truncate text-[10px] leading-tight text-white/70">
                      {roleLabel ?? "Recepción"}
                    </p>
                  </div>
                ) : null}
                <form action="/api/auth/signout" method="post">
                  <Button
                    variant="outline"
                    type="submit"
                    className="h-8 border-white/30 bg-white/10 px-2.5 text-xs text-white hover:bg-white/20 sm:h-9 sm:px-3 sm:text-sm"
                  >
                    Salir
                  </Button>
                </form>
              </div>

              <div className="col-span-2 flex min-w-0 items-center gap-2 lg:order-2 lg:col-span-1">
                <Link
                  href="/dashboard/register-stay"
                  className="inline-flex h-9 min-w-0 flex-1 items-center justify-center rounded-lg bg-mkt-terracotta px-3 text-sm font-semibold text-white transition hover:bg-mkt-terracotta-hover lg:flex-none"
                >
                  Registrar concepto
                </Link>
                <Suspense fallback={null}>
                  <ReceptionSessionNav />
                </Suspense>
              </div>
            </div>
          ) : (
            <div className="flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2.5 sm:px-4 sm:py-3 lg:px-6">
              <div className="min-w-0 flex-1 basis-[12rem]">
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-mkt-terracotta sm:text-xs">
                  Dormitorios Plaza Basílica
                </p>
                <DashboardHeaderTitle fallback={title} branded />
              </div>
              <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                <Link
                  href="/dashboard/register-stay"
                  className="inline-flex h-8 items-center rounded-lg bg-mkt-terracotta px-2.5 text-xs font-semibold text-white transition hover:bg-mkt-terracotta-hover sm:h-9 sm:px-3 sm:text-sm"
                >
                  Registrar concepto
                </Link>
                {userName ? (
                  <div className="min-w-0 max-w-[9.5rem] text-right sm:max-w-[14rem]">
                    <p className="truncate text-xs font-semibold leading-tight text-white sm:text-sm">
                      {userName}
                    </p>
                  </div>
                ) : null}
                <span className="hidden rounded-full bg-mkt-terracotta/90 px-2 py-0.5 text-[10px] font-medium text-white sm:inline sm:py-1 sm:text-xs">
                  {roleLabel ?? "Admin"}
                </span>
                <form action="/api/auth/signout" method="post">
                  <Button
                    variant="outline"
                    type="submit"
                    className="h-8 border-white/30 bg-white/10 px-2.5 text-xs text-white hover:bg-white/20 sm:h-9 sm:px-3 sm:text-sm"
                  >
                    Salir
                  </Button>
                </form>
              </div>
            </div>
          )}
        </header>
        {showPrimaryNav ? (
          <DashboardNavMobileBar groups={primaryNavGroups} persistent={isReception} />
        ) : null}
      </div>
      <div
        className={`w-full gap-4 px-3 py-3 sm:px-4 sm:py-4 lg:px-6 ${
          showSidebarNav ? "grid md:grid-cols-[240px_minmax(0,1fr)]" : ""
        }`}
      >
        {showSidebarNav ? (
          <aside className="hidden shrink-0 rounded-xl border border-brand-primary/15 bg-white/95 p-3 shadow-sm shadow-brand-primary/5 backdrop-blur-sm md:block md:sticky md:top-[4.25rem] md:self-start">
            <DashboardNav groups={navGroups} />
          </aside>
        ) : null}
        <main
          className={`safe-area-pb-footer min-w-0 space-y-4 ${
            isReception ? "mx-auto w-full max-w-6xl lg:max-w-7xl" : ""
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
