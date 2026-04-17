import { defineConfig } from "vite";

/** GitHub Pages project site: https://<user>.github.io/ridiculous-fishing/ */
const repoBase = "/ridiculous-fishing/";

export default defineConfig({
  /** Production builds in CI use repo base; local dev stays at `/`. */
  base: process.env.GITHUB_ACTIONS === "true" ? repoBase : "/",
  server: {
    host: true,
  },
});