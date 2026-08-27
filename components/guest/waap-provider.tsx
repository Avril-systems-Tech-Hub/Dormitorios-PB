"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ensureWaaPReady, toGuestLoginError } from "@/lib/waap/client";
import { normalizeWalletAddress } from "@/lib/guest-auth/wallet";

type WaaPContextValue = {
  ready: boolean;
  address: string | null;
  isConnecting: boolean;
  error: string | null;
  login: () => Promise<string | null>;
  fetchLoginEmail: () => Promise<string | null>;
  logout: () => Promise<void>;
  clearError: () => void;
};

const WaaPContext = createContext<WaaPContextValue | null>(null);

export function WaaPProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.lang = "es-MX";
    let cancelled = false;

    ensureWaaPReady()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((err) => {
        if (!cancelled) setError(toGuestLoginError(err));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const fetchLoginEmail = useCallback(async () => {
    if (typeof window === "undefined" || !window.waap?.requestEmail) {
      return null;
    }

    try {
      const email = await window.waap.requestEmail();
      return typeof email === "string" && email.includes("@") ? email.trim().toLowerCase() : null;
    } catch {
      return null;
    }
  }, []);

  const login = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const provider = await ensureWaaPReady();
      await provider.login();
      const accounts = (await provider.request({
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
      setError(toGuestLoginError(err));
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, []);

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
      fetchLoginEmail,
      logout,
      clearError: () => setError(null),
    }),
    [ready, address, isConnecting, error, login, fetchLoginEmail, logout],
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
