import type { CapacitorConfig } from "@capacitor/cli";

/** Scoobix Rider (delivery) — store build config. */
const config: CapacitorConfig = {
  appId: "app.scoobix.rider",
  appName: "Scoobix Rider",
  webDir: "dist/client",
  android: { path: "android/rider" },
  ios: { path: "ios/rider" },
  server: {
    // Deep links: https://rider.scoobix.app/rider/... and scoobix-rider://...
    hostname: "rider.scoobix.app",
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: { backgroundColor: "#ffffff", showSpinner: false, launchAutoHide: true },
    Geolocation: { permissions: ["location"] },
  },
};

export default config;
