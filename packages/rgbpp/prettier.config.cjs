/**
 * @see https://prettier.io/docs/configuration
 * @type {import("prettier").Config}
 */
const config = {
  singleQuote: false,
  trailingComma: "all",
  plugins: [require.resolve("prettier-plugin-organize-imports")],
};

module.exports = config;
