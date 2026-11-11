import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadCatalogue } from "../src/catalogue-data.js";
import { renderCatalogue } from "../src/catalogue-doc.js";
import { buildOpenApi } from "../src/openapi.js";

const root = new URL("../../../docs/", import.meta.url);
const catalogue = loadCatalogue();

describe("generated documentation", () => {
  it("openapi.json in docs/ equals the generator output (edited or stale file would drift from the catalogue)", () => {
    const committed = JSON.parse(readFileSync(new URL("openapi.json", root), "utf8"));
    expect(committed).toEqual(
      JSON.parse(JSON.stringify(buildOpenApi(catalogue, "https://www.salesasaservice.at"))),
    );
  });

  it("procedure-catalogue.md in docs/ equals the renderer output", () => {
    expect(readFileSync(new URL("procedure-catalogue.md", root), "utf8")).toBe(renderCatalogue(catalogue));
  });

  it("maps queries to GET and mutations to POST (a mutation exposed as GET would be probed as a write)", () => {
    const doc = buildOpenApi(
      {
        measured: "d",
        procedures: {
          "a.q": { kind: "query", observed: "OK" },
          "a.m": { kind: "mutation", observed: "METHOD_NOT_SUPPORTED" },
        },
      },
      "https://x.test",
    ) as { paths: Record<string, object> };
    expect(Object.keys(doc.paths["/api/trpc/a.q"] ?? {})).toEqual(["get"]);
    expect(Object.keys(doc.paths["/api/trpc/a.m"] ?? {})).toEqual(["post"]);
  });

  it("groups the catalogue by router with one row per procedure", () => {
    const md = renderCatalogue({
      measured: "d",
      procedures: {
        "a.q": { kind: "query", observed: "OK" },
        "b.m": { kind: "mutation", observed: "PRECONDITION_FAILED" },
      },
    });
    expect(md).toContain("## a");
    expect(md).toContain("## b");
    expect(md).toContain("| `b.m` | POST | `PRECONDITION_FAILED` |");
  });

  it("does not leak any credential-looking or personal data into the bundled catalogue", () => {
    expect(JSON.stringify(catalogue)).not.toMatch(/@|password|token/i);
  });
});
