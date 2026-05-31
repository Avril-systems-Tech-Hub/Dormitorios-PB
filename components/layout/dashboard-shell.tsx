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
    <div className="min-h-screen overflow-x-hidden bg-surface">
      <header className="sticky top-0 z-30 border-b border-border-soft bg-white/95 backdrop-blur">
        <div className="flex w-full items-center justify-between px-4 py-3 lg:px-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-text-muted">
              Dormitorios Plaza Basílica
            </p>
            <DashboardHeaderTitle fallback={title} />
          </div>
          <div className="flex items-center gap-2">
            {userName && (
              <span className="text-sm font-medium text-text-main">
                {userName}
              </span>
            )}
            <span className="rounded-full bg-surface-soft px-2 py-1 text-xs text-text-main">
              {roleLabel ?? (role === "admin" ? "Admin" : "Recepción")}
            </span>
            <form action="/api/auth/signout" method="post">
              <Button variant="outline" type="submit">
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
          <aside className="shrink-0 rounded-xl border border-border-soft bg-white p-3 md:sticky md:top-[4.25rem] md:self-start">
            <DashboardNav groups={navGroups} />
          </aside>
        ) : null}
        <main className="min-w-0 space-y-4">{children}</main>
      </div>
    </div>
  );
}
