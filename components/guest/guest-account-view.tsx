"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { GuestAccountData } from "@/actions/guest-reservations";
import type { GuestPointsSummary } from "@/actions/guest-points";
import { guestLogoutAction } from "@/actions/guest-auth";
import { GuestHistoryDetail, GuestStatsCell } from "@/components/dashboard/guest-history-detail";
import { GuestPointsCard } from "@/components/guest/guest-points-card";
import { useWaaP } from "@/components/guest/waap-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function GuestAccountView({
  account,
  points,
}: {
  account: GuestAccountData;
  points: GuestPointsSummary | null;
}) {
  const router = useRouter();
  const { logout } = useWaaP();
  const [isPending, startTransition] = useTransition();
  const latest = account.stays[0];

  const handleLogout = () => {
    startTransition(async () => {
      await guestLogoutAction();
      await logout();
      router.push("/login");
      router.refresh();
    });
  };

  const reservationEmail = account.guest.email;
  const accessEmail = account.loginEmail;
  const showAccessEmail =
    accessEmail && reservationEmail && accessEmail.toLowerCase() !== reservationEmail.toLowerCase();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-text-main">Hola, {account.guest.full_name}</h1>
            <p className="mt-1 text-sm text-text-muted">{account.guest.phone}</p>
            {reservationEmail ? (
              <p className="text-sm text-text-muted">
                <span className="text-text-muted/80">Correo en reservas: </span>
                {reservationEmail}
              </p>
            ) : null}
            {showAccessEmail ? (
              <p className="text-sm text-text-muted">
                <span className="text-text-muted/80">Acceso con: </span>
                {accessEmail}
              </p>
            ) : null}
          </div>
          <Button type="button" variant="outline" disabled={isPending} onClick={handleLogout}>
            {isPending ? "Saliendo…" : "Cerrar sesión"}
          </Button>
        </div>
      </Card>

      {points ? <GuestPointsCard points={points} /> : null}

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-text-main">Mis reservas</h2>
          <Link
            href="/"
            className="text-sm font-medium text-brand-primary hover:underline"
          >
            Hacer nueva reserva
          </Link>
        </div>

        {account.stays.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-soft px-4 py-8 text-center">
            <p className="text-sm text-text-muted">Aún no tienes reservas registradas con este teléfono.</p>
            <Link href="/" className="mt-3 inline-block text-sm font-semibold text-brand-primary hover:underline">
              Reservar ahora
            </Link>
          </div>
        ) : latest ? (
          <>
            <GuestStatsCell
              stayCount={account.stays.length}
              totalNights={account.stays.reduce((sum, stay) => sum + stay.nights, 0)}
              paymentStatus={latest.paymentStatus}
              source={latest.source ?? "guest_app"}
            />

            <div className="rounded-lg border border-border-soft p-4">
              <div className="mb-2 flex items-center gap-2">
                <p className="text-sm font-semibold text-text-main">Próxima / más reciente</p>
                {latest.paymentStatus ? (
                  <Badge variant={latest.paymentStatus === "liquidated" ? "success" : "warning"}>
                    {latest.paymentStatus}
                  </Badge>
                ) : null}
              </div>
              <GuestHistoryDetail stays={account.stays} latest={latest} />
            </div>

            {account.stays.length > 1 ? (
              <ul className="space-y-3">
                {account.stays.slice(1).map((stay) => (
                  <li
                    key={`${stay.checkIn}-${stay.checkOut}-${stay.bedNumber ?? "x"}`}
                    className="rounded-lg border border-border-soft px-4 py-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-text-main">
                        {stay.checkIn} → {stay.checkOut}
                      </span>
                      {stay.paymentStatus ? (
                        <Badge variant={stay.paymentStatus === "liquidated" ? "success" : "warning"}>
                          {stay.paymentStatus}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-text-muted">
                      {stay.nights} noche{stay.nights === 1 ? "" : "s"}
                      {stay.bedNumber != null ? ` · Cama ${stay.bedNumber}` : ""}
                      {stay.folioCode ? ` · ${stay.folioCode}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}
      </Card>
    </div>
  );
}
