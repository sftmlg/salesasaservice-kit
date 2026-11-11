import { readFileSync } from "node:fs";
import { z } from "zod";
import type { Catalogue } from "./discovery.js";

const catalogueSchema: z.ZodType<Catalogue> = z.object({
  measured: z.string(),
  procedures: z.record(
    z
      .object({
        router: z.string(),
        kind: z.enum(["query", "mutation"]),
        confirmedBy: z.enum(["get-refused", "get-answered"]),
        note: z.string().optional(),
      })
      .strict(),
  ),
});

export const CATALOGUE_FILE = new URL("../data/procedures.json", import.meta.url);

export function loadCatalogue(file: URL = CATALOGUE_FILE): Catalogue {
  return catalogueSchema.parse(JSON.parse(readFileSync(file, "utf8")));
}
