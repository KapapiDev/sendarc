import { defineConfig } from "astro/config";

const site = process.env.PUBLIC_SITE_URL ?? "https://sendarc.pages.dev";

export default defineConfig({
  site,
  output: "static",
  trailingSlash: "always",
  build: {
    format: "directory",
  },
  vite: {
    build: {
      // Keep browser code in same-origin assets so the production CSP can stay
      // strict without allowing arbitrary inline script execution.
      assetsInlineLimit: 0,
      sourcemap: false,
    },
  },
});
