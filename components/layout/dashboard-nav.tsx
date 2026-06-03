"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getPageTitle, type NavGroup } from "@/lib/navigation";
import { cn } from "@/lib/utils";

function isActiveLink(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function navLinkClass(active: boolean) {
  return cn(
    "block rounded-lg border-l-2 border-transparent px-3 py-2 text-sm text-text-main hover:bg-surface-soft",
    active && "border-brand-primary bg-surface-soft font-medium",
  );
}

function navPillClass(active: boolean) {
  return cn(
    "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition",
    active
      ? "border-brand-primary bg-brand-primary text-white shadow-sm"
      : "border-border-soft bg-white text-text-main hover:border-brand-primary/40",
  );
}

export function DashboardNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-4" aria-label="Navegación del panel">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-1 px-3 text-xs font-medium uppercase tracking-wide text-text-muted">
            {group.label}
          </p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = isActiveLink(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link href={item.href} className={navLinkClass(active)}>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Sticky horizontal nav for phones — desktop sidebar stays in the aside. */
export function DashboardNavMobileBar({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const items = groups.flatMap((group) => group.items);

  return (
    <nav
      className="dashboard-nav-mobile sticky z-20 border-b border-brand-primary/10 bg-white/95 px-3 py-2 shadow-sm shadow-brand-primary/5 backdrop-blur-sm md:hidden"
      aria-label="Accesos rápidos"
    >
      <div className="flex gap-2 overflow-x-auto overscroll-x-contain pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const active = isActiveLink(pathname, item.href);
          return (
            <Link key={item.href} href={item.href} className={navPillClass(active)}>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function DashboardHeaderTitle({
  fallback,
  branded = false,
}: {
  fallback: string;
  branded?: boolean;
}) {
  const pathname = usePathname();
  const title = getPageTitle(pathname, fallback);

  return (
    <h1
      className={cn(
        "truncate text-base font-semibold sm:text-lg",
        branded ? "text-white" : "text-text-main",
      )}
    >
      {title}
    </h1>
  );
}
