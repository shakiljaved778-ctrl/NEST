// @ts-check
import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import globals from "globals";
import tseslint from "typescript-eslint";

/** Money must never touch JS floats in engine code (non-negotiable 10). */
const moneySafetyRules = {
  "no-restricted-globals": [
    "error",
    { name: "parseFloat", message: "Money is decimal: use D()/Money from @amil/rules-engine." },
  ],
  "no-restricted-properties": [
    "error",
    { object: "Math", property: "round", message: "Use Decimal rounding with an explicit mode." },
    { object: "Number", property: "parseFloat", message: "Money is decimal: use D()." },
    { property: "toFixed", message: "Use Money formatting / Decimal.toFixed via helpers." },
  ],
  "no-restricted-syntax": [
    "error",
    {
      selector: "NewExpression[callee.name='Date'][arguments.length=0]",
      message: "Rules engine is pure: inject `now` instead of new Date().",
    },
    {
      selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
      message: "Rules engine is pure: inject `now` instead of Date.now().",
    },
  ],
};

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/dist/**",
      "**/coverage/**",
      "**/next-env.d.ts",
      "**/*.config.{js,mjs,cjs}",
      "**/scripts/**/*.mjs",
      "**/prompts.generated.ts",
      "**/knowledge.generated.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      eqeqeq: ["error", "always"],
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  {
    files: ["apps/demo-bank/**/*.{ts,tsx}", "apps/console/**/*.{ts,tsx}"],
    plugins: { "@next/next": nextPlugin },
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  {
    files: ["packages/rules-engine/src/**/*.ts", "packages/rule-packs/src/**/*.ts"],
    ignores: ["**/*.test.ts"],
    rules: moneySafetyRules,
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/seed.ts", "**/scripts/**"],
    rules: { "no-console": "off" },
  },
);
