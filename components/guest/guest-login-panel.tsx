"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  establishGuestSessionAction,
  guestLogoutAction,
  linkGuestPhoneAction,
} from "@/actions/guest-auth";
import { useWaaP } from "@/components/guest/waap-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Step = "login" | "link-phone";

export function GuestLoginPanel() {
  const router = useRouter();
  const { ready, address, isConnecting, error, login, logout, clearError } = useWaaP();
  const [step, setStep] = useState<Step>("login");
  const [pendingAddress, setPendingAddress] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleLogin = () => {
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
        setStep("link-phone");
        return;
      }

      router.refresh();
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
      router.refresh();
    });
  };

  const handleLogout = () => {
    startTransition(async () => {
      await guestLogoutAction();
      await logout();
      setStep("login");
      setPendingAddress(null);
      setPhone("");
      setFullName("");
      router.refresh();
    });
  };

  if (step === "link-phone" && pendingAddress) {
    return (
      <Card className="mx-auto w-full max-w-md space-y-4">
        <div className="space-y-2 text-center">
          <h1 className="text-xl font-semibold text-text-main">Vincula tu teléfono</h1>
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
          <Button className="w-full" type="button" variant="ghost" onClick={handleLogout}>
            Cancelar
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-md space-y-4">
      <div className="space-y-2 text-center">
        <h1 className="text-xl font-semibold text-text-main">Mi cuenta</h1>
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
        onClick={handleLogin}
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
    </Card>
  );
}
