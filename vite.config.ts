import { defineConfig } from "vite";

/**
 * GitHub Pages project site: `https://<user>.github.io/<repo>/`
 * User/org root site: repo named `<user>.github.io` → served at `https://<user>.github.io/` (base `/`).
 */
function resolveBase(): string {
  if (process.env.GITHUB_ACTIONS !== "true") return "/";
  const full = process.env.GITHUB_REPOSITORY ?? "";
  const slash = full.indexOf("/");
  const repoName = slash >= 0 ? full.slice(slash + 1) : "";
  if (!repoName) return "/";
  if (repoName.endsWith(".github.io")) return "/";
  return `/${repoName}/`;
}

export default defineConfig({
  base: resolveBase(),
  server: {
    host: true,
  },
});
