import { readFileSync } from "node:fs";
import type { Catalogue } from "./discovery.js";

export const CATALOGUE_FILE = new URL("../data/procedures.json", import.meta.url);

export function loadCatalogue(file: URL = CATALOGUE_FILE): Catalogue {
  return JSON.parse(readFileSync(file, "utf8")) as Catalogue;
}
