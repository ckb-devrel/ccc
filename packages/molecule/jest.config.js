/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/*.spec.ts"],
  moduleFileExtensions: ["ts", "js", "json", "peggy", "node"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.json" }],
    "^.+\\.peggy$": [
      "<rootDir>/peggy-transformer.js",
      { tsconfig: "tsconfig.json" },
    ],
  },
};
