/** Tokens de design do painel (tema escuro único). */
export default {
  content: ["./index.html", "./src/web/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#090c11",
        panel: "#10151c",
        raised: "#171d26",
        line: "#232b37",
        ink: "#e7eaf0",
        muted: "#a3acb9",
        faint: "#727d8c",
        accent: "#3987e5",
        good: "#0ca30c",
        warning: "#fab219",
        serious: "#ec835a",
        critical: "#d03b3b",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
