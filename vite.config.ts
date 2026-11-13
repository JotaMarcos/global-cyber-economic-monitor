import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const GATEWAY_URL = process.env.GCEM_GATEWAY_URL ?? "http://127.0.0.1:8787";

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        // Bibliotecas em pacotes próprios: mudam pouco e ficam em cache no navegador.
        codeSplitting: {
          groups: [
            {
              name: "charts",
              test: /node_modules[\\/](recharts|d3-[^\\/]+|victory-vendor|@reduxjs|redux|react-redux|immer|reselect|es-toolkit|decimal\.js-light|eventemitter3|tiny-invariant)[\\/]/,
            },
            {
              name: "react",
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
            },
          ],
        },
      },
    },
  },
  server: {
    // Sem isto o Vite escuta em "localhost", que no Windows pode resolver só
    // para IPv6 (::1) e recusar conexões em 127.0.0.1.
    host: "127.0.0.1",
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
