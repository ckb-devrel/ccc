import dotenv from "dotenv";
import { dirname } from "path";
import { fileURLToPath } from "url";

dotenv.config({ path: dirname(fileURLToPath(import.meta.url)) + "/../.env" });
