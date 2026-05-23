import Link from "next/link";
import { getDashboardLinks } from "@/lib/navigation";
import type { UserRole } from "@/types/domain";
import type { SystemModule } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";

type DashboardLink = {
  href: string;
  label: string;
};

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
  // Si hay módulos dinámicos del RBAC, usar esos; si no, fallback al estático
  const links: DashboardLink[] = modules?.length
    ? modules.map((m) => ({ href: m.href, label: m.label }))
    : getDashboardLinks(role);

  const showSidebar = role === "admin" || (modules !== undefined && modules.length > 0);

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-30 border-b border-border-soft bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-text-muted">
              Dormitorios Plaza Basílica
            </p>
            <h1 className="text-lg font-semibold text-text-main">{title}</h1>
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
      <div className={`mx-auto max-w-7xl gap-4 px-4 py-4 ${showSidebar ? "grid md:grid-cols-[220px_1fr]" : ""}`}>
        {showSidebar ? (
          <aside className="overflow-x-auto rounded-xl border border-border-soft bg-white p-2">
            <nav className="flex gap-2 md:flex-col">
              {links.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-3 py-2 text-sm text-text-main hover:bg-surface-soft"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>
        ) : null}
        <main className="space-y-4">{children}</main>
      </div>
    </div>
  );
}