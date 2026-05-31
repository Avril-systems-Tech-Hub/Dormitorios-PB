"use client";

import { initWaaP } from "@human.tech/waap-sdk";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { waapConfig } from "@/lib/waap/config";
import { normalizeWalletAddress } from "@/lib/guest-auth/wallet";

type WaaPContextValue = {
  ready: boolean;
  address: string | null;
  isConnecting: boolean;
  error: string | null;
  login: () => Promise<string | null>;
  logout: () => Promise<void>;
  clearError: () => void;
};

const WaaPContext = createContext<WaaPContextValue | null>(null);

async function readConnectedAddress() {
  if (typeof window === "undefined" || !window.waap) return null;

  try {
    const method = window.waap.getLoginMethod?.();
    if (!method) return null;

    const accounts = (await window.waap.request({
      method: "eth_accounts",
    })) as string[];

    if (!accounts?.[0]) return null;
    return normalizeWalletAddress(accounts[0]);
  } catch {
    return null;
  }
}

export function WaaPProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initWaaP(waapConfig);
    setReady(true);

    void readConnectedAddress().then(setAddress);
  }, []);

  const login = useCallback(async () => {
    if (!ready || typeof window === "undefined" || !window.waap) {
      setError("El inicio de sesión aún no está listo. Intenta de nuevo.");
      return null;
    }

    setIsConnecting(true);
    setError(null);

    try {
      await window.waap.login();
      const accounts = (await window.waap.request({
        method: "eth_requestAccounts",
      })) as string[];

      if (!accounts?.[0]) {
        setError("No se pudo iniciar sesión.");
        return null;
      }

      const normalized = normalizeWalletAddress(accounts[0]);
      setAddress(normalized);
      return normalized;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "No se pudo completar el inicio de sesión.";
      setError(message);
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, [ready]);

  const logout = useCallback(async () => {
    if (typeof window !== "undefined" && window.waap?.logout) {
      await window.waap.logout();
    }
    setAddress(null);
    setError(null);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      address,
      isConnecting,
      error,
      login,
      logout,
      clearError: () => setError(null),
    }),
    [ready, address, isConnecting, error, login, logout],
  );

  return <WaaPContext.Provider value={value}>{children}</WaaPContext.Provider>;
}

export function useWaaP() {
  const context = useContext(WaaPContext);
  if (!context) {
    throw new Error("useWaaP must be used within WaaPProvider.");
  }
  return context;
}
