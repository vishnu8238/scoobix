import type { CapacitorConfig } from "@capacitor/cli";

/** Scoobix Partner (restaurant) — store build config. */
const config: CapacitorConfig = {
  appId: "app.scoobix.partner",
  appName: "Scoobix Partner",
  webDir: "dist/client",
  android: { path: "android/partner" },
  ios: { path: "ios/partner" },
  server: {
    // Deep links: https://partner.scoobix.app/partner/... and scoobix-partner://...
    hostname: "partner.scoobix.app",
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: { backgroundColor: "#ffffff", showSpinner: false, launchAutoHide: true },
  },
};

export default config;
