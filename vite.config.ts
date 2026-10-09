// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    resolve: {
      alias: [
        // InsForge realtime pulls engine.io-client; its Node-only files require node:fs/child_process,
        // which the published worker runtime lacks (every page 500s). Swap just those files for their
        // browser equivalents (same mapping as the package's "browser" field), keeping the same version
        // as socket.io-client. Do NOT alias to the minified dist build — it breaks socket.io-client.
        {
          find: /^(\.\.?\/(?:transports\/)?)(globals|polling-xhr|websocket)\.node\.js$/,
          replacement: "$1$2.js",
        },
      ],
    },
  },
});
