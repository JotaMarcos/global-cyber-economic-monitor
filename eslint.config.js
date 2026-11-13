import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

/** Regra de dependência da Clean Architecture: imports apontam para dentro. */
const restrictLayer = (layer, forbiddenLayers, extraPatterns = []) => ({
  files: [`src/${layer}/**/*.{ts,tsx}`],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          ...forbiddenLayers.map((forbidden) => ({
            group: [`**/${forbidden}/**`],
            message: `A camada "${layer}" não pode depender de "${forbidden}".`,
          })),
          ...extraPatterns,
        ],
      },
    ],
  },
});

const noFrameworks = {
  group: ["react", "react-dom", "react-dom/*", "recharts", "lucide-react"],
  message: "Regras de negócio não dependem de frameworks de interface.",
};

export default tseslint.config(
  { ignores: ["dist", "coverage", "node_modules"] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-non-null-assertion": "off",
      eqeqeq: "error",
      "no-console": "error",
    },
  },
  { files: ["*.config.{js,ts}"], languageOptions: { globals: globals.node } },
  restrictLayer(
    "shared",
    ["domain", "application", "infrastructure", "presentation", "main"],
    [noFrameworks],
  ),
  restrictLayer(
    "domain",
    ["application", "infrastructure", "presentation", "main"],
    [noFrameworks],
  ),
  restrictLayer(
    "application",
    ["infrastructure", "presentation", "main"],
    [noFrameworks],
  ),
  restrictLayer("infrastructure", ["presentation", "main"], [noFrameworks]),
  restrictLayer("presentation", ["infrastructure", "main"]),
);
