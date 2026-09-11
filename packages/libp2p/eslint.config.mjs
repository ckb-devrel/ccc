// @ts-check

import eslint from "@eslint/js";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import tseslint from "typescript-eslint";

import { dirname } from "path";
import { fileURLToPath } from "url";

export default [
  ...tseslint.config({
    files: ["**/*.ts"],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
    ],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "all",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "@typescript-eslint/unbound-method": ["error", { ignoreStatic: true }],
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/only-throw-error": [
        "error",
        {
          allowThrowingAny: true,
          allowThrowingUnknown: true,
          allowRethrowing: true,
        },
      ],
      "@typescript-eslint/prefer-promise-reject-errors": [
        "error",
        {
          allowThrowingAny: true,
          allowThrowingUnknown: true,
        },
      ],
      "no-empty": "off",
      "prefer-const": [
        "error",
        { ignoreReadBeforeAssign: true, destructuring: "all" },
      ],
    },
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: dirname(fileURLToPath(import.meta.url)),
      },
    },
  }),
  eslintPluginPrettierRecommended,
];
