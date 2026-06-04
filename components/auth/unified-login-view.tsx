"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  establishGuestSessionAction,
  guestLogoutAction,
  linkGuestPhoneAction,
} from "@/actions/guest-auth";
import { useWaaP } from "@/components/guest/waap-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Mode = "guest" | "staff";
type GuestStep = "login" | "link-phone";

export function UnifiedLoginView({
  staffError,
  initialMode = "guest",
}: {
  staffError?: string;
  initialMode?: Mode;
}) {
  const router = useRouter();
  const { ready, address, isConnecting, error, login, logout, clearError } = useWaaP();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [guestStep, setGuestStep] = useState<GuestStep>("login");
  const [pendingAddress, setPendingAddress] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
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
      const connectedAddress = address ?? (await login());
      if (!connectedAddress) return;

      const result = await establishGuestSessionAction(connectedAddress);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }

      if (result.needsPhoneLink) {
        setPendingAddress(connectedAddress);
        setGuestStep("link-phone");
        return;
      }

      goToAccount();
    });
  };

  const handleLinkPhone = () => {
    if (!pendingAddress) return;
    setFormError(null);

    startTransition(async () => {
      const result = await linkGuestPhoneAction(pendingAddress, phone, fullName);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      goToAccount();
    });
  };

  const handleCancelLinkPhone = () => {
    startTransition(async () => {
      await guestLogoutAction();
      await logout();
      setGuestStep("login");
      setPendingAddress(null);
      setPhone("");
      setFullName("");
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

  if (guestStep === "link-phone" && pendingAddress) {
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
          <h1 className="text-xl font-semibold">Vincula tu teléfono</h1>
          <p className="text-sm text-text-muted">
            Usamos tu teléfono para encontrar tus reservas anteriores.
          </p>
        </div>

        <div className="space-y-3">
          <Input
            name="phone"
            placeholder="Teléfono (10 dígitos)"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            required
          />
          <Input
            name="fullName"
            placeholder="Nombre (opcional)"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
          {formError ? <p className="text-sm text-danger">{formError}</p> : null}
          <Button
            className="w-full"
            type="button"
            disabled={isPending || phone.trim().length < 10}
            onClick={handleLinkPhone}
          >
            {isPending ? "Vinculando…" : "Continuar"}
          </Button>
          <Button className="w-full" type="button" variant="ghost" onClick={handleCancelLinkPhone}>
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
            : address
              ? "Continuar"
              : "Iniciar sesión"}
      </Button>

      <p className="text-center text-xs text-text-muted">
        Puedes entrar con correo, teléfono o redes sociales.
      </p>

      <div className="border-t border-border-soft pt-3">
        <Button className="w-full" type="button" variant="outline" onClick={switchToStaff}>
          Staff
        </Button>
      </div>
    </Card>
  );
}
