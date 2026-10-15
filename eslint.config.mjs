import js from "@eslint/js";
import globals from "globals";

// Adocao gradual: app.js e legado minificado em poucas linhas, entao as
// regras novas comecam em "warn". Regras de erro real continuam em "error".
export default [
  js.configs.recommended,
  {
    files: ["app.js", "fin-core.js"],
    languageOptions: {
      sourceType: "script",
      globals: {
        ...globals.browser,
        firebase: "readonly",
        XLSX: "readonly",
        Chart: "readonly",
        emailjs: "readonly",
        module: "writable",
      },
    },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "error",
      "no-empty": "warn",
      "max-lines": ["warn", 350],
    },
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: { globals: globals.node },
  },
  {
    // page.evaluate() roda no navegador, entao enxerga estes globais.
    files: ["scripts/fin-ui.mjs"],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser, finOnTab: "readonly" },
    },
  },
];
