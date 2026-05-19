"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

export function ActionToast() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastToastKey = useRef<string | null>(null);

  useEffect(() => {
    // Guest reservation flow shows an inline confirmation page instead of a toast.
    if (searchParams.get("confirmed") === "1") return;

    const status = searchParams.get("status");
    const message = searchParams.get("message");
    if (!status || !message) return;

    const toastKey = `${status}:${message}`;
    if (lastToastKey.current === toastKey) return;
    lastToastKey.current = toastKey;

    if (status === "success") {
      toast.success(message);
    } else {
      toast.error(message);
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("status");
    nextParams.delete("message");
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  return null;
}
