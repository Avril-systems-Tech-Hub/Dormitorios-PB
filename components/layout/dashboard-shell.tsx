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

  const showSidebar = role === "admin" || (modules !== undefined && modules.length > 0);
  const showSidebarNav = showSidebar && role !== "reception";
  const showMobileNav = showSidebar && !(role === "reception" && navGroups.every((g) => g.items.length <= 1));
  const isReception = role === "reception";

  return (
    <div className="dashboard-canvas min-h-screen overflow-x-hidden">
      <header className="dashboard-brand-header safe-area-pt-header sticky top-0 z-30 shadow-sm">
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
              Registrar estancia
            </Link>
            {isReception ? <ReceptionSessionNav /> : null}
            {userName ? (
              <div className="min-w-0 max-w-[9.5rem] text-right sm:max-w-[14rem]">
                <p className="truncate text-xs font-semibold leading-tight text-white sm:text-sm">
                  {userName}
                </p>
                <p className="truncate text-[10px] leading-tight text-white/75 sm:hidden">
                  {roleLabel ?? (role === "admin" ? "Admin" : "Recepción")}
                </p>
              </div>
            ) : (
              <span className="rounded-full bg-mkt-terracotta/90 px-2 py-0.5 text-[10px] font-medium text-white sm:hidden sm:py-1 sm:text-xs">
                {roleLabel ?? (role === "admin" ? "Admin" : "Recepción")}
              </span>
            )}
            <span className="hidden rounded-full bg-mkt-terracotta/90 px-2 py-0.5 text-[10px] font-medium text-white sm:inline sm:py-1 sm:text-xs">
              {roleLabel ?? (role === "admin" ? "Admin" : "Recepción")}
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
      </header>
      {showMobileNav ? <DashboardNavMobileBar groups={navGroups} /> : null}
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
