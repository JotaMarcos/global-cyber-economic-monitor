import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const GATEWAY_URL = process.env.GCEM_GATEWAY_URL ?? "http://127.0.0.1:8787";

export default defineConfig({
  plugins: [react()],
  server: {
    // Em desenvolvimento, o dashboard alcança o gateway pela mesma origem.
    proxy: { "/api": { target: GATEWAY_URL, changeOrigin: true } },
  },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/main/main.{ts,tsx}", "src/**/*.d.ts"],
      thresholds: { lines: 90, functions: 90, branches: 80, statements: 90 },
    },
  },
});
