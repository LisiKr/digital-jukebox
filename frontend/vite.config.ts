import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // We add this to force TanStack to build for Vercel, not Cloudflare
  vite: {
    ssr: {
      external: ["node:buffer", "node:path", "node:fs"],
    },
  },
});