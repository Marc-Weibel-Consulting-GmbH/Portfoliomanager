import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

// Pragmatische Erst-Konfiguration (Ratcheting-Ansatz):
// bewusst "warn" statt "error" bei Legacy-Befunden — nach Bereinigung schaerfen.
export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "vendor/**",
      "mcp-servers/**",
      "analytics_service/**",
      "tradingview-service/**",
      "design/**",
      "references/**",
      "exports/**",
      "upload/**",
      "scripts/oneoff/**",
      "drizzle/meta/**",
      "**/*.mjs",
      "**/*.cjs",
      "*.config.js",
      ".manus/**",
      ".claude/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["client/src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    languageOptions: { globals: globals.browser },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    files: [
      "server/**/*.ts",
      "shared/**/*.ts",
      "e2e/**/*.ts",
      "*.config.ts",
      "scripts/**/*.ts",
    ],
    languageOptions: { globals: globals.node },
  },
  {
    rules: {
      // Legacy-Code enthaelt viele `any` (Audit-Befund C-2) — erst warnen,
      // mit strict-Mode-Aktivierung spaeter auf "error" heben.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": "off",
    },
  }
);
