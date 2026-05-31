import type { SilkProvider } from "@human.tech/waap-sdk";

declare global {
  interface Window {
    waap?: SilkProvider;
    silk?: SilkProvider;
  }
}

export {};
