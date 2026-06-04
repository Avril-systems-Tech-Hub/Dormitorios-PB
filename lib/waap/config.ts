import type { InitSilkOptions } from "@human.tech/waap-sdk";

export const waapConfig: InitSilkOptions = {
  useStaging: process.env.NEXT_PUBLIC_WAAP_USE_STAGING === "true",
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID,
  project: {
    name: "Dormitorios Plaza Basílica",
    entryTitle: "Dormitorios Plaza Basilica",
    projectId: process.env.NEXT_PUBLIC_WAAP_PROJECT_ID,
  },
  config: {
    authenticationMethods: ["email", "phone", "social"],
    allowedSocials: ["google"],
    styles: {
      darkMode: false,
    },
    showSecured: true,
  },
};
