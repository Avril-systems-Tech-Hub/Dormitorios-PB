"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { LogoMark } from "./logo-mark";

const nav = [
  { href: "#reserva", label: "Reservar" },
  { href: "#camas", label: "Camas" },
  { href: "#asi-somos", label: "Así somos" },
  { href: "#servicios", label: "Servicios" },
  { href: "#opiniones", label: "Opiniones" },
  { href: "#ubicacion", label: "Ubicación" },
] as const;

export function LandingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-mkt-border/80 bg-mkt-card/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
        <a href="#" className="flex min-w-0 items-center gap-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mkt-terracotta md:gap-3">
          <span className="relative hidden h-10 w-10 shrink-0 sm:block">
            <Image src="/logo-dorm.png" alt="Dormitorios Plaza Basílica" fill className="rounded-full object-cover" sizes="40px" />
          </span>
          <span className="sm:hidden">
            <LogoMark className="h-9 w-9 shrink-0" />
          </span>
          <span className="min-w-0 text-left">
            <span className="block truncate text-xs font-semibold tracking-[0.18em] text-mkt-chocolate md:text-sm">
              DORMITORIOS
            </span>
            <span className="block truncate text-sm font-semibold text-mkt-ink md:text-base">Plaza Basílica</span>
            <span className="hidden text-[11px] text-mkt-ink-muted sm:block">Renta de camas por noche</span>
          </span>
        </a>

        <nav className="hidden items-center gap-5 text-sm font-medium text-mkt-ink md:flex" aria-label="Principal">
          {nav.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="rounded-md px-1 py-0.5 transition hover:text-mkt-terracotta focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mkt-terracotta"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="inline-flex h-10 items-center justify-center rounded-full bg-mkt-slate px-4 text-sm font-medium text-white transition hover:bg-mkt-slate-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mkt-terracotta md:px-5"
          >
            Entrar
          </Link>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-mkt-border bg-mkt-canvas-elevated text-mkt-ink md:hidden"
            aria-expanded={open}
            aria-controls="landing-mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="sr-only">{open ? "Cerrar menú" : "Abrir menú"}</span>
            <span className="flex flex-col gap-1.5" aria-hidden>
              <span className={`block h-0.5 w-5 rounded-full bg-mkt-ink transition ${open ? "translate-y-2 rotate-45" : ""}`} />
              <span className={`block h-0.5 w-5 rounded-full bg-mkt-ink transition ${open ? "opacity-0" : ""}`} />
              <span className={`block h-0.5 w-5 rounded-full bg-mkt-ink transition ${open ? "-translate-y-2 -rotate-45" : ""}`} />
            </span>
          </button>
        </div>
      </div>

      <div
        id="landing-mobile-nav"
        className={`border-t border-mkt-border bg-mkt-card px-4 py-3 md:hidden ${open ? "block" : "hidden"}`}
      >
        <nav className="flex flex-col gap-1 text-sm font-medium text-mkt-ink" aria-label="Móvil">
          {nav.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="rounded-lg px-3 py-2.5 hover:bg-mkt-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mkt-terracotta"
              onClick={() => setOpen(false)}
            >
              {label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
