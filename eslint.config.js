import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

/** Regra de dependência: cada módulo declara de quais módulos não pode importar. */
const restrict = (module, forbiddenModules, extraPatterns = []) => ({
  files: [`src/${module}/**/*.{ts,tsx}`],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          ...forbiddenModules.map((forbidden) => ({
            group: [`**/${forbidden}/**`],
            message: `"${module}" não pode depender de "${forbidden}".`,
          })),
          ...extraPatterns,
        ],
      },
    ],
  },
});

const noUiFrameworks = {
  group: ["react", "react-dom", "react-dom/*", "lucide-react"],
  message: "Regras de negócio não dependem de frameworks de interface.",
};
const noNodeApis = {
  group: ["node:*"],
  message: "Esta camada não depende de APIs do Node.",
};

export default tseslint.config(
  { ignores: ["dist", "coverage", "node_modules"] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-non-null-assertion": "off",
      eqeqeq: "error",
      "no-console": "error",
    },
  },
  { files: ["scripts/**/*.ts"], rules: { "no-console": "off" } },
  { files: ["*.config.{js,ts}"], languageOptions: { globals: globals.node } },

  restrict("shared", ["contract", "gateway", "web"], [noUiFrameworks, noNodeApis]),
  restrict("contract", ["shared", "gateway", "web"], [noUiFrameworks, noNodeApis]),

  restrict("gateway", ["web"], [noUiFrameworks]),
  restrict(
    "gateway/application",
    ["infrastructure", "main", "web"],
    [noUiFrameworks, noNodeApis],
  ),
  restrict("gateway/infrastructure", ["main", "web"], [noUiFrameworks]),

  restrict("web", ["gateway"], [noNodeApis]),
  restrict(
    "web/domain",
    ["application", "infrastructure", "presentation", "main", "gateway"],
    [noUiFrameworks, noNodeApis],
  ),
  restrict(
    "web/application",
    ["infrastructure", "presentation", "main", "gateway"],
    [noUiFrameworks, noNodeApis],
  ),
  restrict(
    "web/infrastructure",
    ["presentation", "main", "gateway"],
    [noUiFrameworks, noNodeApis],
  ),
  restrict("web/presentation", ["infrastructure", "main", "gateway"], [noNodeApis]),
);
