import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  globalTeardown: "./e2e/mcp/global-teardown.ts",
  testDir: "e2e/mcp",
  testMatch: "*.spec.ts",
  workers: 1,
  timeout: 30000,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:38173",
    ...devices["Desktop Chrome"],
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/serve-mcp-ui-tests.mjs",
    url: "http://127.0.0.1:38173/harness.html",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
