"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  establishGuestSessionAction,
  guestLogoutAction,
  linkGuestReservationAction,
} from "@/actions/guest-auth";
import { MexicanPhoneInput } from "@/components/guest/mexican-phone-input";
import { useWaaP } from "@/components/guest/waap-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { isCompleteMexicanPhone, MEXICO_PHONE_PREFIX } from "@/lib/phone";

type Mode = "guest" | "staff";
type GuestStep = "login" | "reservation-link";

export function UnifiedLoginView({
  staffError,
  initialMode = "guest",
}: {
  staffError?: string;
  initialMode?: Mode;
}) {
  const router = useRouter();
  const { ready, isConnecting, error, login, fetchLoginEmail, logout, clearError } = useWaaP();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [guestStep, setGuestStep] = useState<GuestStep>("login");
  const [pendingAddress, setPendingAddress] = useState<string | null>(null);
  const [pendingLoginEmail, setPendingLoginEmail] = useState<string | null>(null);
  const [reservationEmail, setReservationEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const goToAccount = () => {
    router.push("/cuenta");
    router.refresh();
  };

  const handleGuestLogin = () => {
    clearError();
    setFormError(null);

    startTransition(async () => {
      const connectedAddress = await login();
      if (!connectedAddress) return;

      const loginEmail = await fetchLoginEmail();
      const result = await establishGuestSessionAction(connectedAddress, loginEmail);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }

      if ("step" in result && result.step === "reservation-link") {
        setPendingAddress(connectedAddress);
        setPendingLoginEmail(result.loginEmail);
        setReservationEmail(result.loginEmail ?? "");
        setGuestStep("reservation-link");
        return;
      }

      goToAccount();
    });
  };

  const handleLinkReservation = () => {
    if (!pendingAddress) return;
    setFormError(null);

    startTransition(async () => {
      const result = await linkGuestReservationAction(
        pendingAddress,
        reservationEmail,
        phone,
        pendingLoginEmail,
      );
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      goToAccount();
    });
  };

  const handleCancelLink = () => {
    startTransition(async () => {
      await guestLogoutAction();
      await logout();
      setGuestStep("login");
      setPendingAddress(null);
      setPendingLoginEmail(null);
      setReservationEmail("");
      setPhone("");
    });
  };

  const switchToStaff = () => {
    clearError();
    setFormError(null);
    setMode("staff");
  };

  const switchToGuest = () => {
    setFormError(null);
    setMode("guest");
  };

  if (mode === "staff") {
    return (
      <Card className="w-full max-w-sm space-y-4">
        <div className="space-y-2 text-center">
          <Image
            src="/logo-dorm.png"
            alt="Dormitorios Plaza Basílica"
            width={72}
            height={72}
            className="mx-auto rounded-md"
          />
          <h1 className="text-xl font-semibold">Acceso operativo</h1>
          <p className="text-sm text-text-muted">Inicia sesión para continuar</p>
        </div>

        <form action="/api/auth/login" method="post" className="space-y-3">
          <Input name="email" placeholder="Correo" type="email" required />
          <Input name="password" placeholder="Contraseña" type="password" required />
          {staffError ? <p className="text-sm text-danger">{staffError}</p> : null}
          <Button className="w-full" type="submit">
            Entrar
          </Button>
        </form>

        <Button className="w-full" type="button" variant="ghost" onClick={switchToGuest}>
          Volver
        </Button>
      </Card>
    );
  }

  if (guestStep === "reservation-link" && pendingAddress) {
    return (
      <Card className="w-full max-w-sm space-y-4">
        <div className="space-y-2 text-center">
          <Image
            src="/logo-dorm.png"
            alt="Dormitorios Plaza Basílica"
            width={72}
            height={72}
            className="mx-auto rounded-md"
          />
          <h1 className="text-xl font-semibold">Vincula tu reserva</h1>
          <p className="text-sm text-text-muted">
            {pendingLoginEmail
              ? `Iniciaste sesión con ${pendingLoginEmail}. Confirma el correo y teléfono que usaste al reservar.`
              : "Confirma el correo y teléfono que usaste al reservar para ver tu cuenta."}
          </p>
        </div>

        <div className="space-y-3">
          <Input
            name="reservationEmail"
            placeholder="Correo de la reserva"
            type="email"
            autoComplete="email"
            value={reservationEmail}
            onChange={(event) => setReservationEmail(event.target.value)}
            required
          />
          <MexicanPhoneInput
            name="phone"
            value={phone}
            onChange={setPhone}
            required
          />
          <p className="text-xs text-text-muted">
            Escribe solo los 10 dígitos de tu celular (ej. 5512345678). El prefijo {MEXICO_PHONE_PREFIX}{" "}
            ya está incluido.
          </p>
          {formError ? <p className="text-sm text-danger">{formError}</p> : null}
          <Button
            className="w-full"
            type="button"
            disabled={
              isPending || reservationEmail.trim().length < 5 || !isCompleteMexicanPhone(phone)
            }
            onClick={handleLinkReservation}
          >
            {isPending ? "Vinculando…" : "Continuar"}
          </Button>
          <Button className="w-full" type="button" variant="ghost" onClick={handleCancelLink}>
            Cancelar
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm space-y-4">
      <div className="space-y-2 text-center">
        <Image
          src="/logo-dorm.png"
          alt="Dormitorios Plaza Basílica"
          width={72}
          height={72}
          className="mx-auto rounded-md"
        />
        <h1 className="text-xl font-semibold">Ingreso</h1>
        <p className="text-sm text-text-muted">
          Inicia sesión para ver tus reservas y administrar tu perfil.
        </p>
      </div>

      {error || formError ? (
        <p className="text-sm text-danger">{error ?? formError}</p>
      ) : null}

      <Button
        className="w-full"
        type="button"
        disabled={!ready || isConnecting || isPending}
        onClick={handleGuestLogin}
      >
        {!ready
          ? "Cargando…"
          : isConnecting || isPending
            ? "Iniciando sesión…"
            : "Iniciar sesión"}
      </Button>

      <p className="text-center text-xs text-text-muted">
        Puedes entrar con correo, teléfono o Google. Si usas teléfono en Human Wallet, elige
        México ({MEXICO_PHONE_PREFIX}) y escribe solo tus 10 dígitos (sin volver a poner el 52). Usa
        el mismo correo de tu reserva cuando sea posible.
      </p>

      <div className="border-t border-border-soft pt-3">
        <Button className="w-full" type="button" variant="outline" onClick={switchToStaff}>
          Staff
        </Button>
      </div>
    </Card>
  );
}
