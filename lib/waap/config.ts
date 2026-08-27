import type { InitSilkOptions } from "@human.tech/waap-sdk";

/** Email + Google only — no wallets, GitHub, or other socials. */
export const waapGuestUiConfig: NonNullable<InitSilkOptions["config"]> = {
  authenticationMethods: ["email", "social"],
  allowedSocials: ["google"],
  styles: {
    darkMode: false,
  },
  showSecured: true,
};

export function getWaapConfig(origin?: string): InitSilkOptions {
  return {
    useStaging: process.env.NEXT_PUBLIC_WAAP_USE_STAGING === "true",
    project: {
      name: "Dormitorios Plaza Basílica",
      entryTitle: "Entra con tu correo",
      projectId: process.env.NEXT_PUBLIC_WAAP_PROJECT_ID,
      ...(origin
        ? {
            authSuccessUrl: `${origin}/login`,
            authErrorUrl: `${origin}/login`,
          }
        : {}),
    },
    config: waapGuestUiConfig,
  };
}

/** Static config for non-window contexts. Prefer getWaapConfig() in the browser. */
export const waapConfig: InitSilkOptions = getWaapConfig();
