import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Scoobix Customer — Play Store / App Store build config.
 * Build: `bun run build` then `npx cap sync --config capacitor/customer.config.ts`
 */
const config: CapacitorConfig = {
  appId: "app.scoobix.customer",
  appName: "Scoobix",
  webDir: "dist/client",
  android: { path: "android/customer" },
  ios: { path: "ios/customer" },
  server: {
    // Deep links: https://scoobix.app/app/... and scoobix://app/...
    hostname: "scoobix.app",
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: { backgroundColor: "#ffffff", showSpinner: false, launchAutoHide: true },
  },
};

export default config;
