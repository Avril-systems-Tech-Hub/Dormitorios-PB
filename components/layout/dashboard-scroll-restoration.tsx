"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { readRouteScroll, routeScrollKey, saveRouteScroll } from "@/lib/route-scroll";

function applyScrollY(y: number) {
  const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  window.scrollTo({ top: Math.min(y, maxY), left: 0, behavior: "auto" });
}

export function DashboardScrollRestoration() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const yRef = useRef(0);

  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  useLayoutEffect(() => {
    const key = routeScrollKey(pathname, search);
    const saved = readRouteScroll(key);
    yRef.current = saved ?? window.scrollY;

    let cancelled = false;
    let userMoved = false;
    let ignoreScrollEvent = false;
    let zeroTimer: number | null = null;
    const restoreTimers: number[] = [];

    const markProgrammatic = () => {
      ignoreScrollEvent = true;
      window.requestAnimationFrame(() => {
        ignoreScrollEvent = false;
      });
    };

    const applySaved = () => {
      if (cancelled || userMoved || saved == null) return;
      markProgrammatic();
      applyScrollY(saved);
    };

    if (saved != null) {
      applySaved();
      restoreTimers.push(window.setTimeout(applySaved, 0));
      window.requestAnimationFrame(applySaved);
    }

    const persist = (y: number) => {
      yRef.current = y;
      saveRouteScroll(key, y);
    };

    const stopRestore = () => {
      userMoved = true;
    };

    const onScroll = () => {
      if (cancelled || ignoreScrollEvent) return;
      const y = window.scrollY;
      if (y === 0 && yRef.current > 0) {
        if (zeroTimer != null) window.clearTimeout(zeroTimer);
        zeroTimer = window.setTimeout(() => persist(0), 80);
        return;
      }
      if (zeroTimer != null) {
        window.clearTimeout(zeroTimer);
        zeroTimer = null;
      }
      persist(y);
    };

    const onPageHide = () => persist(yRef.current);

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointerdown", stopRestore, { capture: true, passive: true });
    window.addEventListener("wheel", stopRestore, { passive: true });
    window.addEventListener("keydown", stopRestore);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      cancelled = true;
      if (zeroTimer != null) window.clearTimeout(zeroTimer);
      for (const id of restoreTimers) window.clearTimeout(id);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointerdown", stopRestore, true);
      window.removeEventListener("wheel", stopRestore);
      window.removeEventListener("keydown", stopRestore);
      window.removeEventListener("pagehide", onPageHide);
      saveRouteScroll(key, yRef.current);
    };
  }, [pathname, search]);

  return null;
}
