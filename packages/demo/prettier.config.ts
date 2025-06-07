// prettier.config.ts, .prettierrc.ts, prettier.config.mts, or .prettierrc.mts

import { type Config } from "prettier";
import organizeImports from "prettier-plugin-organize-imports";
import tailwindcss from "prettier-plugin-tailwindcss";

const config: Config = {
  singleQuote: false,
  trailingComma: "all",
  plugins: [organizeImports, tailwindcss],
};

export default config;
