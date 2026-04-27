import Link from "next/link";
import { getDashboardLinks } from "@/lib/navigation";
import type { UserRole } from "@/types/domain";
import { Button } from "@/components/ui/button";

export function DashboardShell({
  title,
  role,
  children,
}: {
  title: string;
  role: UserRole;
  children: React.ReactNode;
}) {
  const links = getDashboardLinks(role);
  const isReception = role === "reception";

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
            <span className="rounded-full bg-surface-soft px-2 py-1 text-xs text-text-main">
              {role === "admin" ? "Admin" : "Recepción"}
            </span>
            <form action="/api/auth/signout" method="post">
              <Button variant="outline" type="submit">
                Salir
              </Button>
            </form>
          </div>
        </div>
      </header>
      <div className={`mx-auto max-w-7xl gap-4 px-4 py-4 ${isReception ? "" : "grid md:grid-cols-[220px_1fr]"}`}>
        {isReception ? null : (
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
        )}
        <main className="space-y-4">{children}</main>
      </div>
    </div>
  );
}
