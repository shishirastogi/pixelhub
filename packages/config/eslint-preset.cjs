const js = require("@eslint/js");
const tseslint = require("typescript-eslint");

/**
 * Shared ESLint flat config. Import from a workspace like:
 *
 *   const base = require("@pixelhub/config/eslint");
 *   module.exports = [...base, { ignores: [".next/**", "dist/**"] }];
 */
module.exports = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "warn",
    },
  },
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/coverage/**",
      "**/*.config.*",
    ],
  },
);
