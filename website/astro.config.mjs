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
      sourcemap: false,
    },
  },
});
