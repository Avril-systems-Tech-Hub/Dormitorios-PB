"use client";

import {
  EthereumProvider,
  handleWalletRequestAndResponse,
  initWaaP,
  SILK_METHOD,
  type SilkProvider,
} from "@human.tech/waap-sdk";
import { getWaapConfig, waapGuestUiConfig } from "@/lib/waap/config";

const WAAP_IFRAME_IDS = ["waap-wallet-iframe", "silk-wallet-iframe"] as const;

function asEthereumProvider(provider: SilkProvider): EthereumProvider {
  return provider as EthereumProvider;
}

let initPromise: Promise<SilkProvider> | null = null;

function getWaapIframe(): HTMLIFrameElement | null {
  for (const id of WAAP_IFRAME_IDS) {
    const element = document.getElementById(id);
    if (element instanceof HTMLIFrameElement) return element;
  }
  return null;
}

function waitForWaapIframe(timeoutMs = 15_000): Promise<HTMLIFrameElement> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();

    const finish = (iframe: HTMLIFrameElement) => {
      iframe.addEventListener("load", () => resolve(iframe), { once: true });
      window.setTimeout(() => resolve(iframe), 400);
    };

    const poll = () => {
      const iframe = getWaapIframe();
      if (iframe) {
        finish(iframe);
        return;
      }
      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error("El inicio de sesión tardó demasiado en cargar."));
        return;
      }
      window.setTimeout(poll, 50);
    };

    poll();
  });
}

async function pingWithRetry(provider: EthereumProvider, attempts = 4) {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await provider.walletMessageManager.pingIframe();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => window.setTimeout(resolve, 400));
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("El inicio de sesión no respondió.");
}

async function applyGuestLoginConfig(provider: EthereumProvider) {
  const origin = window.location.origin;
  await handleWalletRequestAndResponse(
    { method: SILK_METHOD.set_custom_config, params: [waapGuestUiConfig] },
    false,
    provider.walletMessageManager,
    provider.internalEventEmitter,
  );
  await handleWalletRequestAndResponse(
    {
      method: SILK_METHOD.set_project,
      params: [getWaapConfig(origin).project, origin],
    },
    false,
    provider.walletMessageManager,
    provider.internalEventEmitter,
  );
}

export function toGuestLoginError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const lower = raw.toLowerCase();

  if (
    lower.includes("sdk initialization") ||
    lower.includes("auth polling") ||
    lower.includes("authentication session") ||
    lower.includes("ping timed out") ||
    lower.includes("wallet ping")
  ) {
    return "El acceso aún se está preparando. Espera un momento e intenta de nuevo.";
  }
  if (lower.includes("user rejected") || lower.includes("rejected") || lower.includes("cancel")) {
    return "Inicio de sesión cancelado.";
  }
  if (lower.includes("timed out") || lower.includes("timeout")) {
    return "El inicio de sesión tardó demasiado. Intenta de nuevo.";
  }
  return "No se pudo completar el inicio de sesión.";
}

export function ensureWaaPReady(): Promise<SilkProvider> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const provider = asEthereumProvider(
      window.waap ?? initWaaP(getWaapConfig(window.location.origin)),
    );

    await waitForWaapIframe();
    await pingWithRetry(provider);

    try {
      await applyGuestLoginConfig(provider);
    } catch (error) {
      console.warn("Could not re-apply Human Wallet guest login config:", error);
    }

    if (!window.waap) {
      throw new Error("El inicio de sesión no está listo.");
    }

    return window.waap;
  })().catch((error) => {
    initPromise = null;
    throw error;
  });

  return initPromise;
}
