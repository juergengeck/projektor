import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 240_000,
  workers: 1,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4276",
  },
  webServer: {
    command: "npx vite preview --port 4276 --strictPort --host 127.0.0.1",
    url: "http://127.0.0.1:4276/browser/",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
