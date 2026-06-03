import { groupDashboardLinks, groupModules } from "@/lib/navigation";
import type { UserRole } from "@/types/domain";
import type { SystemModule } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { DashboardHeaderTitle, DashboardNav } from "@/components/layout/dashboard-nav";

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
    modules && modules.length > 0 ? groupModules(modules) : groupDashboardLinks(role);

  const showSidebar = role === "admin" || (modules !== undefined && modules.length > 0);

  return (
    <div className="dashboard-canvas min-h-screen overflow-x-hidden">
      <header className="dashboard-brand-header sticky top-0 z-30 border-b border-white/10 shadow-sm shadow-black/10">
        <div className="flex w-full items-center justify-between px-4 py-3 lg:px-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/70">
              Dormitorios Plaza Basílica
            </p>
            <DashboardHeaderTitle fallback={title} branded />
          </div>
          <div className="flex items-center gap-2">
            {userName && (
              <span className="text-sm font-medium text-white">
                {userName}
              </span>
            )}
            <span className="rounded-full bg-white/15 px-2 py-1 text-xs text-white">
              {roleLabel ?? (role === "admin" ? "Admin" : "Recepción")}
            </span>
            <form action="/api/auth/signout" method="post">
              <Button
                variant="outline"
                type="submit"
                className="border-white/30 bg-white/10 text-white hover:bg-white/20"
              >
                Salir
              </Button>
            </form>
          </div>
        </div>
      </header>
      <div
        className={`w-full gap-4 px-4 py-4 lg:px-6 ${
          showSidebar ? "grid md:grid-cols-[240px_minmax(0,1fr)]" : ""
        }`}
      >
        {showSidebar ? (
          <aside className="shrink-0 rounded-xl border border-brand-primary/15 bg-white/95 p-3 shadow-sm shadow-brand-primary/5 backdrop-blur-sm md:sticky md:top-[4.25rem] md:self-start">
            <DashboardNav groups={navGroups} />
          </aside>
        ) : null}
        <main className="min-w-0 space-y-4">{children}</main>
      </div>
    </div>
  );
}
