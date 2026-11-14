/** Tokens de design do painel (tema claro único, paleta neutra fria e violeta). */
export default {
  content: ["./index.html", "./src/web/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#f4f5fa",
        panel: "#ffffff",
        raised: "#eef0f6",
        line: "#dfe2ec",
        ink: "#1c2030",
        muted: "#555d72",
        faint: "#6a7288",
        accent: "#5a35c9",
        good: "#1a7f47",
        warning: "#a35a00",
        serious: "#c2410c",
        critical: "#c81e4a",
        // Faixa de apresentação: gradiente do violeta ao azul.
        "hero-from": "#3d1f99",
        "hero-via": "#4f3fd1",
        "hero-to": "#2f7fc4",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
