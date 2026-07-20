import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
    environment: "node",
    include: ["**/*.test.ts"],
    // `.trigger` holds Trigger.dev build-cache copies of source (and their
    // tests); scanning them double-runs stale duplicates. `.next` is a build
    // output too.
    exclude: [...configDefaults.exclude, "**/.trigger/**", "**/.next/**"],
  },
});
