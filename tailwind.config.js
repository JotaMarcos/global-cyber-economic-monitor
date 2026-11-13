/** Tokens de design do painel (tema escuro único, paleta ardósia e ciano). */
export default {
  content: ["./index.html", "./src/web/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#020617",
        panel: "#0f172a",
        raised: "#1e293b",
        line: "#1e293b",
        ink: "#f1f5f9",
        muted: "#94a3b8",
        faint: "#7d8ba1",
        accent: "#22d3ee",
        good: "#34d399",
        warning: "#fbbf24",
        serious: "#fb923c",
        critical: "#f43f5e",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
