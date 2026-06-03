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

export function DashboardNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-4">
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
                  <Link
                    href={item.href}
                    className={cn(
                      "block rounded-lg border-l-2 border-transparent px-3 py-2 text-sm text-text-main hover:bg-surface-soft",
                      active && "border-brand-primary bg-surface-soft font-medium",
                    )}
                  >
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
    <h1 className={cn("text-lg font-semibold", branded ? "text-white" : "text-text-main")}>
      {title}
    </h1>
  );
}
