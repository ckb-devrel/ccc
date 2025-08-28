import { readFileSync } from "fs";
import * as yaml from "js-yaml";
import { join } from "path";

function configPath() {
  switch (process.env.NODE_ENV) {
    case "production":
      return "/config/config.production.yaml";
    case "development":
      return "/config/config.development.yaml";
    case "local":
      return "/config/config.local.yaml";
    default:
      return "/config/config.yaml";
  }
}

export function loadConfig() {
  return yaml.load(
    readFileSync(join(process.cwd(), configPath()), "utf8"),
  ) as Record<string, any>;
}
